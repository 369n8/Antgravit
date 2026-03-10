import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14?target=deno";

// ── Secrets necessários no Supabase Dashboard → Settings → Edge Functions ──
// STRIPE_SECRET_KEY      → sk_test_... (chave secreta Stripe sandbox)
// STRIPE_WEBHOOK_SECRET  → whsec_...  (obtido em Stripe Dashboard → Webhooks)
// SUPABASE_URL           → automático
// SUPABASE_SERVICE_ROLE_KEY → automático

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

serve(async (req) => {
  // O Stripe exige o body RAW (texto) para verificar a assinatura
  const body = await req.text();
  const sig  = req.headers.get("stripe-signature") ?? "";
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";

  // ── 1. Verificar assinatura (segurança) ──────────────────────────────────
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig, webhookSecret);
  } catch (err) {
    console.error("[stripe-webhook] assinatura inválida:", (err as Error).message);
    return new Response(`Webhook Error: ${(err as Error).message}`, { status: 400 });
  }

  console.log(`[stripe-webhook] evento recebido: ${event.type}`);

  // ── 2. Processar apenas checkout.session.completed ───────────────────────
  if (event.type === "checkout.session.completed") {
    const session    = event.data.object as Stripe.Checkout.Session;
    const payment_id = session.metadata?.payment_id;
    const invoice_id = session.metadata?.invoice_id;
    const source     = session.metadata?.source;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")              ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const now = new Date().toISOString();
    const today = now.slice(0, 10);

    // ── 3a. Fluxo Invoices (create-invoice) ──────────────────────────────
    if (invoice_id && source === "create-invoice") {
      const { data: inv } = await supabase
        .from("invoices")
        .select("status")
        .eq("id", invoice_id)
        .single();

      if (inv?.status === "paid") {
        console.log(`[stripe-webhook] invoice ${invoice_id} já paga — ignorando`);
        return new Response("ok");
      }

      const { error: invErr } = await supabase
        .from("invoices")
        .update({ status: "paid", paid_at: now, stripe_session_id: session.id })
        .eq("id", invoice_id);

      if (invErr) {
        console.error("[stripe-webhook] erro ao atualizar invoice:", invErr.message);
        return new Response("DB Error", { status: 500 });
      }

      console.log(`[stripe-webhook] ✓ invoice ${invoice_id} marcada como paga`);
      return new Response("ok");
    }

    // ── 3b. Fluxo Payments legado (create-checkout-session) ──────────────
    if (!payment_id) {
      console.error("[stripe-webhook] metadata sem payment_id nem invoice_id — ignorando");
      return new Response("ok");
    }

    const { data: existing } = await supabase
      .from("payments")
      .select("paid_status")
      .eq("id", payment_id)
      .single();

    if (existing?.paid_status) {
      console.log(`[stripe-webhook] payment ${payment_id} já estava pago — ignorando`);
      return new Response("ok");
    }

    const { error: updateErr } = await supabase
      .from("payments")
      .update({ paid_status: true, paid_date: today, payment_method: "Stripe" })
      .eq("id", payment_id);

    if (updateErr) {
      console.error("[stripe-webhook] erro ao atualizar DB:", updateErr.message);
      return new Response("DB Error", { status: 500 });
    }

    console.log(`[stripe-webhook] ✓ payment ${payment_id} marcado como pago em ${today}`);

    // ── 5. (Opcional) Notificar locatário via Telegram ────────────────────
    // Se quiser ativar: busque tenants.telegram_chat_id e envie via tgSend()
    // const { data: pay } = await supabase
    //   .from("payments").select("tenant_id, value_amount, week_label").eq("id", payment_id).single();
    // if (pay) {
    //   const { data: tenant } = await supabase
    //     .from("tenants").select("telegram_chat_id, name").eq("id", pay.tenant_id).single();
    //   if (tenant?.telegram_chat_id) {
    //     await tgSend(tenant.telegram_chat_id, `✅ Pagamento de R$${pay.value_amount} confirmado!`);
    //   }
    // }
  }

  // Sempre retornar 200 para eventos que não processamos (evita retentativas desnecessárias)
  return new Response("ok");
});
