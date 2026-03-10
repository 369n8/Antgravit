/**
 * scheduled-alerts — Edge Function
 *
 * MODO CRON (06:00 UTC diário):
 *   Varre todos os clientes e envia o briefing diário via Telegram.
 *
 * MODO MANUAL (UI → "Enviar Briefing Agora"):
 *   POST { manual_for_client: "<client_uuid>" }
 *   Envia o briefing só para aquele cliente.
 *
 * Cobre 5 categorias de alerta:
 *   1. Faturas em atraso (tabela invoices)
 *   2. Multas novas capturadas nas últimas 24h
 *   3. Vistorias pendentes de aprovação
 *   4. Seguros vencendo em ≤ 15 dias
 *   5. Documentos de veículo vencendo em ≤ 30 dias
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Helpers ───────────────────────────────────────────────────────────────────

function daysUntil(d: string): number {
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
}

function daysSince(d: string): number {
  return Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
}

function ptDate(d: string): string {
  const [y, m, day] = d.slice(0, 10).split("-");
  return `${day}/${m}/${y}`;
}

function fmtBRL(v: number | string | null): string {
  return Number(v ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 });
}

async function tgSend(chatId: string, text: string): Promise<void> {
  if (!BOT_TOKEN || !chatId) return;
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  });
  if (!res.ok) {
    console.error("[tgSend] error:", res.status, await res.text());
  }
}

// ── Construir briefing para um cliente ───────────────────────────────────────

async function buildAndSendBriefing(client: {
  id: string;
  name: string | null;
  telegram_chat_id: string | null;
}): Promise<number> {
  if (!client.telegram_chat_id) return 0;

  const today = new Date().toISOString().slice(0, 10);
  const since24h = new Date(Date.now() - 86400000).toISOString();
  const in15days = new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10);

  // Buscar dados em paralelo
  const [invRes, finesNewRes, finesAllRes, inspRes, insRes] = await Promise.all([
    // 1. Faturas em atraso
    sb.from("invoices")
      .select("id, amount, week_label, due_date, tenant_id, tenants(name)")
      .eq("client_id", client.id)
      .in("status", ["pending", "overdue"])
      .lt("due_date", today)
      .order("due_date", { ascending: true }),

    // 2. Multas novas nas últimas 24h
    sb.from("fines")
      .select("id, amount, description, vehicles(plate, brand, model), tenants!fines_tenant_id_fkey(name)")
      .eq("client_id", client.id)
      .eq("status", "pendente")
      .gte("created_at", since24h),

    // 3. Total de multas pendentes (para contexto)
    sb.from("fines")
      .select("id", { count: "exact", head: true })
      .eq("client_id", client.id)
      .eq("status", "pendente"),

    // 4. Vistorias aguardando aprovação
    sb.from("weekly_inspections")
      .select("id, current_km, created_at, tenants(name)")
      .eq("status", "pending"),

    // 5. Seguros vencendo
    sb.from("insurance")
      .select("expiry_date, insurer, vehicles(plate, brand, model)")
      .eq("client_id", client.id)
      .gte("expiry_date", today)
      .lte("expiry_date", in15days)
      .order("expiry_date"),
  ]);

  const overdueInvoices = invRes.data ?? [];
  const newFines = finesNewRes.data ?? [];
  const totalPendFines = finesAllRes.count ?? 0;
  const inspections = inspRes.data ?? [];
  const insurance = insRes.data ?? [];

  // Sem nada relevante? Não envia
  const hasAlerts = overdueInvoices.length > 0 || newFines.length > 0 || inspections.length > 0 || insurance.length > 0;

  const weekday = new Date().toLocaleDateString("pt-BR", { weekday: "long", timeZone: "America/Sao_Paulo" });
  const dateStr = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });
  const nome = client.name?.split(" ")[0] ?? "Chefe";

  const lines: string[] = [];

  // ── Header ──
  if (hasAlerts) {
    lines.push(`🌅 <b>Bom dia, ${nome}!</b>`);
    lines.push(`📅 <i>${weekday.charAt(0).toUpperCase() + weekday.slice(1)}, ${dateStr}</i>`);
  } else {
    lines.push(`✅ <b>Bom dia, ${nome}!</b>`);
    lines.push(`📅 <i>${weekday.charAt(0).toUpperCase() + weekday.slice(1)}, ${dateStr}</i>`);
    lines.push("");
    lines.push("Sua operação está limpa hoje. Sem pendências críticas. 🎉");
    lines.push("");
    lines.push("Use /resumo a qualquer hora para verificar.");
    await tgSend(client.telegram_chat_id, lines.join("\n"));
    return 0;
  }

  lines.push("");

  // ── Faturas em atraso ──
  if (overdueInvoices.length > 0) {
    const totalDue = overdueInvoices.reduce((s, i) => s + Number(i.amount ?? 0), 0);
    lines.push(`💰 <b>CAIXA — ${overdueInvoices.length} fatura(s) em atraso (R$ ${fmtBRL(totalDue)})</b>`);
    for (const inv of overdueInvoices.slice(0, 5)) {
      const t = (inv as any).tenants;
      const days = inv.due_date ? daysSince(inv.due_date) : 0;
      lines.push(`  • <b>${t?.name ?? "Motorista"}</b> · R$ ${fmtBRL(inv.amount)} · ${days}d de atraso`);
    }
    if (overdueInvoices.length > 5) lines.push(`  + ${overdueInvoices.length - 5} mais...`);
    lines.push("");
  }

  // ── Multas novas (24h) ──
  if (newFines.length > 0) {
    lines.push(`🚨 <b>MULTAS — ${newFines.length} nova(s) capturada(s) na madrugada</b>`);
    for (const f of newFines.slice(0, 4)) {
      const veh = (f as any).vehicles;
      const ten = (f as any).tenants;
      const plate = veh?.plate ?? "—";
      const resp = ten?.name ? ` (resp: ${ten.name.split(" ")[0]})` : "";
      lines.push(`  • ${plate} · R$ ${fmtBRL(f.amount)}${resp}`);
    }
    if (totalPendFines > newFines.length) {
      lines.push(`  📋 Total pendentes: ${totalPendFines} multa(s)`);
    }
    lines.push("");
  }

  // ── Vistorias ──
  if (inspections.length > 0) {
    lines.push(`📋 <b>VISTORIAS — ${inspections.length} aguardando sua aprovação</b>`);
    for (const insp of inspections.slice(0, 3)) {
      const t = (insp as any).tenants;
      const km = insp.current_km ? ` · ${Number(insp.current_km).toLocaleString("pt-BR")} km` : "";
      lines.push(`  • ${t?.name ?? "Motorista"}${km}`);
    }
    if (inspections.length > 3) lines.push(`  + ${inspections.length - 3} mais...`);
    lines.push("");
  }

  // ── Seguros ──
  if (insurance.length > 0) {
    lines.push(`🛡️ <b>SEGUROS vencendo em breve</b>`);
    for (const ins of insurance) {
      const veh = (ins as any).vehicles;
      const days = daysUntil(ins.expiry_date);
      const emoji = days <= 3 ? "🔴" : days <= 7 ? "🟡" : "🟢";
      const plate = veh?.plate ?? "—";
      lines.push(`  ${emoji} ${plate} · ${ins.insurer ?? "Seguro"} · ${days}d (${ptDate(ins.expiry_date)})`);
    }
    lines.push("");
  }

  // ── Footer ──
  lines.push("━━━━━━━━━━━━━━━━━");
  lines.push("💬 <i>Comandos: /resumo /multas /inadimplentes /vistorias /vencimentos</i>");

  await tgSend(client.telegram_chat_id, lines.join("\n"));
  return overdueInvoices.length + newFines.length + inspections.length + insurance.length;
}

// ── Main handler ──────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }
  const CORS = { "Content-Type": "application/json" };

  try {
    // Suporte a trigger manual (UI "Enviar Briefing Agora")
    let manualClientId: string | null = null;
    if (req.method === "POST") {
      try {
        const body = await req.json().catch(() => ({}));
        manualClientId = body?.manual_for_client ?? null;
      } catch (_) { /* ignore */ }
    }

    // Buscar clientes (todos ou só o solicitado)
    let query = sb.from("clients").select("id, name, telegram_chat_id");
    if (manualClientId) {
      query = query.eq("id", manualClientId) as typeof query;
    }
    const { data: clients, error: cErr } = await query;
    if (cErr) throw cErr;

    if (!clients?.length) {
      return new Response(JSON.stringify({ ok: true, message: "Nenhum cliente." }), {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
      });
    }

    let totalAlerts = 0;
    for (const client of clients) {
      try {
        const n = await buildAndSendBriefing(client as any);
        totalAlerts += n;
      } catch (err) {
        console.error(`[scheduled-alerts] Erro cliente ${client.id}:`, err);
      }
    }

    return new Response(
      JSON.stringify({ ok: true, clients_notified: clients.length, totalAlerts, manual: !!manualClientId }),
      { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[scheduled-alerts] exception:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
    });
  }
});
