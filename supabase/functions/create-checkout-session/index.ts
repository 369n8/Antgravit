import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14?target=deno";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion:  "2023-10-16",
  httpClient:  Stripe.createFetchHttpClient(),
});

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const json = (payload: object, status = 200) =>
    new Response(JSON.stringify(payload), {
      status,
      headers: { ...CORS, "Content-Type": "application/json" },
    });

  try {
    const { payment_id } = await req.json();
    if (!payment_id) return json({ error: "payment_id é obrigatório" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")              ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // ── Buscar pagamento com dados do locatário ────────────────────────────
    const { data: payment, error: dbErr } = await supabase
      .from("payments")
      .select("*, tenants(name, email, phone)")
      .eq("id", payment_id)
      .single();

    if (dbErr || !payment) return json({ error: "Pagamento não encontrado" }, 404);
    if (payment.paid_status) return json({ error: "Pagamento já quitado" }, 400);

    const amountCents  = Math.round(Number(payment.value_amount) * 100);
    const tenantName   = (payment.tenants as { name?: string })?.name ?? "Locatário";
    const tenantEmail  = (payment.tenants as { email?: string })?.email ?? undefined;
    const label        = payment.week_label ?? `Aluguel — ${String(payment_id).slice(0, 8)}`;
    const appUrl       = Deno.env.get("APP_URL") ?? "https://myfrot.ai";

    // ── Criar sessão Stripe Checkout ────────────────────────────────────────
    // PIX disponível para contas Stripe Brazil; Card funciona em sandbox global
    const session = await stripe.checkout.sessions.create({
      mode:                 "payment",
      payment_method_types: ["card"],   // adicione "pix" quando conta BR ativa
      line_items: [{
        price_data: {
          currency:     "brl",
          product_data: {
            name:        label,
            description: `Aluguel semanal — ${tenantName}`,
          },
          unit_amount: amountCents,
        },
        quantity: 1,
      }],
      customer_email: tenantEmail,
      metadata: {
        payment_id,
        tenant_id: payment.tenant_id,
      },
      success_url: `${appUrl}?stripe=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${appUrl}?stripe=cancelled`,
    });

    console.log(`[create-checkout-session] session ${session.id} para payment ${payment_id}`);
    return json({ url: session.url });

  } catch (err) {
    console.error("[create-checkout-session]", err);
    return json({ error: (err as Error).message }, 500);
  }
});
