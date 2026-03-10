import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (payload: object, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function ptDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

function fmtBRL(value: number | string | null | undefined): string {
  const n = Number(value ?? 0);
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2 });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    // Secrets obrigatorios
    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const adminChatId = Deno.env.get("ADMIN_TELEGRAM_ID");

    if (!botToken) {
      console.error("[telegram-billing] TELEGRAM_BOT_TOKEN not set");
      return json({ ok: false, error: "TELEGRAM_BOT_TOKEN nao configurado no servidor." });
    }
    if (!adminChatId) {
      console.error("[telegram-billing] ADMIN_TELEGRAM_ID not set");
      return json({ ok: false, error: "ADMIN_TELEGRAM_ID nao configurado no servidor." });
    }

    // Payload do frontend
    const body = await req.json();
    console.log("[telegram-billing] payload recebido:", JSON.stringify(body));

    const { client_name, amount_due, week_label, due_date } = body;

    if (!client_name) {
      return json({ ok: false, error: "client_name e obrigatorio no payload." });
    }

    // Formatar mensagem para o admin
    const amountStr = fmtBRL(amount_due);
    const dueDateStr = ptDate(due_date);
    const weekStr = week_label || "Cobranca semanal";

    const text =
      `🚨 *Alerta de Inadimplencia*\n\n` +
      `👤 *Motorista:* ${client_name}\n` +
      `💰 *Valor em aberto:* R$ ${amountStr}\n` +
      `📅 *Referencia:* ${weekStr}\n` +
      `⏰ *Vencimento:* ${dueDateStr}\n\n` +
      `Acesse o painel para tomar uma acao.`;

    console.log("[telegram-billing] enviando para admin chat_id:", adminChatId);

    // Chamar API do Telegram
    const tgRes = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: adminChatId,
          text,
          parse_mode: "Markdown",
        }),
      }
    );

    const tgData = await tgRes.json();
    console.log("[telegram-billing] resposta Telegram:", JSON.stringify(tgData));

    if (!tgData.ok) {
      const errCode = tgData.error_code ?? tgRes.status;
      const errMsg = tgData.description ?? "Telegram API error";
      console.error(`[telegram-billing] erro ${errCode}: ${errMsg}`);
      return json({ ok: false, error: `Telegram [${errCode}]: ${errMsg}` });
    }

    console.log("[telegram-billing] mensagem entregue com sucesso");
    return json({ ok: true });

  } catch (err) {
    console.error("[telegram-billing] exception:", err);
    return json({ ok: false, error: `Excecao interna: ${String(err)}` });
  }
});
