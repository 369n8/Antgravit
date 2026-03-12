/**
 * daily-expiry-check — Edge Function
 * Roda diariamente às 07:30 BRT (10:30 UTC).
 * Verifica: seguro (<30 dias), IPVA (mês seguinte), CNH (<15 dias), bateria (<30 dias).
 * Evita duplicatas via alert_sent_log.
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

function ptDate(d: string): string {
  const [y, m, day] = d.slice(0, 10).split("-");
  return `${day}/${m}/${y}`;
}

function daysUntil(d: string): number {
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
}

async function tgSend(chatId: string, text: string): Promise<void> {
  if (!BOT_TOKEN || !chatId) return;
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  });
}

async function alreadySent(clientId: string, alertType: string, refDate: string): Promise<boolean> {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await sb
    .from("alert_sent_log")
    .select("id")
    .eq("client_id", clientId)
    .eq("alert_type", alertType)
    .eq("reference_date", refDate)
    .gte("sent_at", today + "T00:00:00Z")
    .limit(1);
  return (data?.length ?? 0) > 0;
}

async function logAlert(clientId: string, alertType: string, refDate: string, vehicleId?: string, tenantId?: string): Promise<void> {
  await sb.from("alert_sent_log").insert({
    client_id: clientId,
    alert_type: alertType,
    reference_date: refDate,
    vehicle_id: vehicleId ?? null,
    tenant_id: tenantId ?? null,
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const today = new Date().toISOString().slice(0, 10);
    const in30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    const in15 = new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10);
    const nextMonthStart = (() => {
      const d = new Date();
      d.setMonth(d.getMonth() + 1);
      d.setDate(1);
      return d.toISOString().slice(0, 10);
    })();
    const nextMonthEnd = (() => {
      const d = new Date();
      d.setMonth(d.getMonth() + 2);
      d.setDate(0);
      return d.toISOString().slice(0, 10);
    })();

    // Buscar todos os clientes com telegram_chat_id
    const { data: clients } = await sb
      .from("clients")
      .select("id, name, telegram_chat_id")
      .not("telegram_chat_id", "is", null);

    let totalSent = 0;

    for (const client of clients ?? []) {
      if (!client.telegram_chat_id) continue;

      // 1. SEGURO — docs_seguro entre hoje e +30 dias
      const { data: segVehs } = await sb
        .from("vehicles")
        .select("id, plate, model, brand, docs_seguro")
        .eq("client_id", client.id)
        .gte("docs_seguro", today)
        .lte("docs_seguro", in30);

      for (const v of segVehs ?? []) {
        if (!v.docs_seguro) continue;
        const already = await alreadySent(client.id, "seguro", v.docs_seguro);
        if (already) continue;
        const days = daysUntil(v.docs_seguro);
        await tgSend(client.telegram_chat_id,
          `🛡️ <b>SEGURO VENCENDO EM ${days} DIA${days !== 1 ? "S" : ""}</b>\n\nVeículo: ${v.brand} ${v.model} — ${v.plate}\nVencimento: ${ptDate(v.docs_seguro)}\n\n👉 Acesse o app para renovar antes de vencer.`
        );
        await logAlert(client.id, "seguro", v.docs_seguro, v.id);
        totalSent++;
      }

      // 2. IPVA — docs_ipva no mês seguinte
      const { data: ipvaVehs } = await sb
        .from("vehicles")
        .select("id, plate, model, brand, docs_ipva")
        .eq("client_id", client.id)
        .gte("docs_ipva", nextMonthStart)
        .lte("docs_ipva", nextMonthEnd);

      for (const v of ipvaVehs ?? []) {
        if (!v.docs_ipva) continue;
        const already = await alreadySent(client.id, "ipva", v.docs_ipva);
        if (already) continue;
        await tgSend(client.telegram_chat_id,
          `📋 <b>IPVA PRÓXIMO</b>\n\nVeículo: ${v.brand} ${v.model} — ${v.plate}\nVencimento: ${ptDate(v.docs_ipva)}\n\n💡 Pague com desconto antes do vencimento.`
        );
        await logAlert(client.id, "ipva", v.docs_ipva, v.id);
        totalSent++;
      }

      // 3. CNH — cnh_expiry entre hoje e +15 dias
      const { data: tenants } = await sb
        .from("tenants")
        .select("id, name, cnh_expiry, vehicles(plate, model)")
        .eq("client_id", client.id)
        .eq("status", "ativo")
        .gte("cnh_expiry", today)
        .lte("cnh_expiry", in15);

      for (const t of tenants ?? []) {
        if (!t.cnh_expiry) continue;
        const already = await alreadySent(client.id, "cnh", t.cnh_expiry);
        if (already) continue;
        const days = daysUntil(t.cnh_expiry);
        const veh = Array.isArray(t.vehicles) ? t.vehicles[0] : t.vehicles;
        await tgSend(client.telegram_chat_id,
          `🪪 <b>CNH VENCENDO EM ${days} DIA${days !== 1 ? "S" : ""}</b>\n\nMotorista: ${t.name}\nVencimento: ${ptDate(t.cnh_expiry)}${veh ? `\nVeículo atual: ${veh.model} — ${veh.plate}` : ""}\n\n⚠️ Sem CNH válida, o seguro pode ser invalidado em caso de acidente.\nNotifique o motorista imediatamente.`
        );
        await logAlert(client.id, "cnh", t.cnh_expiry, undefined, t.id);
        totalSent++;
      }

      // 4. GARANTIA DE BATERIA — battery_warranty_until entre hoje e +30 dias
      const { data: batVehs } = await sb
        .from("vehicles")
        .select("id, plate, model, brand, battery_brand, battery_warranty_until")
        .eq("client_id", client.id)
        .gte("battery_warranty_until", today)
        .lte("battery_warranty_until", in30);

      for (const v of batVehs ?? []) {
        if (!v.battery_warranty_until) continue;
        const already = await alreadySent(client.id, "bateria", v.battery_warranty_until);
        if (already) continue;
        const days = daysUntil(v.battery_warranty_until);
        await tgSend(client.telegram_chat_id,
          `🔋 <b>GARANTIA DA BATERIA VENCENDO EM ${days} DIA${days !== 1 ? "S" : ""}</b>\n\nVeículo: ${v.brand} ${v.model} — ${v.plate}\nBateria: ${v.battery_brand || "não informada"}\nGarantia até: ${ptDate(v.battery_warranty_until)}\n\nSe a bateria falhar agora, você perde a garantia.`
        );
        await logAlert(client.id, "bateria", v.battery_warranty_until, v.id);
        totalSent++;
      }
    }

    return new Response(
      JSON.stringify({ ok: true, alerts_sent: totalSent, checked_at: new Date().toISOString() }),
      { headers: { ...CORS, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[daily-expiry-check]", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }
});
