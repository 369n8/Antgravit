import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
  if (!token) {
    return new Response(
      JSON.stringify({ error: "TELEGRAM_BOT_TOKEN not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const { client_name, amount_due, telegram_username } = await req.json();

  if (!telegram_username) {
    return new Response(
      JSON.stringify({ error: "telegram_username is required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const chatId = telegram_username.startsWith("@")
    ? telegram_username
    : `@${telegram_username}`;

  const amountFormatted =
    typeof amount_due === "number"
      ? amount_due.toLocaleString("pt-BR", { minimumFractionDigits: 2 })
      : amount_due;

  const text =
    `Ola, *${client_name}*! 👋\n\n` +
    `Passando para informar que ha um valor de *R$ ${amountFormatted}* em aberto na sua locacao.\n\n` +
    `Por favor, regularize o pagamento o quanto antes. Qualquer duvida, estamos a disposicao! 🚗`;

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" }),
  });

  const data = await res.json();

  if (!res.ok) {
    return new Response(
      JSON.stringify({ error: data.description ?? "Telegram API error" }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({ ok: true }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
