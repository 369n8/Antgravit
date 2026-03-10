/**
 * fines-webhook — Edge Function
 *
 * Endpoint para receber multas de serviços externos (Make, n8n, Zapier, fines-scanner).
 * Usa vehicle_allocations para busca retroativa do locatário responsável
 * na data EXATA da infração, mesmo que o veículo já tenha trocado de dono.
 *
 * POST /functions/v1/fines-webhook
 * Header: x-webhook-secret: <FINES_WEBHOOK_SECRET>
 * Body: {
 *   vehicle_id: string (uuid),
 *   infraction_date: string (ISO),
 *   amount: number,
 *   description: string,
 *   infraction_code?: string,
 *   due_date?: string (YYYY-MM-DD)
 * }
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  // Auth via shared secret
  const secret = Deno.env.get("FINES_WEBHOOK_SECRET");
  if (secret) {
    const provided = req.headers.get("x-webhook-secret");
    if (provided !== secret) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...CORS, "Content-Type": "application/json" }
      });
    }
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...CORS, "Content-Type": "application/json" }
    });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400, headers: { ...CORS, "Content-Type": "application/json" }
    });
  }

  const { vehicle_id, infraction_date, amount, description, infraction_code, due_date } = body as {
    vehicle_id: string;
    infraction_date: string;
    amount: number;
    description: string;
    infraction_code?: string;
    due_date?: string;
  };

  if (!vehicle_id || !infraction_date || !amount) {
    return new Response(JSON.stringify({ error: "vehicle_id, infraction_date e amount são obrigatórios" }), {
      status: 400, headers: { ...CORS, "Content-Type": "application/json" }
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  // Descobrir qual client_id é dono do veículo
  const { data: vehicle, error: vErr } = await supabase
    .from("vehicles")
    .select("id, client_id")
    .eq("id", vehicle_id)
    .single();

  if (vErr || !vehicle) {
    return new Response(JSON.stringify({ error: "Veículo não encontrado" }), {
      status: 404, headers: { ...CORS, "Content-Type": "application/json" }
    });
  }

  // ── BUSCA RETROATIVA via vehicle_allocations ──────────────────────────────
  // Quem estava com o veículo na data EXATA da infração?
  // Usa o histórico imutável, blindando a atribuição mesmo após troca de locatário.
  const { data: allocation } = await supabase
    .from("vehicle_allocations")
    .select("tenant_id")
    .eq("vehicle_id", vehicle_id)
    .lte("start_date", infraction_date)
    .or(`end_date.is.null,end_date.gte.${infraction_date}`)
    .order("start_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  const tenantId = allocation?.tenant_id ?? null;

  // Fallback: se não houver histórico de alocação, tenta pelo tenant atual
  let fallbackTenantId: string | null = null;
  if (!tenantId) {
    const { data: currentTenant } = await supabase
      .from("tenants")
      .select("id")
      .eq("vehicle_id", vehicle_id)
      .eq("client_id", vehicle.client_id)
      .eq("status", "ativo")
      .lte("since", infraction_date.slice(0, 10))
      .order("since", { ascending: false })
      .limit(1)
      .maybeSingle();
    fallbackTenantId = currentTenant?.id ?? null;
  }

  const resolvedTenantId = tenantId ?? fallbackTenantId;

  // Inserir multa
  const { data: fine, error: fErr } = await supabase
    .from("fines")
    .insert({
      client_id: vehicle.client_id,
      vehicle_id,
      tenant_id: resolvedTenantId,
      infraction_date,
      date: infraction_date.slice(0, 10),
      amount,
      description: description ?? "Multa via webhook",
      infraction_code: infraction_code ?? null,
      due_date: due_date ?? null,
      status: "pendente",
      saas_fee: 2.50, // Taxa da plataforma myfrot.ai por multa processada
    })
    .select()
    .single();

  if (fErr) {
    return new Response(JSON.stringify({ error: fErr.message }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" }
    });
  }

  const source = tenantId ? "vehicle_allocations" : fallbackTenantId ? "tenants_fallback" : "not_found";

  const responseObj: Record<string, unknown> = {
    ok: true,
    fine_id: fine.id,
    tenant_matched: !!resolvedTenantId,
    tenant_id: resolvedTenantId,
    attribution_source: source,
  };

  // ── MONETIZAÇÃO: Chargeback Automático ────────────────────────────────
  // Se identificamos o motorista, já lançamos a dívida no financeiro dele.
  if (resolvedTenantId) {
    const adminFee = 25.00; // Valor padrão de gestão administrativa
    const totalCharge = amount + adminFee;

    const { data: chargeback, error: cbErr } = await supabase
      .from("payments")
      .insert({
        client_id: vehicle.client_id,
        tenant_id: resolvedTenantId,
        week_label: `Multa: ${description?.slice(0, 30)}...`,
        due_date: due_date ?? infraction_date.slice(0, 10),
        value_amount: totalCharge,
        paid_status: false,
        payment_method: 'A definir',
      })
      .select()
      .single();

    if (!cbErr && chargeback) {
      // Vincular o pagamento à multa para rastreabilidade
      await supabase
        .from("fines")
        .update({ chargeback_payment_id: chargeback.id, admin_fee: adminFee })
        .eq("id", fine.id);

      responseObj["chargeback_created"] = true;
      responseObj["chargeback_id"] = chargeback.id;
      responseObj["total_charged"] = totalCharge;
    }
  }

  return new Response(JSON.stringify(responseObj),
    { status: 201, headers: { ...CORS, "Content-Type": "application/json" } }
  );
});
