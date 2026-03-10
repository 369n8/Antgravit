/**
 * create-invoice — Edge Function
 *
 * Gera uma fatura semanal via Stripe Checkout (PIX + Cartão) para um inquilino.
 * Idempotente: se já existe fatura aberta para a semana corrente, retorna a existente.
 *
 * POST /functions/v1/create-invoice
 * Body: { tenant_id: string }
 * Auth: anon key (Portal do Inquilino) ou service role (Admin)
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14?target=deno";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

function getWeekBounds() {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const mon = new Date(now);
  mon.setDate(now.getDate() + diff);
  mon.setHours(0, 0, 0, 0);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  sun.setHours(23, 59, 59, 999);
  return { mon, sun };
}

function getWeekLabel(mon: Date, sun: Date): string {
  const fmt = (d: Date) =>
    `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
  return `Semana ${fmt(mon)} — ${fmt(sun)}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const json = (payload: object, status = 200) =>
    new Response(JSON.stringify(payload), {
      status,
      headers: { ...CORS, "Content-Type": "application/json" },
    });

  try {
    const { tenant_id } = await req.json();
    if (!tenant_id) return json({ error: "tenant_id é obrigatório" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // ── 1. Buscar tenant ─────────────────────────────────────────────────────
    const { data: tenant, error: tErr } = await supabase
      .from("tenants")
      .select("id, name, email, phone, rent_weekly, client_id")
      .eq("id", tenant_id)
      .single();

    if (tErr || !tenant) return json({ error: "Locatário não encontrado" }, 404);
    if (!tenant.rent_weekly || Number(tenant.rent_weekly) <= 0) {
      return json({ error: "Valor de aluguel não configurado para este locatário" }, 400);
    }

    // ── 2. Buscar frotista ───────────────────────────────────────────────────
    const { data: client } = await supabase
      .from("clients")
      .select("stripe_account_id, stripe_connect_status, subscription_status")
      .eq("id", tenant.client_id)
      .single();

    // ── 3. Idempotência: verificar fatura aberta desta semana ────────────────
    const { mon, sun } = getWeekBounds();

    const { data: existing } = await supabase
      .from("invoices")
      .select("id, status, payment_url")
      .eq("tenant_id", tenant_id)
      .gte("created_at", mon.toISOString())
      .lte("created_at", sun.toISOString())
      .neq("status", "cancelled")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing?.status === "paid") {
      return json({ ok: true, already_paid: true, invoice_id: existing.id });
    }
    if (existing?.status === "pending" && existing.payment_url) {
      return json({ ok: true, invoice_id: existing.id, payment_url: existing.payment_url, reused: true });
    }

    // ── 4. Gerar UUID antecipado para metadata do Stripe ────────────────────
    const invoiceId = crypto.randomUUID();

    // ── 5. Criar Checkout Session no Stripe ─────────────────────────────────
    const amountCents = Math.round(Number(tenant.rent_weekly) * 100);
    const weekLabel = getWeekLabel(mon, sun);
    const appUrl = Deno.env.get("APP_URL") ?? "https://myfrot.ai";

    const hasConnect =
      !!client?.stripe_account_id && client?.stripe_connect_status === "active";

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: "payment",
      payment_method_types: ["card", "pix"],
      line_items: [{
        price_data: {
          currency: "brl",
          product_data: {
            name: weekLabel,
            description: `Aluguel semanal — ${tenant.name}`,
          },
          unit_amount: amountCents,
        },
        quantity: 1,
      }],
      customer_email: tenant.email ?? undefined,
      metadata: {
        invoice_id: invoiceId,
        tenant_id,
        client_id: tenant.client_id,
        source: "create-invoice",
      },
      success_url: `${appUrl}/portal/${tenant_id}?invoice=paid`,
      cancel_url: `${appUrl}/portal/${tenant_id}?invoice=cancelled`,
    };

    if (hasConnect) {
      sessionParams.payment_intent_data = {
        transfer_data: { destination: client!.stripe_account_id! },
      };
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    // ── 6. Salvar fatura no banco com ID pré-gerado ──────────────────────────
    const { error: invErr } = await supabase
      .from("invoices")
      .insert({
        id: invoiceId,
        client_id: tenant.client_id,
        tenant_id,
        stripe_session_id: session.id,
        amount: tenant.rent_weekly,
        status: "pending",
        payment_url: session.url,
        week_label: weekLabel,
        due_date: sun.toISOString().slice(0, 10),
      });

    if (invErr) {
      console.error("[create-invoice] Erro ao inserir fatura:", invErr.message);
      return json({ error: "Erro ao salvar fatura: " + invErr.message }, 500);
    }

    console.log(
      `[create-invoice] Fatura ${invoiceId} | tenant ${tenant_id} | ` +
      `R$${tenant.rent_weekly} | connect=${hasConnect} | session ${session.id}`
    );

    return json({ ok: true, invoice_id: invoiceId, payment_url: session.url });

  } catch (err) {
    console.error("[create-invoice] exception:", err);
    return json({ error: (err as Error).message }, 500);
  }
});
