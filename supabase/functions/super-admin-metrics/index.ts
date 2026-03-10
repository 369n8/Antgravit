import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const json = (payload: object, status = 200) =>
    new Response(JSON.stringify(payload), {
      status,
      headers: { ...CORS, "Content-Type": "application/json" },
    });

  try {
    // Autentica quem esta acessando a dashboard super admin
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return json({ error: "Token de autenticação ausente." }, 401);
    }

    // Usar SERVICE_ROLE para contornar o RLS de clients
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // Valida o usuario (checar se ele eh o DONO, vamos assumir o email do dono: teste@frotaapp.com ou simplesmente o primeiro auth.uid())
    // Idealmente você teria is_super_admin na tabela users, mas faremos pelo userId ou liberado pra admin panel
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);

    if (authErr || !user) {
      return json({ error: "Sessão inválida. Faça login novamente." }, 401);
    }

    // Validação estrita de Super Admin na Nuvem
    if (user.email !== 'teste@frotaapp.com') {
      console.error(`[super-admin-metrics] Tentativa de acesso bloqueado para: ${user.email}`);
      return json({ error: "Acesso Restrito: Apenas a administração global tem permissão para visualizar estas métricas." }, 403);
    }

    // Puxa TODAS as locadoras (SaaS Manager precisa ver todos)
    const { data: clients, error: clientsErr } = await supabaseAdmin
      .from("clients")
      .select(`
        id, 
        name, 
        email, 
        stripe_connect_status, 
        subscription_status,
        stripe_account_id,
        vehicle_limit,
        created_at
      `)
      .order('created_at', { ascending: false });

    if (clientsErr) throw clientsErr;

    // Puxa total de veiculos globalmente para metricas, mas como é complexo, vamos pegar pela count de vehicles agregada
    const { data: vehicles } = await supabaseAdmin.from("vehicles").select('id, client_id');
    const { data: tenants } = await supabaseAdmin.from("tenants").select('id, client_id');

    // Receita de multas da plataforma (saas_fee)
    const { data: finesFees } = await supabaseAdmin
      .from("fines")
      .select('saas_fee')
      .not('saas_fee', 'is', null);

    const saasFineRevenue = finesFees?.reduce((acc, f) => acc + (f.saas_fee || 0), 0) ?? 0;

    // Montando o array de clientes com metadados acoplados
    const enhancedClients = clients.map(client => {
      const clientVehicles = vehicles?.filter(v => v.client_id === client.id)?.length || 0;
      const clientTenants = tenants?.filter(t => t.client_id === client.id)?.length || 0;
      // Calcula Mrc: TIER 499 BRL / month
      const mrr = 499; // Se Ativo

      return {
        ...client,
        total_vehicles: clientVehicles,
        total_tenants: clientTenants,
        mrr: client.subscription_status === 'active' || client.subscription_status === 'trialing' ? mrr : 0
      };
    });

    const activeClients = enhancedClients.filter(c => c.subscription_status === 'active' || c.subscription_status === 'trialing');
    const totalMrr = activeClients.reduce((acc, curr) => acc + curr.mrr, 0);

    return json({
      clients: enhancedClients,
      metrics: {
        total_mrr: totalMrr,
        total_active_clients: activeClients.length,
        total_clients: clients.length,
        total_global_vehicles: vehicles?.length || 0,
        saas_fine_revenue: saasFineRevenue,
        total_saas_roi: totalMrr + saasFineRevenue,
      }
    });

  } catch (err) {
    console.error("[super-admin-metrics] fail:", err);
    return json({ error: (err as Error).message }, 500);
  }
});
