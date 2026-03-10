/**
 * efi-webhook — Edge Function
 *
 * Recebe confirmações de pagamento PIX do Efí Bank (Gerencianet).
 * Quando o locatário paga, Efí Bank chama este endpoint automaticamente.
 * O sistema marca o pagamento como PAGO e notifica o dono no Telegram.
 *
 * POST /functions/v1/efi-webhook
 *
 * ── Configuração no Painel Efí Bank ─────────────────────────────────────────
 *  API → Webhook → Configurar URL:
 *  https://<ref>.supabase.co/functions/v1/efi-webhook
 *
 * ── Secrets necessários ──────────────────────────────────────────────────────
 *  EFI_WEBHOOK_SECRET   → Secret configurado no painel Efí para validação
 *  TELEGRAM_BOT_TOKEN   → Token do bot do Telegram
 *  SUPABASE_URL         → automático
 *  SUPABASE_SERVICE_ROLE_KEY → automático
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const SUPABASE_URL  = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BOT_TOKEN     = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
const WEBHOOK_SECRET = Deno.env.get("EFI_WEBHOOK_SECRET") ?? "";

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

const R$ = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2 });

// ── Notifica dono no Telegram ─────────────────────────────────────────────────
async function notifyOwner(chatId: string, msg: string, token?: string): Promise<void> {
  const tk = token || BOT_TOKEN;
  if (!tk || !chatId) return;
  await fetch(`https://api.telegram.org/bot${tk}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: msg, parse_mode: "HTML" }),
  }).catch(e => console.error("[efi-webhook] Telegram error:", e));
}

// ── Notifica locatário que pagamento foi confirmado ───────────────────────────
async function notifyTenant(chatId: string, tenantName: string, amount: number, weekLabel: string, token?: string): Promise<void> {
  const tk = token || BOT_TOKEN;
  if (!tk || !chatId) return;
  const firstName = tenantName.split(" ")[0];
  await fetch(`https://api.telegram.org/bot${tk}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: `✅ <b>Pagamento confirmado!</b>\n\nOlá, ${firstName}!\nSeu PIX de R$ ${R$(amount)} foi recebido com sucesso.\n\n📋 Referência: ${weekLabel}\n🏠 Obrigado pela pontualidade!`,
      parse_mode: "HTML",
    }),
  }).catch(e => console.error("[efi-webhook] Telegram tenant error:", e));
}

// ── Main ──────────────────────────────────────────────────────────────────────
serve(async (req) => {
  // Efí Bank envia GET para validar o endpoint na configuração
  if (req.method === "GET") {
    const challenge = new URL(req.url).searchParams.get("hub.challenge") ?? "ok";
    return new Response(challenge, { status: 200 });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // Validação do webhook secret (opcional mas recomendado)
  if (WEBHOOK_SECRET) {
    const providedSecret = req.headers.get("x-hub-secret") ?? req.headers.get("x-efi-secret") ?? "";
    if (providedSecret !== WEBHOOK_SECRET) {
      console.error("[efi-webhook] Secret inválido");
      return new Response("Unauthorized", { status: 401 });
    }
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return new Response("Invalid JSON", { status: 400 }); }

  console.log("[efi-webhook] payload:", JSON.stringify(body));

  // Estrutura do webhook Efí Bank:
  // { pix: [{ endToEndId, txid, chave, valor, horario, gnExtras, infoPagador }] }
  const pixEvents = (body.pix as any[]) ?? [];

  for (const pix of pixEvents) {
    const txid   = pix.txid;
    const valor  = Number(pix.valor ?? 0);
    const horario = pix.horario ?? new Date().toISOString();

    if (!txid) continue;

    console.log(`[efi-webhook] Confirmando txid=${txid} valor=R$${valor}`);

    // Busca o pagamento pelo txid
    const { data: payment, error: payErr } = await sb
      .from("payments")
      .select(`
        id, value_amount, week_label, paid_status, tenant_id, client_id,
        tenants (id, name, telegram_chat_id),
        clients!inner (id, telegram_chat_id, name, telegram_bot_token)
      `)
      .eq("pix_txid", txid)
      .maybeSingle();

    if (payErr || !payment) {
      console.error(`[efi-webhook] Pagamento não encontrado para txid=${txid}`);
      continue;
    }

    if (payment.paid_status) {
      console.log(`[efi-webhook] Pagamento ${payment.id} já marcado como pago. Ignorando.`);
      continue;
    }

    const tenant = (payment as any).tenants;
    const client = (payment as any).clients;

    // Marca como pago
    const { error: updateErr } = await sb.from("payments").update({
      paid_status:  true,
      paid_date:    horario.slice(0, 10),
      pix_paid_at:  horario,
      payment_method: "Pix",
    }).eq("id", payment.id);

    if (updateErr) {
      console.error(`[efi-webhook] Erro ao atualizar pagamento ${payment.id}:`, updateErr.message);
      continue;
    }

    console.log(`[efi-webhook] ✅ Pagamento ${payment.id} marcado como PAGO — txid=${txid}`);

    // Notifica dono no Telegram
    if (client?.telegram_chat_id) {
      const tenantName   = tenant?.name ?? "Locatário";
      const weekLabel    = payment.week_label ?? "Aluguel semanal";
      const valorStr     = R$(Number(payment.value_amount));
      const paidHorario  = new Date(horario).toLocaleString("pt-BR", {
        timeZone: "America/Sao_Paulo",
        day: "2-digit", month: "2-digit",
        hour: "2-digit", minute: "2-digit",
      });

      await notifyOwner(
        client.telegram_chat_id,
        `💸 <b>PIX RECEBIDO!</b>\n\n` +
        `👤 <b>${tenantName}</b> pagou R$ ${valorStr}\n` +
        `📋 ${weekLabel}\n` +
        `🕐 ${paidHorario}\n\n` +
        `Caixa atualizado automaticamente. ✅`,
        client.telegram_bot_token ?? undefined,
      );
    }

    // Confirma para o locatário
    if (tenant?.telegram_chat_id) {
      await notifyTenant(
        tenant.telegram_chat_id,
        tenant.name,
        Number(payment.value_amount),
        payment.week_label ?? "Aluguel semanal",
        client?.telegram_bot_token ?? undefined,
      );
    }
  }

  return new Response("ok", { status: 200 });
});
