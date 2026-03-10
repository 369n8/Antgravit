/**
 * reminder-bot — Edge Function (Cron)
 *
 * Roda toda sexta-feira às 09:00 (America/Sao_Paulo).
 * Avisa via Telegram APENAS os locatários que ainda não pagaram a semana corrente.
 *
 * Lógica:
 *  - Busca payments da semana com paid_status = false
 *  - Envia mensagem no Telegram de cada locatário com o código PIX (se disponível)
 *  - Envia resumo para o dono: "X de Y ainda não pagaram"
 *
 * POST /functions/v1/reminder-bot
 *
 * ── Secrets ──────────────────────────────────────────────────────────────────
 *  TELEGRAM_BOT_TOKEN
 *  SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY → automáticos
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BOT_TOKEN    = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

function getWeekStart(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  return monday.toISOString().slice(0, 10);
}

function getWeekEnd(weekStart: string): string {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + 6);
  return d.toISOString().slice(0, 10);
}

function fmtShort(d: string) {
  const [, m, day] = d.split("-");
  return `${day}/${m}`;
}

async function tgSend(chatId: string, text: string, token?: string) {
  const tk = token || BOT_TOKEN;
  if (!tk || !chatId) return;
  await fetch(`https://api.telegram.org/bot${tk}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  }).catch(e => console.error("[reminder-bot] Telegram error:", e));
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok");
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  const weekStart = getWeekStart();
  const weekEnd   = getWeekEnd(weekStart);
  const weekLabel = `Semana ${fmtShort(weekStart)}–${fmtShort(weekEnd)}`;

  console.log(`[reminder-bot] Iniciando lembretes para ${weekLabel}`);

  // Busca pagamentos pendentes da semana com dados do locatário e dono
  const { data: pendingPayments, error } = await sb
    .from("payments")
    .select(`
      id, value_amount, week_label, pix_copy_paste, tenant_id, client_id,
      tenants (id, name, telegram_chat_id),
      clients!inner (id, telegram_chat_id, telegram_bot_token)
    `)
    .eq("paid_status", false)
    .eq("week_start", weekStart);

  if (error) {
    console.error("[reminder-bot] Erro ao buscar pagamentos:", error.message);
    return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 500 });
  }

  if (!pendingPayments?.length) {
    console.log("[reminder-bot] Nenhum pagamento pendente esta semana 🎉");
    return new Response(JSON.stringify({ ok: true, notified: 0, message: "Todos pagaram!" }));
  }

  console.log(`[reminder-bot] ${pendingPayments.length} pagamentos pendentes`);

  // Agrupa por client para resumo do dono
  const clientSummary: Record<string, { chat_id: string; bot_token: string; pending: string[]; total: number }> = {};
  let notified = 0;

  for (const pay of pendingPayments) {
    const tenant = (pay as any).tenants;
    const client = (pay as any).clients;

    if (!clientSummary[pay.client_id]) {
      clientSummary[pay.client_id] = {
        chat_id:   client?.telegram_chat_id ?? "",
        bot_token: client?.telegram_bot_token ?? "",
        pending:   [],
        total:     0,
      };
    }
    clientSummary[pay.client_id].pending.push(tenant?.name ?? "Locatário");
    clientSummary[pay.client_id].total += Number(pay.value_amount || 0);

    // Notifica o locatário (se tem Telegram vinculado)
    if (tenant?.telegram_chat_id) {
      const amountStr = Number(pay.value_amount || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 });
      const firstName = (tenant.name as string).split(" ")[0];

      let msg = `⏰ <b>Lembrete de Pagamento</b>\n\n` +
        `Olá, ${firstName}! Seu aluguel semanal vence amanhã.\n\n` +
        `📋 <b>${weekLabel}</b>\n` +
        `💵 <b>R$ ${amountStr}</b>\n\n`;

      if (pay.pix_copy_paste) {
        msg += `Use o código PIX abaixo para pagar:\n<code>${pay.pix_copy_paste}</code>\n\n`;
        msg += `Ou acesse seu portal para escanear o QR Code.`;
      } else {
        msg += `Acesse seu portal para pagar via PIX.`;
      }

      await tgSend(tenant.telegram_chat_id, msg, clientSummary[pay.client_id]?.bot_token || undefined);
      notified++;
      console.log(`[reminder-bot] Lembrete enviado para ${tenant.name}`);
    }
  }

  // Resume o dono
  for (const [, summary] of Object.entries(clientSummary)) {
    if (!summary.chat_id) continue;

    const total = pendingPayments.filter(p => {
      const c = (p as any).clients;
      return c?.telegram_chat_id === summary.chat_id;
    }).length;

    const valorStr = summary.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 });
    const list = summary.pending.slice(0, 10).map(n => `• ${n}`).join("\n");
    const extra = summary.pending.length > 10 ? `\n+ ${summary.pending.length - 10} outros` : "";

    const msg = `🔔 <b>Lembretes enviados!</b>\n\n` +
      `${total} locatário${total > 1 ? "s" : ""} ainda não pagou${total > 1 ? "ram" : ""} ${weekLabel}:\n\n` +
      `${list}${extra}\n\n` +
      `💰 Total em aberto: R$ ${valorStr}`;

    await tgSend(summary.chat_id, msg, summary.bot_token || undefined);
  }

  const result = { ok: true, weekLabel, notified, pending: pendingPayments.length };
  console.log("[reminder-bot] Concluído:", result);
  return new Response(JSON.stringify(result), { headers: { "Content-Type": "application/json" } });
});
