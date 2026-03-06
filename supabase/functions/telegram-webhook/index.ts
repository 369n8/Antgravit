import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── Secrets (auto-injected pelo Supabase + manuais) ───────────────────────────
const BOT_TOKEN         = Deno.env.get("TELEGRAM_BOT_TOKEN")        ?? "";
const ADMIN_TELEGRAM_ID = Deno.env.get("ADMIN_TELEGRAM_ID")         ?? "";
const SUPABASE_URL      = Deno.env.get("SUPABASE_URL")              ?? "";
const SUPABASE_SVC_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const OPENROUTER_KEY    = Deno.env.get("OPENROUTER_API_KEY")        ?? "";
const AI_MODEL          = Deno.env.get("AI_MODEL")                  ?? "meta-llama/llama-3.1-8b-instruct:free";

// ── Tipos OpenAI-compat ───────────────────────────────────────────────────────
type Role = "system" | "user" | "assistant" | "tool";
interface ChatMessage {
  role: Role;
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
}
interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const cleanUser = (u: string) => u.replace(/^@/, "").toLowerCase();

async function tgSend(chatId: number | string, text: string): Promise<void> {
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" }),
  });
  if (!res.ok) console.error("[tgSend] error:", await res.text());
}

async function tgTyping(chatId: number | string): Promise<void> {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendChatAction`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, action: "typing" }),
  });
}

// ── Definição de Ferramentas (formato OpenAI) ─────────────────────────────────
// Schema completo das tabelas para guiar a IA:
//
// tenants: id(uuid), name, cpf, phone, email, status('ativo'|'encerrado'),
//   blacklisted(bool), rent_weekly(number), telegram_username, telegram_chat_id,
//   vehicle_id, app_used, app_rating, notes, created_at
//   → join: vehicles(plate, brand, model), payments(paid_status, due_date, value_amount)
//
// payments: id(uuid), tenant_id(uuid), value_amount(number), due_date(date),
//   paid_status(bool), paid_date(date), payment_method, week_label
//   → join: tenants(name, phone)

const AI_TOOLS = [
  {
    type: "function",
    function: {
      name: "listar_locatarios",
      description: [
        "OBRIGATÓRIO usar quando perguntarem sobre motoristas, locatários, inadimplentes, ativos, frota, quem está alugando, avaliações ou qualquer dado de pessoas.",
        "Retorna registros da tabela 'tenants' com join de veículo e pagamentos.",
        "Campos retornados: id, name, cpf, phone, status, blacklisted, rent_weekly, telegram_username, telegram_chat_id, app_used, app_rating, notes, vehicles(plate,brand,model), payments(paid_status,due_date,value_amount).",
      ].join(" "),
      parameters: {
        type: "object",
        properties: {
          status: {
            type: "string",
            enum: ["ativo", "encerrado", "todos"],
            description: "Filtrar por status do locatário. Use 'todos' para ver todos. Padrão: ativo.",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "listar_pagamentos",
      description: [
        "OBRIGATÓRIO usar quando perguntarem sobre dívidas, inadimplência, pagamentos em atraso, o que está vencido, quanto está pendente, ou qualquer valor financeiro.",
        "Retorna registros da tabela 'payments' com join do locatário.",
        "Campos retornados: id, tenant_id, value_amount, due_date, paid_status, paid_date, payment_method, week_label, tenants(name,phone).",
        "Um pagamento está em atraso quando paid_status=false E due_date < hoje.",
      ].join(" "),
      parameters: {
        type: "object",
        properties: {
          apenas_atrasados: {
            type: "boolean",
            description: "Se true, retorna apenas pagamentos com due_date no passado e paid_status=false (inadimplentes).",
          },
          tenant_id: {
            type: "string",
            description: "UUID do locatário para filtrar pagamentos de uma pessoa específica. Obter o id primeiro via listar_locatarios se necessário.",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "atualizar_locatario",
      description: [
        "Atualiza um ou mais campos de um locatário na tabela 'tenants'.",
        "Campos editáveis: name, cpf, phone, email, status('ativo'|'encerrado'), blacklisted(bool), rent_weekly(number), telegram_username, notes, app_rating.",
        "Requer o UUID do locatário — use listar_locatarios primeiro se não tiver o id.",
      ].join(" "),
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "UUID (id) do locatário a atualizar." },
          name:             { type: "string" },
          status:           { type: "string", enum: ["ativo", "encerrado"] },
          blacklisted:      { type: "boolean" },
          rent_weekly:      { type: "number" },
          phone:            { type: "string" },
          email:            { type: "string" },
          telegram_username:{ type: "string" },
          notes:            { type: "string" },
          app_rating:       { type: "string" },
        },
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "atualizar_pagamento",
      description: [
        "Atualiza um pagamento na tabela 'payments'.",
        "Campos editáveis: paid_status(bool), paid_date(date YYYY-MM-DD), value_amount(number), due_date(date YYYY-MM-DD), payment_method, week_label.",
        "Para marcar como pago: paid_status=true e paid_date com a data de hoje.",
        "Requer o UUID do pagamento — use listar_pagamentos primeiro se não tiver o id.",
      ].join(" "),
      parameters: {
        type: "object",
        properties: {
          id:             { type: "string", description: "UUID (id) do pagamento a atualizar." },
          paid_status:    { type: "boolean" },
          paid_date:      { type: "string", description: "Data no formato YYYY-MM-DD." },
          value_amount:   { type: "number" },
          due_date:       { type: "string", description: "Data no formato YYYY-MM-DD." },
          payment_method: { type: "string" },
          week_label:     { type: "string" },
        },
        required: ["id"],
      },
    },
  },
];

// ── Executor de Ferramentas ───────────────────────────────────────────────────
async function executeTool(
  supabase: ReturnType<typeof createClient>,
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  console.log(`[agent] tool: ${name}`, JSON.stringify(args));

  if (name === "listar_locatarios") {
    const status = (args.status as string) ?? "ativo";
    let q = supabase
      .from("tenants")
      .select(
        "id, name, cpf, phone, telegram_username, telegram_chat_id, status, " +
        "blacklisted, rent_weekly, vehicles(plate, brand, model), " +
        "payments(paid_status, due_date, value_amount)",
      )
      .order("created_at", { ascending: false });
    if (status !== "todos") q = q.eq("status", status);
    const { data, error } = await q;
    return error ? { error: error.message } : data;
  }

  if (name === "listar_pagamentos") {
    const today = new Date().toISOString().slice(0, 10);
    let q = supabase
      .from("payments")
      .select(
        "id, value_amount, due_date, paid_status, paid_date, " +
        "payment_method, week_label, tenant_id, tenants(name, phone)",
      )
      .order("due_date", { ascending: false });
    if (args.apenas_atrasados) q = q.eq("paid_status", false).lt("due_date", today);
    if (args.tenant_id) q = q.eq("tenant_id", args.tenant_id as string);
    const { data, error } = await q;
    return error ? { error: error.message } : data;
  }

  if (name === "atualizar_locatario") {
    const { id, ...fields } = args;
    const { data, error } = await supabase
      .from("tenants")
      .update(fields)
      .eq("id", id as string)
      .select("id, name")
      .single();
    return error ? { error: error.message } : { ok: true, updated: data };
  }

  if (name === "atualizar_pagamento") {
    const { id, ...fields } = args;
    const { data, error } = await supabase
      .from("payments")
      .update(fields)
      .eq("id", id as string)
      .select("id")
      .single();
    return error ? { error: error.message } : { ok: true, updated: data };
  }

  return { error: `Ferramenta desconhecida: ${name}` };
}

// ── Agentic Loop (OpenRouter / OpenAI-compat) ─────────────────────────────────
async function runAdminAgent(
  supabase: ReturnType<typeof createClient>,
  userMessage: string,
  chatId: number | string,
): Promise<string> {
  const today = new Date().toLocaleDateString("pt-BR");
  const SYSTEM = `Você é o Gerente Administrativo IA de uma frota de veículos por aplicativo. Hoje é ${today}.

REGRAS OBRIGATÓRIAS:
1. SEMPRE chame uma ferramenta antes de responder qualquer pergunta sobre dados. Nunca invente ou estime dados.
2. Se perguntarem sobre motoristas, locatários, quem está ativo/inadimplente/na frota → chame listar_locatarios.
3. Se perguntarem sobre dívidas, pagamentos, atrasos, valores pendentes → chame listar_pagamentos com apenas_atrasados=true.
4. Se pedirem para atualizar/marcar/encerrar algo → chame atualizar_locatario ou atualizar_pagamento com os IDs corretos obtidos nas ferramentas anteriores.
5. Responda em português, de forma executiva e direta.
6. Ao listar, use marcadores (• nome — valor — status) para legibilidade no Telegram.
7. Nunca responda "não tenho acesso" — você tem as ferramentas, USE-AS.`;

  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM },
    { role: "user",   content: userMessage },
  ];

  for (let round = 0; round < 8; round++) {
    console.log(`[agent] round ${round}, model: ${AI_MODEL}, messages: ${messages.length}`);

    // Renovar indicador de digitação a cada round (expira em ~5s)
    await tgTyping(chatId);

    // Primeiro round: forçar uso de ferramenta; rounds seguintes: auto
    const toolChoice = round === 0 ? "required" : "auto";

    const reqBody = {
      model:       AI_MODEL,
      messages,
      tools:       AI_TOOLS,
      tool_choice: toolChoice,
      max_tokens:  1024,
      temperature: 0.2,
    };

    console.log(`[agent] POST https://openrouter.ai/api/v1/chat/completions`);
    console.log(`[agent] body (truncated): ${JSON.stringify(reqBody).slice(0, 400)}`);

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_KEY}`,
        "Content-Type":  "application/json",
        "HTTP-Referer":  "https://frotaapp.app",
        "X-Title":       "FrotaApp Admin Agent",
      },
      body: JSON.stringify(reqBody),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[agent] OpenRouter HTTP ${res.status}: ${errText}`);
      return `Erro ao chamar IA [${res.status}]: ${errText.slice(0, 300)}`;
    }

    const completion = await res.json();
    console.log(`[agent] finish_reason: ${completion.choices?.[0]?.finish_reason}`);

    const choice  = completion.choices?.[0];
    const message = choice?.message;

    if (!message) return "Resposta inválida da IA.";

    // Resposta de texto final
    if (choice.finish_reason === "stop" || !message.tool_calls?.length) {
      return message.content?.trim() || "Sem resposta.";
    }

    // Processar tool_calls
    messages.push({ role: "assistant", content: message.content ?? null, tool_calls: message.tool_calls });

    for (const tc of message.tool_calls as ToolCall[]) {
      let args: Record<string, unknown> = {};
      try { args = JSON.parse(tc.function.arguments); } catch (_) { /**/ }

      const result = await executeTool(supabase, tc.function.name, args);

      messages.push({
        role:         "tool",
        tool_call_id: tc.id,
        name:         tc.function.name,
        content:      JSON.stringify(result),
      });
    }
  }

  return "Não foi possível processar sua solicitação após múltiplas tentativas.";
}

// ── Handler Principal ─────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method !== "POST") return new Response("ok");

  try {
    const body = await req.json();
    const msg  = body?.message;
    if (!msg?.text) return new Response("ok");

    const chatId: number   = msg.chat?.id;
    const username: string = msg.from?.username ?? "";
    const text: string     = msg.text ?? "";

    console.log(`[telegram-webhook] @${username} (${chatId}): ${text.slice(0, 100)}`);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SVC_KEY);

    // ── /start: vincular chat_id ao perfil do locatário ─────────────────
    if (text.startsWith("/start")) {
      let linked = false;
      const startParam = text.split(" ")[1]?.trim(); // UUID do deep link

      // Prioridade 1: deep link com UUID do locatário (t.me/bot?start=UUID)
      const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (startParam && UUID_RE.test(startParam)) {
        const { data: tenant } = await supabase
          .from("tenants")
          .select("id, name")
          .eq("id", startParam)
          .single();

        if (tenant) {
          await supabase.from("tenants").update({ telegram_chat_id: chatId }).eq("id", tenant.id);
          console.log(`[telegram-webhook] deep-link linked tenant ${tenant.id} → chat_id ${chatId}`);
          await tgSend(
            chatId,
            `✅ Olá, *${tenant.name}*! Seu perfil foi vinculado com sucesso.\n\n` +
            `Você receberá notificações de cobrança diretamente aqui. 🚗`,
          );
          linked = true;
        }
      }

      // Prioridade 2: fallback por @username (fluxo manual)
      if (!linked && username) {
        const { data: allTenants } = await supabase
          .from("tenants")
          .select("id, name, telegram_username")
          .not("telegram_username", "is", null);

        const matched = allTenants?.find(
          (t) => cleanUser(t.telegram_username ?? "") === cleanUser(username),
        );

        if (matched) {
          await supabase.from("tenants").update({ telegram_chat_id: chatId }).eq("id", matched.id);
          console.log(`[telegram-webhook] username linked @${username} → tenant ${matched.id}`);
          await tgSend(
            chatId,
            `✅ Olá, *${matched.name}*! Seu perfil foi vinculado com sucesso.\n\n` +
            `Você receberá notificações de cobrança diretamente aqui. 🚗`,
          );
          linked = true;
        }
      }

      if (!linked) {
        await tgSend(
          chatId,
          `👋 Olá! Não foi possível vincular seu perfil automaticamente.\n\n` +
          `Peça ao administrador para enviar o link de ativação correto.`,
        );
      }

      return new Response("ok");
    }

    // ── Admin: processar com IA ───────────────────────────────────────────
    if (ADMIN_TELEGRAM_ID && String(chatId) === String(ADMIN_TELEGRAM_ID)) {
      if (!OPENROUTER_KEY) {
        await tgSend(chatId, "⚠️ *OPENROUTER_API_KEY* não configurada.\n`supabase secrets set OPENROUTER_API_KEY=...`");
        return new Response("ok");
      }

      await tgTyping(chatId);

      const answer = await runAdminAgent(supabase, text, chatId);
      await tgSend(chatId, answer);
      return new Response("ok");
    }

    // ── Locatário com mensagem avulsa ────────────────────────────────────
    await tgSend(chatId, "Olá! Para dúvidas sobre sua locação, entre em contato diretamente com o administrador.");
    return new Response("ok");

  } catch (err) {
    console.error("[telegram-webhook] exception:", err);
    return new Response("ok"); // sempre 200 para o Telegram não retentar
  }
});
