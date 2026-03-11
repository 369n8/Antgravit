/**
 * weekly-billing — Edge Function (Cron)
 *
 * Roda toda segunda-feira às 06:00 (America/Sao_Paulo).
 * Para cada locatário ativo:
 *   1. Cria registro em payments para a semana corrente (se ainda não existe)
 *   2. Cria cobrança PIX via Efí Bank e salva QR Code no banco
 *   3. Ao final, envia UMA mensagem resumo para o dono no Telegram
 *
 * O locatário acessa o portal (link fixo) e vê o QR da semana — zero mensagens manuais.
 *
 * POST /functions/v1/weekly-billing
 * Invocado via pg_cron ou Supabase Dashboard → Scheduled Functions
 *
 * ── Secrets necessários ──────────────────────────────────────────────────────
 *  EFI_CLIENT_ID, EFI_CLIENT_SECRET, EFI_CERT_PEM, EFI_KEY_PEM, EFI_PIX_KEY
 *  EFI_SANDBOX          → "true" para sandbox
 *  TELEGRAM_BOT_TOKEN
 *  SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY → automáticos
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const SUPABASE_URL  = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BOT_TOKEN     = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
const EFI_CLIENT_ID     = Deno.env.get("EFI_CLIENT_ID") ?? "";
const EFI_CLIENT_SECRET = Deno.env.get("EFI_CLIENT_SECRET") ?? "";
const EFI_CERT_PEM      = Deno.env.get("EFI_CERT_PEM") ?? "";
const EFI_KEY_PEM       = Deno.env.get("EFI_KEY_PEM") ?? "";
const EFI_PIX_KEY       = Deno.env.get("EFI_PIX_KEY") ?? "";
const EFI_SANDBOX       = Deno.env.get("EFI_SANDBOX") === "true";

const EFI_BASE = EFI_SANDBOX
  ? "https://pix-h.api.efipay.com.br"
  : "https://pix.api.efipay.com.br";

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Retorna a segunda-feira da semana corrente (YYYY-MM-DD) */
function getWeekStart(): string {
  const now = new Date();
  const day = now.getDay(); // 0=dom, 1=seg...
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  return monday.toISOString().slice(0, 10);
}

/** Retorna o domingo da semana corrente (YYYY-MM-DD) */
function getWeekEnd(weekStart: string): string {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + 6);
  return d.toISOString().slice(0, 10);
}

/** Formata "2026-03-09" → "09/03" */
function fmtShort(d: string) {
  const [y, m, day] = d.split("-");
  return `${day}/${m}`;
}

/** Gera txid único 32 chars */
function generateTxid(): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  return Array.from({ length: 32 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

// ── Efí Bank ──────────────────────────────────────────────────────────────────

function createEfiHttpClient(): Deno.HttpClient | null {
  if (!EFI_CERT_PEM || !EFI_KEY_PEM) return null;
  try {
    return Deno.createHttpClient({ certChain: EFI_CERT_PEM, privateKey: EFI_KEY_PEM });
  } catch {
    return null;
  }
}

async function getEfiToken(httpClient: Deno.HttpClient | null): Promise<string> {
  const credentials = btoa(`${EFI_CLIENT_ID}:${EFI_CLIENT_SECRET}`);
  const opts: RequestInit & { client?: Deno.HttpClient } = {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Basic ${credentials}` },
    body: JSON.stringify({ grant_type: "client_credentials" }),
  };
  if (httpClient) opts.client = httpClient;
  const res = await fetch(`${EFI_BASE}/oauth/token`, opts);
  if (!res.ok) throw new Error(`Efí OAuth falhou (${res.status}): ${await res.text()}`);
  return (await res.json()).access_token;
}

async function createPixCharge(
  token: string,
  txid: string,
  amount: number,
  tenantName: string,
  tenantCpf: string | null,
  weekLabel: string,
  httpClient: Deno.HttpClient | null,
): Promise<{ qrcode_image: string; pix_copy_paste: string; expires_at: string }> {
  const body: Record<string, unknown> = {
    calendario: { expiracao: 60 * 60 * 24 * 7 }, // 7 dias
    valor: { original: amount.toFixed(2) },
    chave: EFI_PIX_KEY,
    solicitacaoPagador: `Aluguel ${weekLabel}`,
  };
  if (tenantCpf) body.devedor = { cpf: tenantCpf.replace(/\D/g, ""), nome: tenantName };

  const putOpts: RequestInit & { client?: Deno.HttpClient } = {
    method: "PUT",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
    body: JSON.stringify(body),
  };
  if (httpClient) putOpts.client = httpClient;

  const cobRes = await fetch(`${EFI_BASE}/v2/cob/${txid}`, putOpts);
  if (!cobRes.ok) throw new Error(`Criar PIX falhou (${cobRes.status}): ${await cobRes.text()}`);
  const cob = await cobRes.json();
  const locId = cob.loc?.id;
  if (!locId) throw new Error("locId não retornado pela Efí Bank");

  const qrOpts: RequestInit & { client?: Deno.HttpClient } = {
    headers: { "Authorization": `Bearer ${token}` },
  };
  if (httpClient) qrOpts.client = httpClient;

  const qrRes = await fetch(`${EFI_BASE}/v2/loc/${locId}/qrcode`, qrOpts);
  if (!qrRes.ok) throw new Error(`QR Code falhou (${qrRes.status}): ${await qrRes.text()}`);
  const qr = await qrRes.json();

  return {
    qrcode_image: qr.imagemQrcode,
    pix_copy_paste: qr.qrcode,
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  };
}

// ── Telegram ──────────────────────────────────────────────────────────────────

async function tgSend(chatId: string, text: string, token?: string) {
  const tk = token || BOT_TOKEN;
  if (!tk || !chatId) return;
  await fetch(`https://api.telegram.org/bot${tk}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  }).catch(e => console.error("[weekly-billing] Telegram error:", e));
}

// ── Main ──────────────────────────────────────────────────────────────────────

serve(async (req) => {
  // Cron / dashboard chama via POST sem body, ou com { dry_run: true }
  if (req.method === "OPTIONS") return new Response("ok");
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  let dryRun = false;
  try {
    const b = await req.json();
    dryRun = b?.dry_run === true;
  } catch { /* sem body */ }

  const weekStart = getWeekStart();
  const weekEnd   = getWeekEnd(weekStart);
  const weekLabel = `Semana ${fmtShort(weekStart)}–${fmtShort(weekEnd)}`;

  console.log(`[weekly-billing] Iniciando ${dryRun ? "(DRY RUN) " : ""}para ${weekLabel}`);

  // Busca todos os locatários ativos (por client)
  const { data: tenants, error: tErr } = await sb
    .from("tenants")
    .select("id, name, cpf, rent_weekly, client_id, payment_day, telegram_chat_id")
    .eq("status", "ativo")
    .not("rent_weekly", "is", null)
    .gt("rent_weekly", 0);

  if (tErr || !tenants?.length) {
    console.log("[weekly-billing] Nenhum locatário ativo encontrado:", tErr?.message);
    return new Response(JSON.stringify({ ok: true, processed: 0 }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  console.log(`[weekly-billing] ${tenants.length} locatários ativos`);

  // Verifica credenciais Efí
  const hasEfi = !!(EFI_CLIENT_ID && EFI_CLIENT_SECRET && EFI_PIX_KEY);
  const httpClient = hasEfi ? createEfiHttpClient() : null;
  let efiToken: string | null = null;

  if (hasEfi && !dryRun) {
    try {
      efiToken = await getEfiToken(httpClient);
      console.log("[weekly-billing] Token Efí Bank obtido");
    } catch (e) {
      console.error("[weekly-billing] Falha ao obter token Efí:", (e as Error).message);
    }
  }

  // Resultados por client (dono)
  const clientSummary: Record<string, { ok: number; skip: number; fail: number; chat_id: string; bot_token: string }> = {};
  let globalOk = 0, globalSkip = 0, globalFail = 0;

  for (const tenant of tenants) {
    const clientId = tenant.client_id;
    if (!clientSummary[clientId]) {
      // Busca telegram do dono
      const { data: cl } = await sb.from("clients").select("telegram_chat_id, telegram_bot_token").eq("id", clientId).maybeSingle();
      clientSummary[clientId] = { ok: 0, skip: 0, fail: 0, chat_id: cl?.telegram_chat_id ?? "", bot_token: cl?.telegram_bot_token ?? "" };
    }

    // Verifica se já existe pagamento para esta semana
    const { data: existing } = await sb
      .from("payments")
      .select("id, paid_status, pix_copy_paste, pix_charge_id")
      .eq("tenant_id", tenant.id)
      .eq("week_start", weekStart)
      .maybeSingle();

    if (existing?.paid_status) {
      console.log(`[weekly-billing] ${tenant.name}: semana já paga — skip`);
      clientSummary[clientId].skip++;
      globalSkip++;
      continue;
    }

    if (existing?.pix_charge_id) {
      console.log(`[weekly-billing] ${tenant.name}: QR já gerado para semana — skip`);
      clientSummary[clientId].skip++;
      globalSkip++;
      continue;
    }

    if (dryRun) {
      console.log(`[weekly-billing] DRY RUN: criaria pagamento para ${tenant.name}`);
      clientSummary[clientId].ok++;
      globalOk++;
      continue;
    }

    try {
      let paymentId: string;

      if (existing) {
        // Já tem registro mas sem PIX
        paymentId = existing.id;
      } else {
        // Cria registro de pagamento
        const { data: newPay, error: payErr } = await sb.from("payments").insert({
          tenant_id:    tenant.id,
          client_id:    clientId,
          value_amount: tenant.rent_weekly,
          due_date:     weekEnd,
          week_start:   weekStart,
          week_label:   weekLabel,
          paid_status:  false,
          payment_method: "Pix",
        }).select("id").single();

        if (payErr || !newPay) throw new Error(`Insert payment falhou: ${payErr?.message}`);
        paymentId = newPay.id;
      }

      // Gera PIX se tiver Efí configurado
      if (efiToken) {
        const txid = generateTxid();
        const { qrcode_image, pix_copy_paste, expires_at } = await createPixCharge(
          efiToken, txid, tenant.rent_weekly, tenant.name, tenant.cpf ?? null, weekLabel, httpClient,
        );

        await sb.from("payments").update({
          pix_txid:       txid,
          pix_charge_id:  txid,
          pix_qr_code:    qrcode_image,
          pix_copy_paste: pix_copy_paste,
          pix_expires_at: expires_at,
        }).eq("id", paymentId);

        console.log(`[weekly-billing] ✅ ${tenant.name}: PIX criado txid=${txid}`);
      } else {
        console.log(`[weekly-billing] ✅ ${tenant.name}: payment criado (sem PIX — Efí não configurado)`);
      }

      clientSummary[clientId].ok++;
      globalOk++;

    } catch (err) {
      console.error(`[weekly-billing] ❌ ${tenant.name}:`, (err as Error).message);
      clientSummary[clientId].fail++;
      globalFail++;
    }
  }

  // Envia resumo para cada dono no Telegram
  if (!dryRun) {
    for (const [clientId, summary] of Object.entries(clientSummary)) {
      if (!summary.chat_id) continue;

      const total = summary.ok + summary.skip + summary.fail;
      const valorTotal = tenants
        .filter(t => t.client_id === clientId)
        .reduce((acc, t) => acc + (t.rent_weekly || 0), 0);

      const lines = [
        `📅 <b>Cobrança Semanal Gerada</b>`,
        `<b>${weekLabel}</b>`,
        ``,
        `✅ Cobranças criadas: <b>${summary.ok}</b>`,
        summary.skip > 0 ? `⏭ Já processados: ${summary.skip}` : null,
        summary.fail > 0 ? `❌ Falhas: ${summary.fail}` : null,
        ``,
        `💰 Total esperado: <b>R$ ${valorTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</b>`,
        ``,
        `Os locatários veem o QR Code no portal (link fixo). Você receberá confirmação a cada pagamento. ✅`,
      ].filter(l => l !== null).join("\n");

      await tgSend(summary.chat_id, lines, summary.bot_token || undefined);
    }
  }

  const result = { ok: true, weekLabel, processed: globalOk, skipped: globalSkip, failed: globalFail };
  console.log("[weekly-billing] Concluído:", result);
  return new Response(JSON.stringify(result), { headers: { "Content-Type": "application/json" } });
});
