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

// ── Definição de Ferramentas (formato OpenAI) ─────────────────────────────────
const AI_TOOLS = [
  {
    type: "function",
    function: {
      name: "listar_locatarios",
      description: "Lista locatários com dados e pagamentos. Use para perguntas sobre quem está ativo, inadimplente ou encerrado.",
      parameters: {
        type: "object",
        properties: {
          status: {
            type: "string",
            enum: ["ativo", "encerrado", "todos"],
            description: "Filtro de status. Padrão: ativo.",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "listar_pagamentos",
      description: "Lista pagamentos com dados do locatário. Filtra por atrasados ou por locatário específico.",
      parameters: {
        type: "object",
        properties: {
          apenas_atrasados: {
            type: "boolean",
            description: "Se true, retorna apenas vencidos e não pagos.",
          },
          tenant_id: {
            type: "string",
            description: "UUID do locatário para filtrar.",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "atualizar_locatario",
      description: "Atualiza campos de um locatário. Ex: status, notas, telegram_username, rent_weekly.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "UUID do locatário." },
          dados: {
            type: "object",
            description: "Campos a atualizar. Ex: {\"status\": \"encerrado\"}",
          },
        },
        required: ["id", "dados"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "atualizar_pagamento",
      description: "Atualiza um pagamento. Ex: marcar como pago, alterar valor ou vencimento.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "UUID do pagamento." },
          dados: {
            type: "object",
            description: "Campos a atualizar. Ex: {\"paid_status\": true, \"paid_date\": \"2026-03-06\"}",
          },
        },
        required: ["id", "dados"],
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
    const { data, error } = await supabase
      .from("tenants")
      .update(args.dados as object)
      .eq("id", args.id as string)
      .select("id, name")
      .single();
    return error ? { error: error.message } : { ok: true, updated: data };
  }

  if (name === "atualizar_pagamento") {
    const { data, error } = await supabase
      .from("payments")
      .update(args.dados as object)
      .eq("id", args.id as string)
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
): Promise<string> {
  const SYSTEM = [
    "Você é o Gerente Administrativo IA de uma frota de veículos por aplicativo.",
    "Responda SEMPRE em português, de forma executiva, direta e objetiva.",
    "Use as ferramentas para buscar dados reais antes de responder — nunca invente dados.",
    "Ao listar dados, use marcadores (• ou -) para legibilidade no Telegram.",
    "Ao atualizar dados, confirme o que foi alterado.",
    `Hoje: ${new Date().toLocaleDateString("pt-BR")}.`,
  ].join(" ");

  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM },
    { role: "user",   content: userMessage },
  ];

  for (let round = 0; round < 8; round++) {
    console.log(`[agent] round ${round}, model: ${AI_MODEL}, messages: ${messages.length}`);

    const reqBody = {
      model:       AI_MODEL,
      messages,
      tools:       AI_TOOLS,
      tool_choice: "auto",
      max_tokens:  1024,
      temperature: 0.3,
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

      await tgSend(chatId, "⏳ _Processando..._");

      const answer = await runAdminAgent(supabase, text);
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
