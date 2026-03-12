/**
 * check-weekly-video-deadline
 * Roda segunda-feira às 09:00 (via cron) ou chamada manual.
 * Verifica motoristas sem vistoria semanal enviada e alerta o dono via Telegram.
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
const ADMIN_TELEGRAM_ID = Deno.env.get("ADMIN_TELEGRAM_ID") ?? "";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

function getWeekStart(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  return monday.toISOString().slice(0, 10);
}

async function tgSend(chatId: string, text: string): Promise<void> {
  if (!BOT_TOKEN || !chatId) return;
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });

  try {
    const weekStart = getWeekStart();

    // Buscar todos os locatários ativos com veículo alocado
    const { data: tenants, error: tErr } = await sb
      .from("tenants")
      .select("id, name, vehicle_id, client_id, clients(telegram_chat_id, name, email)")
      .eq("status", "ativo");

    if (tErr) throw tErr;

    // Buscar vistorias desta semana
    const { data: submitted } = await sb
      .from("weekly_inspections")
      .select("tenant_id")
      .eq("week_start", weekStart);

    const submittedIds = new Set((submitted || []).map((s: any) => s.tenant_id));

    // Buscar donos (clients) para notificar
    const { data: clients } = await sb
      .from("clients")
      .select("id, name, telegram_chat_id");

    const clientMap = new Map((clients || []).map((c: any) => [c.id, c]));

    let alertCount = 0;
    const pendingByOwner: Record<string, string[]> = {};

    for (const tenant of tenants || []) {
      if (submittedIds.has(tenant.id)) continue; // Já enviou

      const owner = clientMap.get(tenant.client_id);
      if (!owner?.telegram_chat_id) continue;

      if (!pendingByOwner[owner.telegram_chat_id]) {
        pendingByOwner[owner.telegram_chat_id] = [];
      }
      pendingByOwner[owner.telegram_chat_id].push(tenant.name || "Motorista sem nome");
    }

    // Enviar alertas agrupados por dono
    for (const [chatId, names] of Object.entries(pendingByOwner)) {
      const list = names.map(n => `• ${n}`).join("\n");
      const msg = `⚠️ <b>CHECK-IN SEMANAL PENDENTE</b>\n\nOs seguintes motoristas ainda não enviaram a vistoria desta semana:\n\n${list}\n\n<i>Prazo: domingo 23:59</i>`;
      await tgSend(chatId, msg);
      alertCount++;
    }

    // Alerta pro admin também
    if (ADMIN_TELEGRAM_ID && Object.keys(pendingByOwner).length > 0) {
      const total = Object.values(pendingByOwner).flat().length;
      await tgSend(ADMIN_TELEGRAM_ID, `📋 Check-in semanal: ${total} motorista(s) sem vistoria na semana de ${weekStart}`);
    }

    return new Response(
      JSON.stringify({ ok: true, alerts_sent: alertCount, week_start: weekStart }),
      { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[check-weekly-video-deadline]", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }
});
