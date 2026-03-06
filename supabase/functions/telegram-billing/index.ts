import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const json = (payload: object) =>
    new Response(JSON.stringify(payload), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405, headers: corsHeaders });
    }

    const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
    if (!token) {
      console.error("[telegram-billing] TELEGRAM_BOT_TOKEN not set in secrets");
      return json({ ok: false, error: "TELEGRAM_BOT_TOKEN not configured on server" });
    }

    const body = await req.json();
    console.log("[telegram-billing] payload:", JSON.stringify(body));

    const { client_name, amount_due, telegram_username, telegram_chat_id } = body;

    // Preferir chat_id numérico (obtido via /start); fallback para @username
    let chatId: number | string | null = telegram_chat_id ?? null;
    if (!chatId) {
      if (!telegram_username) {
        console.error("[telegram-billing] neither chat_id nor username in payload");
        return json({ ok: false, error: "telegram_chat_id ou telegram_username é obrigatório" });
      }
      chatId = String(telegram_username).startsWith("@")
        ? telegram_username
        : `@${telegram_username}`;
    }

    const amountFormatted =
      typeof amount_due === "number"
        ? amount_due.toLocaleString("pt-BR", { minimumFractionDigits: 2 })
        : String(amount_due ?? "");

    const text =
      `Ola, *${client_name}*! 👋\n\n` +
      `Passando para informar que ha um valor de *R$ ${amountFormatted}* em aberto na sua locacao.\n\n` +
      `Por favor, regularize o pagamento o quanto antes. Qualquer duvida, estamos a disposicao! 🚗`;

    console.log("[telegram-billing] sending to chatId:", chatId);

    const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" }),
    });

    const tgData = await tgRes.json();
    console.log("[telegram-billing] Telegram response:", JSON.stringify(tgData));

    if (!tgData.ok) {
      const errMsg = tgData.description ?? "Telegram API error";
      const errCode = tgData.error_code ?? tgRes.status;
      console.error(`[telegram-billing] Telegram error ${errCode}: ${errMsg}`);
      return json({ ok: false, error: `[${errCode}] ${errMsg}` });
    }

    console.log("[telegram-billing] message sent successfully");
    return json({ ok: true });

  } catch (err) {
    console.error("[telegram-billing] unexpected exception:", err);
    return json({ ok: false, error: `Exception: ${String(err)}` });
  }
});
