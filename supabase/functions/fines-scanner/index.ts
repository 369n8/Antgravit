/**
 * fines-scanner — Edge Function (Cron Job)
 *
 * Roda diariamente. Para cada cliente com scan_enabled=true:
 *   1. Busca veículos ativos
 *   2. Chama o Mock do Detran (30% chance de multa por veículo)
 *   3. Injeta no fines-webhook para provar o fluxo ponta-a-ponta
 *   4. Atualiza fleet_settings.last_scan_at
 *
 * Para plugar API real: trocar mockDetranScan() por chamada HTTP ao provedor.
 *
 * Schedule: diário às 03:00 BRT (06:00 UTC)
 * POST /functions/v1/fines-scanner  (sem body — disparado pelo cron)
 */
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WEBHOOK_SECRET = Deno.env.get("FINES_WEBHOOK_SECRET") ?? "mock-secret-dev";

const sb = createClient(SUPABASE_URL, SERVICE_KEY);

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Mock Detran ──────────────────────────────────────────────────────────────
// Simula o retorno de uma API externa de consulta de infrações.
// Retorna array de infrações (pode ser vazio).
// SUBSTITUIR AQUI pela chamada real ao provedor quando assinar o serviço.
interface Infraction {
  infraction_date: string;
  amount: number;
  description: string;
  infraction_code: string;
}

const FAKE_DESCRIPTIONS = [
  ["Excesso de velocidade até 20% acima do limite", "501-23", 130.16],
  ["Excesso de velocidade de 20% a 50% acima do limite", "501-23", 195.23],
  ["Avançar sinal vermelho", "208-VII", 293.47],
  ["Ultrapassagem indevida", "214-V", 195.23],
  ["Uso do celular ao volante", "252-XI", 293.47],
  ["Estacionamento proibido", "181-VII", 195.23],
  ["Veículo sem habilitação", "162-II", 880.41],
  ["Faixa exclusiva de ônibus", "185-IV", 195.23],
];

function mockDetranScan(plate: string): Infraction[] {
  // 30% chance de ter infração por consulta
  if (Math.random() > 0.30) return [];

  const [description, code, amount] = FAKE_DESCRIPTIONS[
    Math.floor(Math.random() * FAKE_DESCRIPTIONS.length)
  ];

  // Data aleatória nos últimos 45 dias
  const daysAgo = Math.floor(Math.random() * 45) + 1;
  const date = new Date(Date.now() - daysAgo * 86400000);
  const infraction_date = date.toISOString();

  console.log(`[mock] Infração gerada para placa ${plate}: ${description} R$${amount}`);

  return [{
    infraction_date,
    amount: amount as number,
    description: description as string,
    infraction_code: code as string,
  }];
}
// ─────────────────────────────────────────────────────────────────────────────

async function callFinesWebhook(vehicle_id: string, infraction: Infraction): Promise<boolean> {
  const webhookUrl = `${SUPABASE_URL}/functions/v1/fines-webhook`;

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-webhook-secret": WEBHOOK_SECRET,
      "Authorization": `Bearer ${SERVICE_KEY}`,
    },
    body: JSON.stringify({
      vehicle_id,
      infraction_date: infraction.infraction_date,
      amount: infraction.amount,
      description: infraction.description,
      infraction_code: infraction.infraction_code,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`[webhook] Falhou para vehicle ${vehicle_id}: ${res.status} — ${body}`);
    return false;
  }

  const data = await res.json();
  console.log(`[webhook] OK — fine_id: ${data.fine_id}, tenant: ${data.tenant_id ?? "não atribuído"}`);
  return true;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }
  const startedAt = new Date().toISOString();
  const results: Record<string, unknown>[] = [];

  try {
    // 1. Buscar todos os clientes com scan habilitado
    const { data: settings, error: sErr } = await sb
      .from("fleet_settings")
      .select("client_id, document, api_provider")
      .eq("scan_enabled", true);

    if (sErr) throw sErr;

    if (!settings?.length) {
      return new Response(
        JSON.stringify({ ok: true, message: "Nenhum cliente com scan habilitado.", started_at: startedAt }),
        { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    // 2. Para cada cliente, buscar veículos ativos
    for (const cfg of settings) {
      const { data: vehicles } = await sb
        .from("vehicles")
        .select("id, plate, brand, model")
        .eq("client_id", cfg.client_id)
        .eq("status", "locado");   // só veículos em uso

      if (!vehicles?.length) continue;

      let finesFound = 0;

      for (const veh of vehicles) {
        // 3. Consultar Mock (ou API real no futuro)
        const infractions = mockDetranScan(veh.plate);

        for (const infraction of infractions) {
          const ok = await callFinesWebhook(veh.id, infraction);
          if (ok) finesFound++;
        }
      }

      // 4. Atualizar last_scan_at
      await sb
        .from("fleet_settings")
        .update({ last_scan_at: new Date().toISOString() })
        .eq("client_id", cfg.client_id);

      results.push({
        client_id: cfg.client_id,
        vehicles_scanned: vehicles.length,
        fines_found: finesFound,
      });

      console.log(`[scanner] client=${cfg.client_id} veículos=${vehicles.length} multas=${finesFound}`);
    }

    return new Response(
      JSON.stringify({ ok: true, started_at: startedAt, results }),
      { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("[scanner] Erro:", err);
    return new Response(
      JSON.stringify({ ok: false, error: String(err), started_at: startedAt }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }
});
