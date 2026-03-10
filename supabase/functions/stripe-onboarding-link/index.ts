import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14?target=deno";

// Secrets necessários (Supabase Dashboard → Settings → Edge Functions):
//   STRIPE_SECRET_KEY       sk_test_...
//   APP_URL                 https://myfrot.ai  (ou http://localhost:5173 em dev)
//   SUPABASE_URL            automático
//   SUPABASE_SERVICE_ROLE_KEY  automático

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const json = (payload: object, status = 200) =>
    new Response(JSON.stringify(payload), {
      status,
      headers: { ...CORS, "Content-Type": "application/json" },
    });

  try {
    // ── 1. Autenticar o dono da locadora via JWT ────────────────────────────
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return json({ error: "Token de autenticação ausente." }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // Valida JWT e extrai o usuário autenticado
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) {
      return json({ error: "Sessão inválida. Faça login novamente." }, 401);
    }

    const clientId = user.id; // clients.id = auth.uid() por design

    // ── 2. Buscar dados atuais da locadora ────────────────────────────────
    const { data: client, error: clientErr } = await supabase
      .from("clients")
      .select("id, name, email, stripe_account_id, stripe_connect_status")
      .eq("id", clientId)
      .single();

    if (clientErr || !client) {
      console.error("[stripe-onboarding-link] client não encontrado:", clientErr?.message);
      return json({ error: "Locadora não encontrada no sistema." }, 404);
    }

    const appUrl = Deno.env.get("APP_URL") ?? "https://myfrot.ai";

    // ── 3. Criar ou reutilizar a Stripe Express Account ───────────────────
    let stripeAccountId = client.stripe_account_id;

    if (!stripeAccountId) {
      console.log(`[stripe-onboarding-link] criando Express Account para client ${clientId}`);

      const account = await stripe.accounts.create({
        type: "express",
        country: "BR",
        email: client.email ?? user.email,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_profile: {
          name: client.name ?? undefined,
          // Locadoras de veículos: código MCC 7512 (Automobile Rental Agency)
          mcc: "7512",
          url: "https://myfrot.ai", // Stripe exige domínio público válido, localhost quebra
        },
        metadata: {
          supabase_client_id: clientId,
        },
      });

      stripeAccountId = account.id;

      // Salvar imediatamente — se o onboarding falhar, a conta já existe
      // e pode ser reaproveitada sem criar duplicata
      const { error: saveErr } = await supabase
        .from("clients")
        .update({
          stripe_account_id: stripeAccountId,
          stripe_connect_status: "pending",
        })
        .eq("id", clientId);

      if (saveErr) {
        console.error("[stripe-onboarding-link] erro ao salvar stripe_account_id:", saveErr.message);
        // Não aborta — o link ainda será gerado; admin pode re-tentar
      }

      console.log(`[stripe-onboarding-link] Express Account criada: ${stripeAccountId}`);
    } else {
      console.log(`[stripe-onboarding-link] reutilizando account ${stripeAccountId} (status: ${client.stripe_connect_status})`);
    }

    // ── 4. Gerar link de onboarding (válido por ~5 min no Stripe) ──────────
    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      // Stripe redireciona aqui se o usuário fechar antes de terminar
      refresh_url: `${appUrl}/?connect=refresh`,
      // Stripe redireciona aqui após conclusão (sucesso ou abandono parcial)
      return_url: `${appUrl}/?connect=complete`,
      type: "account_onboarding",
      collect: "eventually_due", // Coleta apenas o mínimo para ativar; mais tarde pede o resto
    });

    console.log(`[stripe-onboarding-link] link gerado para account ${stripeAccountId}`);
    return json({ url: accountLink.url, account_id: stripeAccountId });

  } catch (err) {
    console.error("[stripe-onboarding-link] exception:", err);
    return json({ error: (err as Error).message }, 500);
  }
});
