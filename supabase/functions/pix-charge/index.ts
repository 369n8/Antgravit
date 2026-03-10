/**
 * pix-charge — Edge Function
 *
 * Cria uma cobrança PIX via Efí Bank (Gerencianet), salva QR Code no banco
 * e envia o código PIX para o Telegram do locatário.
 *
 * POST /functions/v1/pix-charge
 * Header: Authorization: Bearer <supabase_anon_key>
 * Body: { payment_id: string }
 *
 * ── Secrets necessários (Supabase Dashboard → Edge Functions → Secrets) ──────
 *  EFI_CLIENT_ID        → Client ID da aplicação Efí Bank
 *  EFI_CLIENT_SECRET    → Client Secret da aplicação Efí Bank
 *  EFI_CERT_PEM         → Certificado .pem (conteúdo, não path)
 *  EFI_KEY_PEM          → Chave privada .pem (conteúdo, não path)
 *  EFI_PIX_KEY          → Chave PIX do dono (CPF, CNPJ, email, telefone ou aleatória)
 *  EFI_SANDBOX          → "true" para sandbox, "false" para produção
 *  TELEGRAM_BOT_TOKEN   → Token do bot do Telegram
 *  SUPABASE_URL         → automático
 *  SUPABASE_SERVICE_ROLE_KEY → automático
 *
 * ── Como converter .p12 para PEM ─────────────────────────────────────────────
 *  openssl pkcs12 -in certificado.p12 -nokeys -out cert.pem
 *  openssl pkcs12 -in certificado.p12 -nocerts -nodes -out key.pem
 *  Copie o conteúdo de cada arquivo para os secrets acima.
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EFI_CLIENT_ID     = Deno.env.get("EFI_CLIENT_ID") ?? "";
const EFI_CLIENT_SECRET = Deno.env.get("EFI_CLIENT_SECRET") ?? "";
const EFI_CERT_PEM      = Deno.env.get("EFI_CERT_PEM") ?? "";
const EFI_KEY_PEM       = Deno.env.get("EFI_KEY_PEM") ?? "";
const EFI_PIX_KEY       = Deno.env.get("EFI_PIX_KEY") ?? "";
const EFI_SANDBOX       = Deno.env.get("EFI_SANDBOX") === "true";
const BOT_TOKEN         = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
const SUPABASE_URL      = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_KEY      = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// URLs Efí Bank
const EFI_BASE = EFI_SANDBOX
  ? "https://pix-h.api.efipay.com.br"
  : "https://pix.api.efipay.com.br";

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

const json = (payload: object, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

// ── Cria cliente HTTP com mTLS para Efí Bank ──────────────────────────────────
function createEfiClient(): Deno.HttpClient | null {
  if (!EFI_CERT_PEM || !EFI_KEY_PEM) return null;
  try {
    return Deno.createHttpClient({
      certChain: EFI_CERT_PEM,
      privateKey: EFI_KEY_PEM,
    });
  } catch (e) {
    console.error("[pix-charge] Erro ao criar cliente mTLS:", e);
    return null;
  }
}

// ── Obtém token OAuth2 do Efí Bank ────────────────────────────────────────────
async function getEfiToken(httpClient: Deno.HttpClient | null): Promise<string> {
  const credentials = btoa(`${EFI_CLIENT_ID}:${EFI_CLIENT_SECRET}`);

  const fetchOpts: RequestInit & { client?: Deno.HttpClient } = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Basic ${credentials}`,
    },
    body: JSON.stringify({ grant_type: "client_credentials" }),
  };

  if (httpClient) fetchOpts.client = httpClient;

  const res = await fetch(`${EFI_BASE}/oauth/token`, fetchOpts);

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Efí Bank OAuth falhou (${res.status}): ${err}`);
  }

  const data = await res.json();
  return data.access_token;
}

// ── Gera txid único (32 chars alfanuméricos) ──────────────────────────────────
function generateTxid(): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  return Array.from({ length: 32 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

// ── Cria cobrança PIX imediata no Efí Bank ────────────────────────────────────
async function createPixCharge(
  token: string,
  txid: string,
  amount: number,
  tenantName: string,
  tenantCpf: string | null,
  httpClient: Deno.HttpClient | null,
  paymentRef: string,
): Promise<{ qrcode_image: string; pix_copy_paste: string; charge_id: string; expires_at: string }> {

  // Expiração em 24h
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const body: Record<string, unknown> = {
    calendario: { expiracao: 86400 }, // 24h em segundos
    valor: { original: amount.toFixed(2) },
    chave: EFI_PIX_KEY,
    solicitacaoPagador: `Aluguel ${paymentRef}`,
  };

  // Adiciona devedor se tiver CPF
  if (tenantCpf) {
    body.devedor = {
      cpf: tenantCpf.replace(/\D/g, ""),
      nome: tenantName,
    };
  }

  const fetchOpts: RequestInit & { client?: Deno.HttpClient } = {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  };
  if (httpClient) fetchOpts.client = httpClient;

  // Cria cobrança
  const cobRes = await fetch(`${EFI_BASE}/v2/cob/${txid}`, fetchOpts);
  if (!cobRes.ok) {
    const err = await cobRes.text();
    throw new Error(`Criar cobrança PIX falhou (${cobRes.status}): ${err}`);
  }
  const cob = await cobRes.json();
  const locId = cob.loc?.id;
  if (!locId) throw new Error("locId não retornado pela Efí Bank");

  // Busca QR Code
  const qrFetchOpts: RequestInit & { client?: Deno.HttpClient } = {
    headers: { "Authorization": `Bearer ${token}` },
  };
  if (httpClient) qrFetchOpts.client = httpClient;

  const qrRes = await fetch(`${EFI_BASE}/v2/loc/${locId}/qrcode`, qrFetchOpts);
  if (!qrRes.ok) {
    const err = await qrRes.text();
    throw new Error(`Buscar QR Code falhou (${qrRes.status}): ${err}`);
  }
  const qrData = await qrRes.json();

  return {
    qrcode_image:  qrData.imagemQrcode,
    pix_copy_paste: qrData.qrcode,
    charge_id:     cob.txid ?? txid,
    expires_at:    expiresAt,
  };
}

// ── Envia QR Code + código PIX para o Telegram do locatário ──────────────────
async function sendPixToTenant(
  chatId: string,
  tenantName: string,
  amount: number,
  weekLabel: string,
  dueDate: string,
  qrcodeImageUrl: string,
  pixCopyPaste: string,
  token?: string,
): Promise<void> {
  const tk = token || BOT_TOKEN;
  if (!tk || !chatId) return;

  const amountStr = amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 });
  const [y, m, d] = dueDate.slice(0, 10).split("-");
  const duePt = `${d}/${m}/${y}`;

  const caption =
    `💰 <b>Cobrança de Aluguel</b>\n\n` +
    `Olá, ${tenantName.split(" ")[0]}!\n\n` +
    `📅 <b>Referência:</b> ${weekLabel}\n` +
    `💵 <b>Valor:</b> R$ ${amountStr}\n` +
    `⏰ <b>Vence:</b> ${duePt}\n\n` +
    `Escaneie o QR Code acima ou use o código abaixo para pagar via PIX.\n\n` +
    `<b>Código PIX (Copia e Cola):</b>`;

  // Envia imagem do QR Code com legenda
  await fetch(`https://api.telegram.org/bot${tk}/sendPhoto`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      photo: qrcodeImageUrl,
      caption,
      parse_mode: "HTML",
    }),
  });

  // Envia o código PIX em mensagem separada (fácil de copiar)
  await fetch(`https://api.telegram.org/bot${tk}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: `<code>${pixCopyPaste}</code>\n\n✅ Após pagar, a confirmação é automática.`,
      parse_mode: "HTML",
    }),
  });
}

// ── Notifica dono que cobrança PIX foi gerada ─────────────────────────────────
async function notifyOwner(
  ownerChatId: string,
  tenantName: string,
  amount: number,
  weekLabel: string,
  token?: string,
): Promise<void> {
  const tk = token || BOT_TOKEN;
  if (!tk || !ownerChatId) return;
  const amountStr = amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 });
  await fetch(`https://api.telegram.org/bot${tk}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: ownerChatId,
      text: `📲 PIX gerado para <b>${tenantName.split(" ")[0]}</b>\nR$ ${amountStr} · ${weekLabel}\n\nAguardando pagamento...`,
      parse_mode: "HTML",
    }),
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  // Autentica usuário
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "Token ausente" }, 401);

  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authErr } = await sb.auth.getUser(token);
  if (authErr || !user) return json({ error: "Sessão inválida" }, 401);

  let body: { payment_id: string };
  try { body = await req.json(); }
  catch { return json({ error: "JSON inválido" }, 400); }

  if (!body.payment_id) return json({ error: "payment_id é obrigatório" }, 400);

  // Busca payment + tenant + client
  const { data: payment, error: payErr } = await sb
    .from("payments")
    .select(`
      id, value_amount, due_date, week_label, paid_status, pix_charge_id,
      tenant_id,
      tenants (id, name, cpf, telegram_chat_id),
      clients!inner (id, telegram_chat_id, telegram_bot_token)
    `)
    .eq("id", body.payment_id)
    .eq("client_id", user.id)
    .single();

  if (payErr || !payment) return json({ error: "Pagamento não encontrado" }, 404);
  if (payment.paid_status) return json({ error: "Pagamento já realizado" }, 400);

  const tenant = (payment as any).tenants;
  const client = (payment as any).clients;

  if (!tenant) return json({ error: "Locatário não encontrado" }, 404);
  if (!tenant.telegram_chat_id) {
    return json({
      error: "Locatário não possui Telegram vinculado. Peça para ele enviar /start para @Myfrot_bot e vincule o ID no perfil.",
    }, 400);
  }

  // Se já tem QR Code ativo, reenvia sem criar novo
  if (payment.pix_charge_id && payment.pix_copy_paste) {
    await sendPixToTenant(
      tenant.telegram_chat_id,
      tenant.name,
      payment.value_amount,
      payment.week_label ?? "Aluguel semanal",
      payment.due_date,
      payment.pix_qr_code,
      payment.pix_copy_paste,
      client?.telegram_bot_token ?? undefined,
    );
    return json({ ok: true, reused: true, message: "QR Code reenviado para o locatário" });
  }

  // Verifica credenciais Efí Bank
  if (!EFI_CLIENT_ID || !EFI_CLIENT_SECRET || !EFI_PIX_KEY) {
    return json({ error: "Credenciais Efí Bank não configuradas. Configure EFI_CLIENT_ID, EFI_CLIENT_SECRET e EFI_PIX_KEY nos Secrets." }, 500);
  }

  try {
    const httpClient = createEfiClient();
    const efiToken   = await getEfiToken(httpClient);
    const txid       = generateTxid();

    const { qrcode_image, pix_copy_paste, charge_id, expires_at } = await createPixCharge(
      efiToken,
      txid,
      Number(payment.value_amount),
      tenant.name,
      tenant.cpf ?? null,
      httpClient,
      payment.week_label ?? "Aluguel",
    );

    // Salva no banco
    await sb.from("payments").update({
      pix_charge_id:  charge_id,
      pix_txid:       txid,
      pix_qr_code:    qrcode_image,
      pix_copy_paste: pix_copy_paste,
      pix_expires_at: expires_at,
    }).eq("id", payment.id);

    // Envia para locatário
    await sendPixToTenant(
      tenant.telegram_chat_id,
      tenant.name,
      Number(payment.value_amount),
      payment.week_label ?? "Aluguel semanal",
      payment.due_date,
      qrcode_image,
      pix_copy_paste,
      client?.telegram_bot_token ?? undefined,
    );

    // Notifica dono
    if (client?.telegram_chat_id) {
      await notifyOwner(
        client.telegram_chat_id,
        tenant.name,
        Number(payment.value_amount),
        payment.week_label ?? "Aluguel semanal",
        client?.telegram_bot_token ?? undefined,
      );
    }

    return json({
      ok: true,
      txid,
      pix_copy_paste,
      expires_at,
      message: `PIX enviado para ${tenant.name} via Telegram`,
    });

  } catch (err) {
    console.error("[pix-charge] Erro:", err);
    return json({ error: (err as Error).message }, 500);
  }
});
