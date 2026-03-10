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

// Statuses que permitem uso da infraestrutura de checkout.
// Qualquer outro valor (canceled, past_due, unpaid) bloqueia imediatamente.
const ALLOWED_SUBSCRIPTION_STATUSES = new Set(["active", "trialing"]);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const json = (payload: object, status = 200) =>
    new Response(JSON.stringify(payload), {
      status,
      headers: { ...CORS, "Content-Type": "application/json" },
    });

  try {
    const { payment_id } = await req.json();
    if (!payment_id) return json({ error: "payment_id e obrigatorio" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")              ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // ── 1. Buscar pagamento com dados do locatario ─────────────────────────
    const { data: payment, error: dbErr } = await supabase
      .from("payments")
      .select("*, tenants(name, email)")
      .eq("id", payment_id)
      .single();

    if (dbErr || !payment) return json({ error: "Pagamento nao encontrado." }, 404);
    if (payment.paid_status) return json({ error: "Pagamento ja quitado." }, 400);

    // ── 2. Buscar locadora: assinatura SaaS + conta Connect ────────────────
    const { data: client, error: clientErr } = await supabase
      .from("clients")
      .select("stripe_account_id, stripe_connect_status, subscription_status")
      .eq("id", payment.client_id)
      .single();

    if (clientErr || !client) {
      console.error("[checkout] locadora nao encontrada:", payment.client_id);
      return json({ error: "Locadora nao encontrada." }, 404);
    }

    // ── 3. Bloqueio por inadimplencia SaaS ────────────────────────────────
    if (!ALLOWED_SUBSCRIPTION_STATUSES.has(client.subscription_status)) {
      console.warn(
        `[checkout] BLOQUEADO — client ${payment.client_id} ` +
        `subscription_status="${client.subscription_status}"`
      );
      return json(
        {
          error:
            "A conta da locadora esta temporariamente suspensa. " +
            "Por favor, regularize a assinatura para continuar.",
          code: "SUBSCRIPTION_INACTIVE",
          subscription_status: client.subscription_status,
        },
        403,
      );
    }

    // ── 4. Montar parametros da sessao Stripe ──────────────────────────────
    const amountCents = Math.round(Number(payment.value_amount) * 100);
    const tenantName  = (payment.tenants as { name?: string })?.name  ?? "Locatario";
    const tenantEmail = (payment.tenants as { email?: string })?.email ?? undefined;
    const label       = payment.week_label ?? `Aluguel — ${String(payment_id).slice(0, 8)}`;
    const appUrl      = Deno.env.get("APP_URL") ?? "https://myfrot.ai";

    // Destination Charge: roteia pagamento para a conta Connect da locadora.
    // application_fee_amount = 0 por decisao arquitetural:
    // receita da plataforma vem das assinaturas mensais, nao de take rate.
    const hasConnectAccount =
      !!client.stripe_account_id &&
      client.stripe_connect_status === "active";

    if (!hasConnectAccount) {
      console.warn(
        `[checkout] Connect nao ativo para client ${payment.client_id} ` +
        `(account=${client.stripe_account_id ?? "null"}, ` +
        `status=${client.stripe_connect_status}). Sem destination charge.`
      );
    }

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode:                 "payment",
      payment_method_types: ["card"], // adicione "pix" quando conta BR ativa
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
        client_id: payment.client_id,
      },
      success_url: `${appUrl}/portal/${payment.tenant_id}?stripe=success`,
      cancel_url:  `${appUrl}/portal/${payment.tenant_id}?stripe=cancelled`,
    };

    // Injeta Destination Charge apenas quando Connect esta ativo
    if (hasConnectAccount) {
      sessionParams.payment_intent_data = {
        transfer_data: {
          destination: client.stripe_account_id!,
        },
        // application_fee_amount omitido => padrao 0 (sem take rate)
      };
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    console.log(
      `[checkout] session ${session.id} | payment ${payment_id} | ` +
      `connect=${hasConnectAccount ? client.stripe_account_id : "none"} | ` +
      `sub=${client.subscription_status}`
    );

    return json({ url: session.url });

  } catch (err) {
    console.error("[checkout] exception:", err);
    return json({ error: (err as Error).message }, 500);
  }
});
