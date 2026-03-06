import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── Secrets ───────────────────────────────────────────────────────────────────
const BOT_TOKEN         = Deno.env.get("TELEGRAM_BOT_TOKEN")        ?? "";
const ADMIN_TELEGRAM_ID = Deno.env.get("ADMIN_TELEGRAM_ID")         ?? "";
const SUPABASE_URL      = Deno.env.get("SUPABASE_URL")              ?? "";
const SUPABASE_SVC_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const OPENROUTER_KEY    = Deno.env.get("OPENROUTER_API_KEY")        ?? "";
const AI_MODEL          = Deno.env.get("AI_MODEL")                  ?? "google/gemini-2.0-flash-001";

const FINE_BUCKET = "fine-photos";

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

// ── Ferramentas (formato OpenAI) ──────────────────────────────────────────────
const AI_TOOLS = [
  {
    type: "function",
    function: {
      name: "listar_locatarios",
      description: [
        "OBRIGATÓRIO usar quando perguntarem sobre motoristas, locatários, inadimplentes, ativos, frota, quem está alugando, avaliações ou qualquer dado de pessoas.",
        "Retorna registros da tabela 'tenants' com join de veículo e pagamentos.",
        "Campos: id, name, cpf, phone, status, blacklisted, rent_weekly, telegram_username, telegram_chat_id, app_used, app_rating, notes, vehicles(plate,brand,model), payments(paid_status,due_date,value_amount).",
      ].join(" "),
      parameters: {
        type: "object",
        properties: {
          status: {
            type: "string",
            enum: ["ativo", "encerrado", "todos"],
            description: "Filtrar por status. Use 'todos' para ver todos. Padrão: ativo.",
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
        "OBRIGATÓRIO usar quando perguntarem sobre dívidas, inadimplência, pagamentos em atraso, valores pendentes ou qualquer dado financeiro.",
        "Retorna tabela 'payments' com join do locatário.",
        "Campos: id, tenant_id, value_amount, due_date, paid_status, paid_date, payment_method, week_label, tenants(name,phone).",
        "Atrasado = paid_status=false E due_date < hoje.",
      ].join(" "),
      parameters: {
        type: "object",
        properties: {
          apenas_atrasados: {
            type: "boolean",
            description: "true = apenas due_date passado e paid_status=false.",
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
      description: [
        "Atualiza campos de um locatário na tabela 'tenants'.",
        "Campos editáveis: name, cpf, phone, email, status('ativo'|'encerrado'), blacklisted(bool), rent_weekly, telegram_username, notes, app_rating.",
        "Requer UUID do locatário.",
      ].join(" "),
      parameters: {
        type: "object",
        properties: {
          id:               { type: "string", description: "UUID do locatário." },
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
        "Para marcar como pago: paid_status=true e paid_date=hoje.",
        "Campos: paid_status(bool), paid_date(YYYY-MM-DD), value_amount, due_date(YYYY-MM-DD), payment_method, week_label.",
        "Requer UUID do pagamento.",
      ].join(" "),
      parameters: {
        type: "object",
        properties: {
          id:             { type: "string", description: "UUID do pagamento." },
          paid_status:    { type: "boolean" },
          paid_date:      { type: "string", description: "YYYY-MM-DD." },
          value_amount:   { type: "number" },
          due_date:       { type: "string", description: "YYYY-MM-DD." },
          payment_method: { type: "string" },
          week_label:     { type: "string" },
        },
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "listar_seguros",
      description: [
        "OBRIGATÓRIO usar quando perguntarem sobre seguro, apólice, vencimento de seguro, seguradora ou proteção de veículos.",
        "Retorna tabela 'insurance' com join de veículo.",
        "Campos: id, vehicle_id, insurer, policy_number, pay_date, expiry_date, amount, notes, vehicles(plate,brand,model).",
        "Use expiry_date para verificar vencimentos próximos.",
      ].join(" "),
      parameters: {
        type: "object",
        properties: {
          vehicle_id: { type: "string", description: "UUID do veículo. Opcional." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "listar_checkins",
      description: [
        "OBRIGATÓRIO usar quando perguntarem sobre check-in, entrega/devolução de veículos, quilometragem, combustível ou fotos de check-in.",
        "Retorna tabela 'checkins' com join de veículo e locatário.",
        "Campos: id, checkin_type('entrega'|'devolucao'), mileage, fuel_level(0-100), notes, created_at, vehicles(plate,brand,model), tenants(name,phone).",
      ].join(" "),
      parameters: {
        type: "object",
        properties: {
          vehicle_id:   { type: "string", description: "UUID do veículo. Opcional." },
          checkin_type: { type: "string", enum: ["entrega", "devolucao", "todos"], description: "Padrão: todos." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "listar_multas",
      description: [
        "OBRIGATÓRIO usar quando perguntarem sobre multas, infrações, penalidades, valores de multa.",
        "Retorna tabela 'fines' com join de veículo e locatário.",
        "Campos: id, amount, date, due_date, description, infraction_code, status('pendente'|'pago'|'contestado'), photo_url, vehicles(plate,brand,model), tenants(name,phone).",
      ].join(" "),
      parameters: {
        type: "object",
        properties: {
          status:     { type: "string", enum: ["pendente", "pago", "contestado", "todos"], description: "Padrão: todos." },
          vehicle_id: { type: "string", description: "UUID do veículo. Opcional." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "registrar_multa",
      description: [
        "Registra uma multa de trânsito no banco de dados.",
        "OBRIGATÓRIO usar quando o admin informar placa, valor ou detalhes de uma multa após enviar uma foto, ou quando pedir para registrar uma infração.",
        "Se houver uma multa pendente sem veículo (foto recém-enviada), atualiza ela com os dados informados.",
        "Se não houver, cria uma nova multa.",
        "Busca o veículo pela placa automaticamente.",
      ].join(" "),
      parameters: {
        type: "object",
        properties: {
          vehicle_plate:   { type: "string", description: "Placa do veículo (ex: BRA2E25). Obrigatório." },
          amount:          { type: "number", description: "Valor da multa em R$." },
          date:            { type: "string", description: "Data da infração YYYY-MM-DD." },
          due_date:        { type: "string", description: "Data de vencimento da multa YYYY-MM-DD." },
          description:     { type: "string", description: "Descrição da infração." },
          infraction_code: { type: "string", description: "Código da infração ex: 55412." },
          status:          { type: "string", enum: ["pendente", "pago", "contestado"], description: "Padrão: pendente." },
        },
        required: ["vehicle_plate"],
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
      .select("id, value_amount, due_date, paid_status, paid_date, payment_method, week_label, tenant_id, tenants(name, phone)")
      .order("due_date", { ascending: false });
    if (args.apenas_atrasados) q = q.eq("paid_status", false).lt("due_date", today);
    if (args.tenant_id) q = q.eq("tenant_id", args.tenant_id as string);
    const { data, error } = await q;
    return error ? { error: error.message } : data;
  }

  if (name === "atualizar_locatario") {
    const { id, ...fields } = args;
    const { data, error } = await supabase
      .from("tenants").update(fields).eq("id", id as string).select("id, name").single();
    return error ? { error: error.message } : { ok: true, updated: data };
  }

  if (name === "atualizar_pagamento") {
    const { id, ...fields } = args;
    const { data, error } = await supabase
      .from("payments").update(fields).eq("id", id as string).select("id").single();
    return error ? { error: error.message } : { ok: true, updated: data };
  }

  if (name === "listar_seguros") {
    let q = supabase
      .from("insurance")
      .select("id, vehicle_id, insurer, policy_number, pay_date, expiry_date, amount, notes, vehicles(plate, brand, model)")
      .order("expiry_date", { ascending: true });
    if (args.vehicle_id) q = q.eq("vehicle_id", args.vehicle_id as string);
    const { data, error } = await q;
    return error ? { error: error.message } : data;
  }

  if (name === "listar_checkins") {
    let q = supabase
      .from("checkins")
      .select("id, checkin_type, mileage, fuel_level, notes, created_at, vehicles(plate, brand, model), tenants(name, phone)")
      .order("created_at", { ascending: false });
    if (args.vehicle_id) q = q.eq("vehicle_id", args.vehicle_id as string);
    if (args.checkin_type && args.checkin_type !== "todos") q = q.eq("checkin_type", args.checkin_type as string);
    const { data, error } = await q;
    return error ? { error: error.message } : data;
  }

  if (name === "listar_multas") {
    let q = supabase
      .from("fines")
      .select("id, amount, date, due_date, description, infraction_code, status, photo_url, vehicles(plate, brand, model), tenants(name, phone)")
      .order("date", { ascending: false });
    if (args.vehicle_id) q = q.eq("vehicle_id", args.vehicle_id as string);
    if (args.status && args.status !== "todos") q = q.eq("status", args.status as string);
    const { data, error } = await q;
    return error ? { error: error.message } : data;
  }

  if (name === "registrar_multa") {
    // Look up vehicle by plate
    let vehicleId: string | null = null;
    let clientId: string | null = null;
    if (args.vehicle_plate) {
      const plate = (args.vehicle_plate as string).replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
      const { data: veh } = await supabase
        .from("vehicles")
        .select("id, client_id")
        .ilike("plate", plate)
        .limit(1)
        .single();
      if (veh) { vehicleId = veh.id; clientId = veh.client_id; }
    }
    if (!clientId) {
      const { data: cl } = await supabase.from("clients").select("id").limit(1).single();
      if (cl) clientId = cl.id;
    }
    if (!clientId) return { error: "Não foi possível determinar o cliente dono da frota." };

    // Build fine data
    const fineData: Record<string, unknown> = {
      status: (args.status as string) ?? "pendente",
      client_id: clientId,
    };
    if (vehicleId)          fineData.vehicle_id     = vehicleId;
    if (args.amount)        fineData.amount         = args.amount;
    if (args.date)          fineData.date           = args.date;
    if (args.due_date)      fineData.due_date       = args.due_date;
    if (args.description)   fineData.description    = args.description;
    if (args.infraction_code) fineData.infraction_code = args.infraction_code;

    // Check for a pending fine with no vehicle_id (from photo upload)
    const { data: pending } = await supabase
      .from("fines")
      .select("id")
      .is("vehicle_id", null)
      .not("photo_url", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (pending) {
      const { data, error } = await supabase
        .from("fines").update(fineData).eq("id", pending.id).select("id").single();
      return error ? { error: error.message } : { ok: true, action: "updated", id: data?.id, vehicle_found: !!vehicleId };
    }

    // Create new fine
    const { data, error } = await supabase
      .from("fines").insert(fineData).select("id").single();
    return error ? { error: error.message } : { ok: true, action: "created", id: data?.id, vehicle_found: !!vehicleId };
  }

  return { error: `Ferramenta desconhecida: ${name}` };
}

// ── Processar foto enviada pelo admin ─────────────────────────────────────────
async function handleAdminPhoto(
  supabase: ReturnType<typeof createClient>,
  msg: Record<string, unknown>,
  chatId: number | string,
): Promise<void> {
  const photos = msg.photo as Array<{ file_id: string; file_size?: number }>;
  if (!photos?.length) return;

  const caption = (msg.caption as string) ?? "";

  // Maior resolução = último elemento
  const bestPhoto = photos[photos.length - 1];
  console.log(`[photo] file_id: ${bestPhoto.file_id}`);

  // 1) Obter file_path da Telegram API
  const fileRes = await fetch(
    `https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${bestPhoto.file_id}`,
  );
  const fileData = await fileRes.json();
  const filePath = fileData.result?.file_path as string | undefined;

  if (!filePath) {
    await tgSend(chatId, "❌ Não foi possível obter a foto. Tente novamente.");
    return;
  }

  // 2) Baixar imagem
  const imgRes = await fetch(
    `https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`,
  );
  if (!imgRes.ok) {
    await tgSend(chatId, "❌ Erro ao baixar a foto do Telegram.");
    return;
  }
  const imgBuffer = await imgRes.arrayBuffer();
  const ext = filePath.split(".").pop() ?? "jpg";
  const storagePath = `admin/${Date.now()}.${ext}`;

  // 3) Upload para Supabase Storage
  const { error: upErr } = await supabase.storage
    .from(FINE_BUCKET)
    .upload(storagePath, imgBuffer, { contentType: "image/jpeg", upsert: false });

  if (upErr) {
    console.error("[photo] storage upload error:", upErr.message);
    await tgSend(chatId, `❌ Erro ao salvar foto: ${upErr.message}`);
    return;
  }

  const { data: { publicUrl } } = supabase.storage.from(FINE_BUCKET).getPublicUrl(storagePath);
  console.log(`[photo] uploaded: ${publicUrl}`);

  // 4) Inserir multa pendente sem veículo (será completada via AI)
  const { data: cl } = await supabase.from("clients").select("id").limit(1).single();
  if (cl) {
    await supabase.from("fines").insert({
      client_id: cl.id,
      photo_url: publicUrl,
      photo_path: storagePath,
      status: "pendente",
    });
  }

  // 5) Se há legenda, processar via AI imediatamente
  if (caption.trim()) {
    await tgTyping(chatId);
    const context = `O admin acabou de enviar uma foto de multa (já salva no Storage). Foto URL: ${publicUrl}. Legenda: "${caption}". Extraia os dados (placa, valor, data) e use registrar_multa para completar o registro.`;
    const answer = await runAdminAgent(supabase, context, chatId);
    await tgSend(chatId, answer);
  } else {
    await tgSend(
      chatId,
      `📸 *Foto da multa salva com sucesso!*\n\n` +
      `Agora me diga os detalhes para registrar:\n` +
      `Responda no formato: *placa valor data*\n\n` +
      `Ex: \`BRA2E25 R$150 01/03/2026 excesso de velocidade\``,
    );
  }
}

// ── Agentic Loop ──────────────────────────────────────────────────────────────
async function runAdminAgent(
  supabase: ReturnType<typeof createClient>,
  userMessage: string,
  chatId: number | string,
): Promise<string> {
  const today = new Date().toLocaleDateString("pt-BR");
  const SYSTEM = `Você é o Gerente Administrativo IA de uma frota de veículos por aplicativo. Hoje é ${today}.

REGRAS OBRIGATÓRIAS:
1. SEMPRE chame uma ferramenta antes de responder qualquer pergunta sobre dados. Nunca invente ou estime.
2. Motoristas, locatários, ativos/inadimplentes/frota → listar_locatarios.
3. Dívidas, pagamentos, atrasos, valores pendentes → listar_pagamentos (apenas_atrasados=true).
4. Atualizar/marcar/encerrar algo → atualizar_locatario ou atualizar_pagamento.
5. Seguros, apólices, vencimentos → listar_seguros.
6. Check-ins, entrega/devolução, KM, combustível → listar_checkins.
7. Multas, infrações, penalidades → listar_multas.
8. Registrar multa (após foto ou informação de infração) → registrar_multa com a placa do veículo.
9. Responda em português, de forma executiva e direta.
10. Ao listar, use marcadores (• nome — valor — status) para legibilidade no Telegram.
11. Nunca responda "não tenho acesso" — você tem as ferramentas, USE-AS.`;

  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM },
    { role: "user",   content: userMessage },
  ];

  for (let round = 0; round < 8; round++) {
    console.log(`[agent] round ${round}, messages: ${messages.length}`);
    await tgTyping(chatId);

    const toolChoice = round === 0 ? "required" : "auto";
    const reqBody = {
      model: AI_MODEL,
      messages,
      tools: AI_TOOLS,
      tool_choice: toolChoice,
      max_tokens: 1024,
      temperature: 0.2,
    };

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
      console.error(`[agent] OpenRouter ${res.status}: ${errText}`);
      return `Erro na IA [${res.status}]: ${errText.slice(0, 300)}`;
    }

    const completion = await res.json();
    console.log(`[agent] finish_reason: ${completion.choices?.[0]?.finish_reason}`);

    const choice  = completion.choices?.[0];
    const message = choice?.message;
    if (!message) return "Resposta inválida da IA.";

    if (choice.finish_reason === "stop" || !message.tool_calls?.length) {
      return message.content?.trim() || "Sem resposta.";
    }

    messages.push({ role: "assistant", content: message.content ?? null, tool_calls: message.tool_calls });

    for (const tc of message.tool_calls as ToolCall[]) {
      let args: Record<string, unknown> = {};
      try { args = JSON.parse(tc.function.arguments); } catch (_) { /**/ }
      const result = await executeTool(supabase, tc.function.name, args);
      messages.push({
        role: "tool",
        tool_call_id: tc.id,
        name: tc.function.name,
        content: JSON.stringify(result),
      });
    }
  }

  return "Não foi possível processar após múltiplas tentativas.";
}

// ── Handler Principal ─────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method !== "POST") return new Response("ok");

  try {
    const body = await req.json();
    const msg  = body?.message;
    if (!msg) return new Response("ok");

    const chatId: number   = msg.chat?.id;
    const username: string = msg.from?.username ?? "";
    const text: string     = msg.text ?? "";

    console.log(`[webhook] @${username} (${chatId}): ${text.slice(0, 80)}`);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SVC_KEY);

    // ── /start: vincular tenant via deep link ────────────────────────────
    if (text.startsWith("/start")) {
      let linked = false;
      const startParam = text.split(" ")[1]?.trim();

      const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (startParam && UUID_RE.test(startParam)) {
        const { data: tenant } = await supabase
          .from("tenants").select("id, name").eq("id", startParam).single();
        if (tenant) {
          await supabase.from("tenants").update({ telegram_chat_id: chatId }).eq("id", tenant.id);
          await tgSend(chatId,
            `✅ Olá, *${tenant.name}*! Seu perfil foi vinculado com sucesso.\n\nVocê receberá notificações de cobrança diretamente aqui. 🚗`,
          );
          linked = true;
        }
      }

      if (!linked && username) {
        const { data: allTenants } = await supabase
          .from("tenants").select("id, name, telegram_username").not("telegram_username", "is", null);
        const matched = allTenants?.find(
          (t) => cleanUser(t.telegram_username ?? "") === cleanUser(username),
        );
        if (matched) {
          await supabase.from("tenants").update({ telegram_chat_id: chatId }).eq("id", matched.id);
          await tgSend(chatId,
            `✅ Olá, *${matched.name}*! Seu perfil foi vinculado com sucesso.\n\nVocê receberá notificações de cobrança diretamente aqui. 🚗`,
          );
          linked = true;
        }
      }

      if (!linked) {
        await tgSend(chatId,
          `👋 Olá! Não foi possível vincular seu perfil automaticamente.\n\nPeça ao administrador para enviar o link de ativação correto.`,
        );
      }
      return new Response("ok");
    }

    // ── Admin ────────────────────────────────────────────────────────────
    if (ADMIN_TELEGRAM_ID && String(chatId) === String(ADMIN_TELEGRAM_ID)) {
      if (!OPENROUTER_KEY) {
        await tgSend(chatId, "⚠️ *OPENROUTER_API_KEY* não configurada.");
        return new Response("ok");
      }

      // Admin enviou foto (multa)
      if (msg.photo) {
        await handleAdminPhoto(supabase, msg, chatId);
        return new Response("ok");
      }

      // Admin enviou texto
      if (text) {
        await tgTyping(chatId);
        const answer = await runAdminAgent(supabase, text, chatId);
        await tgSend(chatId, answer);
      }

      return new Response("ok");
    }

    // ── Locatário com mensagem avulsa ────────────────────────────────────
    await tgSend(chatId, "Olá! Para dúvidas sobre sua locação, entre em contato diretamente com o administrador.");
    return new Response("ok");

  } catch (err) {
    console.error("[webhook] exception:", err);
    return new Response("ok");
  }
});
