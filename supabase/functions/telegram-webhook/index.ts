import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk";

// ── Secrets ─────────────────────────────────────────────────────────────────
const BOT_TOKEN          = Deno.env.get("TELEGRAM_BOT_TOKEN")        ?? "";
const ADMIN_TELEGRAM_ID  = Deno.env.get("ADMIN_TELEGRAM_ID")         ?? "";
const SUPABASE_URL       = Deno.env.get("SUPABASE_URL")              ?? "";
const SUPABASE_SVC_KEY   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ANTHROPIC_API_KEY  = Deno.env.get("ANTHROPIC_API_KEY")         ?? "";

// ── Helpers ──────────────────────────────────────────────────────────────────
const cleanUsername = (u: string) => u.replace(/^@/, "").toLowerCase();

async function tgSend(chatId: number | string, text: string): Promise<void> {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" }),
  });
}

// ── AI Tools ─────────────────────────────────────────────────────────────────
const AI_TOOLS: Anthropic.Messages.Tool[] = [
  {
    name: "listar_locatarios",
    description: "Lista locatários com dados completos e pagamentos. Use para responder perguntas sobre quem está ativo, inadimplente, etc.",
    input_schema: {
      type: "object" as const,
      properties: {
        status: {
          type: "string",
          enum: ["ativo", "encerrado", "todos"],
          description: "Filtro de status. Omitir = todos os ativos.",
        },
      },
    },
  },
  {
    name: "listar_pagamentos",
    description: "Lista pagamentos com dados do locatário. Pode filtrar por atrasados ou por locatário específico.",
    input_schema: {
      type: "object" as const,
      properties: {
        apenas_atrasados: {
          type: "boolean",
          description: "Se true, retorna apenas pagamentos vencidos e não pagos.",
        },
        tenant_id: {
          type: "string",
          description: "UUID do locatário para filtrar pagamentos de uma pessoa específica.",
        },
      },
    },
  },
  {
    name: "atualizar_locatario",
    description: "Atualiza campos de um locatário no banco. Ex: status, notas, telegram_username, rent_weekly.",
    input_schema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "UUID do locatário." },
        dados: {
          type: "object",
          description: "Campos a atualizar. Ex: {status: 'encerrado'} ou {notes: 'saiu em março'}",
        },
      },
      required: ["id", "dados"],
    },
  },
  {
    name: "atualizar_pagamento",
    description: "Atualiza um pagamento. Ex: marcar como pago, alterar valor ou vencimento.",
    input_schema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "UUID do pagamento." },
        dados: {
          type: "object",
          description: "Campos a atualizar. Ex: {paid_status: true, paid_date: '2026-03-06'}",
        },
      },
      required: ["id", "dados"],
    },
  },
];

// ── Tool Executor ─────────────────────────────────────────────────────────────
async function executeTool(
  supabase: ReturnType<typeof createClient>,
  name: string,
  input: Record<string, unknown>,
): Promise<unknown> {
  console.log(`[webhook] tool call: ${name}`, JSON.stringify(input));

  if (name === "listar_locatarios") {
    const status = (input.status as string) ?? "ativo";
    let q = supabase
      .from("tenants")
      .select(
        "id, name, cpf, phone, telegram_username, telegram_chat_id, status, blacklisted, rent_weekly, " +
        "vehicles(plate, brand, model), payments(paid_status, due_date, value_amount)",
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
      .select("id, value_amount, due_date, paid_status, paid_date, payment_method, week_label, tenant_id, tenants(name, phone)")
      .order("due_date", { ascending: false });
    if (input.apenas_atrasados) q = q.eq("paid_status", false).lt("due_date", today);
    if (input.tenant_id) q = q.eq("tenant_id", input.tenant_id as string);
    const { data, error } = await q;
    return error ? { error: error.message } : data;
  }

  if (name === "atualizar_locatario") {
    const { data, error } = await supabase
      .from("tenants")
      .update(input.dados as object)
      .eq("id", input.id as string)
      .select("id, name")
      .single();
    return error ? { error: error.message } : { ok: true, updated: data };
  }

  if (name === "atualizar_pagamento") {
    const { data, error } = await supabase
      .from("payments")
      .update(input.dados as object)
      .eq("id", input.id as string)
      .select("id")
      .single();
    return error ? { error: error.message } : { ok: true, updated: data };
  }

  return { error: `Ferramenta desconhecida: ${name}` };
}

// ── Agentic Loop ─────────────────────────────────────────────────────────────
async function runAdminAgent(
  supabase: ReturnType<typeof createClient>,
  userMessage: string,
): Promise<string> {
  const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

  const SYSTEM = [
    "Você é o Gerente Administrativo IA de uma frota de veículos por aplicativo.",
    "Responda SEMPRE em português, de forma executiva, direta e objetiva.",
    "Use as ferramentas para buscar dados reais antes de responder.",
    "Ao listar dados, use formatação com marcadores (• ou -) para legibilidade.",
    "Ao atualizar dados, confirme o que foi alterado.",
    `Hoje: ${new Date().toLocaleDateString("pt-BR")}.`,
  ].join(" ");

  const messages: Anthropic.Messages.MessageParam[] = [
    { role: "user", content: userMessage },
  ];

  for (let round = 0; round < 10; round++) {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: SYSTEM,
      tools: AI_TOOLS,
      messages,
    });

    console.log(`[webhook] agent round ${round}, stop_reason: ${response.stop_reason}`);

    if (response.stop_reason === "end_turn") {
      const textBlock = response.content.find((c) => c.type === "text");
      return (textBlock as Anthropic.Messages.TextBlock)?.text ?? "Sem resposta.";
    }

    if (response.stop_reason === "tool_use") {
      const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];
      for (const block of response.content) {
        if (block.type === "tool_use") {
          const result = await executeTool(supabase, block.name, block.input as Record<string, unknown>);
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: JSON.stringify(result),
          });
        }
      }
      messages.push({ role: "assistant", content: response.content });
      messages.push({ role: "user", content: toolResults });
      continue;
    }

    break;
  }

  return "Não foi possível processar sua solicitação.";
}

// ── Main Handler ─────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method !== "POST") return new Response("ok");

  try {
    const body = await req.json();
    const msg = body?.message;
    if (!msg?.text) return new Response("ok");

    const chatId: number   = msg.chat?.id;
    const username: string = msg.from?.username ?? "";
    const text: string     = msg.text ?? "";

    console.log(`[telegram-webhook] @${username} (${chatId}): ${text.slice(0, 100)}`);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SVC_KEY);

    // ── /start: vincular chat_id numérico ao perfil do locatário ──────────
    if (text.startsWith("/start")) {
      let linked = false;

      if (username) {
        const { data: allTenants } = await supabase
          .from("tenants")
          .select("id, name, telegram_username")
          .not("telegram_username", "is", null);

        const matched = allTenants?.find(
          (t) => cleanUsername(t.telegram_username ?? "") === cleanUsername(username),
        );

        if (matched) {
          await supabase
            .from("tenants")
            .update({ telegram_chat_id: chatId })
            .eq("id", matched.id);

          console.log(`[telegram-webhook] linked @${username} → tenant ${matched.id} (chat_id: ${chatId})`);

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
          `👋 Olá! Seu usuário *@${username}* não foi encontrado no sistema.\n\n` +
          `Peça ao administrador para cadastrar seu username no seu perfil de locatário.`,
        );
      }

      return new Response("ok");
    }

    // ── Admin: processar mensagem com IA ───────────────────────────────────
    if (ADMIN_TELEGRAM_ID && String(chatId) === String(ADMIN_TELEGRAM_ID)) {
      if (!ANTHROPIC_API_KEY) {
        await tgSend(chatId, "⚠️ *ANTHROPIC_API_KEY* não configurada. Execute:\n`supabase secrets set ANTHROPIC_API_KEY=...`");
        return new Response("ok");
      }

      await tgSend(chatId, "⏳ _Processando..._");

      const answer = await runAdminAgent(supabase, text);
      await tgSend(chatId, answer);
      return new Response("ok");
    }

    // ── Locatário com mensagem avulsa ──────────────────────────────────────
    await tgSend(
      chatId,
      "Olá! Para dúvidas sobre sua locação, entre em contato diretamente com o administrador.",
    );

    return new Response("ok");
  } catch (err) {
    console.error("[telegram-webhook] exception:", err);
    return new Response("ok"); // sempre 200 para o Telegram não retentar
  }
});
