import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── Secrets ───────────────────────────────────────────────────────────────────
const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
const ADMIN_TELEGRAM_ID = Deno.env.get("ADMIN_TELEGRAM_ID") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SVC_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const OPENROUTER_KEY = Deno.env.get("OPENROUTER_API_KEY") ?? "";
const AI_MODEL = Deno.env.get("AI_MODEL") ?? "google/gemini-2.0-flash-001";

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
const normalizePlate = (p: string) => p.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();

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
          id: { type: "string", description: "UUID do locatário." },
          name: { type: "string" },
          status: { type: "string", enum: ["ativo", "encerrado"] },
          blacklisted: { type: "boolean" },
          rent_weekly: { type: "number" },
          phone: { type: "string" },
          email: { type: "string" },
          telegram_username: { type: "string" },
          notes: { type: "string" },
          app_rating: { type: "string" },
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
          id: { type: "string", description: "UUID do pagamento." },
          paid_status: { type: "boolean" },
          paid_date: { type: "string", description: "YYYY-MM-DD." },
          value_amount: { type: "number" },
          due_date: { type: "string", description: "YYYY-MM-DD." },
          payment_method: { type: "string" },
          week_label: { type: "string" },
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
        "OBRIGATÓRIO usar quando perguntarem sobre check-in, entrega/devolução de veículos, quilometragem (KM), combustível ou histórico de uso.",
        "Para 'qual a última KM do carro X?' → use esta ferramenta com vehicle_plate e o primeiro resultado (mais recente) terá o campo mileage.",
        "Retorna tabela 'checkins' com join de veículo e locatário, ordenado por created_at DESC (mais recente primeiro).",
        "Campos: id, checkin_type('entrega'|'devolucao'), mileage(km registrado), fuel_level(0-100), notes, created_at, vehicles(plate,brand,model), tenants(name,phone).",
      ].join(" "),
      parameters: {
        type: "object",
        properties: {
          vehicle_plate: { type: "string", description: "Placa do veículo (ex: BRA2E25) para filtrar. Preferir em relação a vehicle_id quando a placa é conhecida." },
          vehicle_id: { type: "string", description: "UUID do veículo. Use vehicle_plate quando possível." },
          checkin_type: { type: "string", enum: ["entrega", "devolucao", "exit", "todos"], description: "Padrão: todos. Use 'exit' para check-out de devolução." },
          limit: { type: "number", description: "Máximo de registros. Use 1 para buscar apenas o mais recente." },
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
          status: { type: "string", enum: ["pendente", "pago", "contestado", "todos"], description: "Padrão: todos." },
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
          vehicle_plate: { type: "string", description: "Placa do veículo (ex: BRA2E25). Obrigatório." },
          amount: { type: "number", description: "Valor da multa em R$." },
          date: { type: "string", description: "Data da infração YYYY-MM-DD." },
          due_date: { type: "string", description: "Data de vencimento da multa YYYY-MM-DD." },
          description: { type: "string", description: "Descrição da infração." },
          infraction_code: { type: "string", description: "Código da infração ex: 55412." },
          status: { type: "string", enum: ["pendente", "pago", "contestado"], description: "Padrão: pendente." },
        },
        required: ["vehicle_plate"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "verificar_vencimentos",
      description: [
        "OBRIGATÓRIO usar quando o admin perguntar 'como está a frota?', 'tem algo vencendo?', 'resumo da frota', 'o que vence essa semana?', 'situação geral'.",
        "Retorna em uma única chamada: seguros a vencer, manutenções próximas, manutenções ATRASADAS, multas com due_date próximo, total de multas pendentes, e veículos com KM alta (≥80k).",
        "resumo.veiculos_km_alta = contagem de carros precisando atenção por KM. resumo.manutencoes_atrasadas = revisões vencidas não feitas.",
      ].join(" "),
      parameters: {
        type: "object",
        properties: {
          dias: { type: "number", description: "Janela de dias para buscar vencimentos. Padrão: 7." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "listar_manutencao",
      description: [
        "OBRIGATÓRIO usar quando perguntarem sobre gastos de manutenção, pneus, óleo, revisão, freios, custos por categoria, histórico de manutenção ou agendamentos futuros.",
        "Para 'quanto gastei com pneus?' → use category='Pneu' e some os value_amount.",
        "Para 'quanto gastei este mês?' → use o parâmetro desde com o primeiro dia do mês.",
        "Retorna tabela 'maintenance' com join de veículo.",
        "Campos: id, event_type('expense'|'schedule'), category('Revisão'|'Pneu'|'Freios'|'Óleo'|'Elétrica'|'Funilaria'|'IPVA'|'Outro'), date, description, value_amount, done, vehicles(plate,brand,model).",
      ].join(" "),
      parameters: {
        type: "object",
        properties: {
          vehicle_plate: { type: "string", description: "Placa do veículo para filtrar (ex: BRA2E25). Opcional." },
          vehicle_id: { type: "string", description: "UUID do veículo. Use vehicle_plate quando possível." },
          category: { type: "string", enum: ["Revisão", "Pneu", "Freios", "Óleo", "Elétrica", "Funilaria", "IPVA", "Outro", "todas"], description: "Filtrar por categoria. Padrão: todas." },
          event_type: { type: "string", enum: ["expense", "schedule", "todos"], description: "expense=despesas reais, schedule=agendamentos futuros. Padrão: todos." },
          desde: { type: "string", description: "Data inicial YYYY-MM-DD para filtrar. Ex: primeiro dia do mês atual." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "buscar_veiculo_por_nome",
      description: [
        "Busca veículos por marca, modelo ou cor usando ilike (busca parcial, case-insensitive).",
        "Use quando a placa NÃO for informada e o admin mencionar um nome como 'Corolla', 'Civic', 'Toyota'.",
        "Retorna id, plate, brand, model, status, current_tenant_id, rent_weekly.",
        "Para criar um contrato, use o 'id' retornado como vehicle_id.",
      ].join(" "),
      parameters: {
        type: "object",
        properties: {
          nome: { type: "string", description: "Texto parcial de marca, modelo ou cor. Ex: 'Corolla', 'Toyota', 'Prata'." },
        },
        required: ["nome"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "listar_veiculos",
      description: [
        "OBRIGATÓRIO usar quando perguntarem sobre veículos, carros, motos, frota, quantos carros tem, quais carros, veículos disponíveis, veículos locados, ou qualquer informação sobre a frota.",
        "Também use para 'quantos carros eu tenho?', 'me mostra os carros', 'quero saber dos carros', 'veículos cadastrados'.",
        "Retorna todos os veículos da tabela 'vehicles' com dados completos.",
        "Campos: id, plate, brand, model, year, color, type, status('disponivel'|'locado'|'manutencao'), km, fuel_level, rent_weekly, current_tenant_id, notes.",
        "Use o resultado para contar, filtrar por status, ou dar qualquer informação sobre a frota.",
      ].join(" "),
      parameters: {
        type: "object",
        properties: {
          status: {
            type: "string",
            enum: ["disponivel", "locado", "manutencao", "todos"],
            description: "Filtrar por status. Padrão: todos.",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "criar_contrato_locacao",
      description: [
        "Vincula um locatário a um veículo: atualiza vehicles.status='locado' e vehicles.current_tenant_id.",
        "OBRIGATÓRIO usar quando o admin pedir 'criar contrato', 'locar veículo', 'vincular motorista ao carro', 'fazer contrato'.",
        "Se não tiver os UUIDs: use listar_locatarios para buscar o tenant_id pelo nome, e buscar_veiculo_por_nome ou listar_checkins para obter o vehicle_id.",
        "Confirma os dados e retorna resumo da vinculação.",
      ].join(" "),
      parameters: {
        type: "object",
        properties: {
          tenant_id: { type: "string", description: "UUID do locatário (tenants.id)." },
          vehicle_id: { type: "string", description: "UUID do veículo (vehicles.id)." },
          rent_weekly: { type: "number", description: "Valor semanal opcional para atualizar no veículo." },
        },
        required: ["tenant_id", "vehicle_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "gerar_comprovante",
      description: [
        "OBRIGATÓRIO usar quando o admin pedir 'gerar comprovante', 'comprovante de check-in', 'voucher', 'recibo de entrega/devolução' ou 'resumo de devolução' para um veículo.",
        "Busca o último check-in (incluindo checkout tipo 'exit') do veículo e retorna o campo 'comprovante' com o texto formatado pronto para enviar ao motorista via WhatsApp.",
        "Se o último registro for tipo 'exit' (check-out), gera um Resumo de Devolução com os KM rodados na locação.",
        "Envie o campo 'comprovante' do resultado VERBATIM, sem alterar nenhuma palavra ou linha.",
      ].join(" "),
      parameters: {
        type: "object",
        properties: {
          vehicle_plate: { type: "string", description: "Placa do veículo (ex: BRA2E25). Obrigatório." },
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
    let vehicleId = args.vehicle_id as string | undefined;
    // Resolve plate → vehicle_id if needed
    if (!vehicleId && args.vehicle_plate) {
      const plate = normalizePlate((args.vehicle_plate as string) ?? "");
      const { data: veh } = await supabase.from("vehicles").select("id").ilike("plate", plate).limit(1).single();
      if (veh) vehicleId = veh.id;
    }
    let q = supabase
      .from("checkins")
      .select("id, checkin_type, mileage, fuel_level, notes, created_at, vehicles(plate, brand, model), tenants(name, phone)")
      .order("created_at", { ascending: false });
    if (vehicleId) q = q.eq("vehicle_id", vehicleId);
    if (args.checkin_type && args.checkin_type !== "todos") q = q.eq("checkin_type", args.checkin_type as string);
    if (args.limit) q = q.limit(args.limit as number);
    const { data, error } = await q;
    return error ? { error: error.message } : data;
  }

  if (name === "listar_manutencao") {
    let vehicleId = args.vehicle_id as string | undefined;
    if (!vehicleId && args.vehicle_plate) {
      const plate = normalizePlate((args.vehicle_plate as string) ?? "");
      const { data: veh } = await supabase.from("vehicles").select("id").ilike("plate", plate).limit(1).single();
      if (veh) vehicleId = veh.id;
    }
    let q = supabase
      .from("maintenance")
      .select("id, event_type, category, date, description, value_amount, done, vehicles(plate, brand, model)")
      .order("date", { ascending: false });
    if (vehicleId) q = q.eq("vehicle_id", vehicleId);
    if (args.category && args.category !== "todas") q = q.eq("category", args.category as string);
    if (args.event_type && args.event_type !== "todos") q = q.eq("event_type", args.event_type as string);
    if (args.desde) q = q.gte("date", args.desde as string);
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
      const plate = normalizePlate((args.vehicle_plate as string) ?? "");
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
    if (vehicleId) fineData.vehicle_id = vehicleId;
    if (args.amount) fineData.amount = args.amount;
    if (args.date) fineData.date = args.date;
    if (args.due_date) fineData.due_date = args.due_date;
    if (args.description) fineData.description = args.description;
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

  if (name === "verificar_vencimentos") {
    const dias = (args.dias as number) ?? 7;
    const today = new Date().toISOString().slice(0, 10);
    const future = new Date(Date.now() + dias * 86400000).toISOString().slice(0, 10);

    const [insRes, maintProxRes, maintAtrasRes, finesVencRes, finesTotalRes, cksRes] = await Promise.all([
      // Seguros vencendo no período
      supabase.from("insurance")
        .select("expiry_date, insurer, vehicles(plate, brand, model)")
        .lte("expiry_date", future).gte("expiry_date", today).order("expiry_date"),
      // Manutenções agendadas próximas
      supabase.from("maintenance")
        .select("date, category, description, vehicles(plate, brand, model)")
        .eq("event_type", "schedule").eq("done", false)
        .lte("date", future).gte("date", today).order("date"),
      // Manutenções atrasadas (vencidas e não feitas)
      supabase.from("maintenance")
        .select("date, category, description, vehicles(plate, brand, model)")
        .eq("event_type", "schedule").eq("done", false)
        .lt("date", today).order("date"),
      // Multas com vencimento próximo
      supabase.from("fines")
        .select("due_date, amount, description, vehicles(plate, brand, model)")
        .eq("status", "pendente").not("due_date", "is", null)
        .lte("due_date", future).gte("due_date", today).order("due_date"),
      // Total de multas pendentes (todas, sem filtro de data)
      supabase.from("fines").select("id, amount").eq("status", "pendente"),
      // Último check-in por veículo (para KM e combustível)
      supabase.from("checkins")
        .select("vehicle_id, mileage, fuel_level, created_at, vehicles(plate, brand, model)")
        .not("mileage", "is", null).order("created_at", { ascending: false }).limit(80),
    ]);

    // Último check-in por veículo (deduplicar)
    const seen = new Set<string>();
    const lastCheckins: Record<string, unknown>[] = [];
    for (const c of (cksRes.data ?? [])) {
      if (!seen.has(c.vehicle_id)) { seen.add(c.vehicle_id); lastCheckins.push(c); }
    }
    const altaKm = lastCheckins.filter(c => (c.mileage as number) >= 80000);
    const totalFinesValor = (finesTotalRes.data ?? []).reduce((s, f) => s + (f.amount || 0), 0);

    return {
      janela_dias: dias,
      seguros_vencendo: insRes.data ?? [],
      manutencoes_proximas: maintProxRes.data ?? [],
      manutencoes_atrasadas: maintAtrasRes.data ?? [],
      multas_vencendo: finesVencRes.data ?? [],
      resumo: {
        seguros_vencendo: (insRes.data ?? []).length,
        manutencoes_proximas: (maintProxRes.data ?? []).length,
        manutencoes_atrasadas: (maintAtrasRes.data ?? []).length,
        multas_pendentes_total: (finesTotalRes.data ?? []).length,
        valor_multas_pendentes: totalFinesValor,
        veiculos_km_alta: altaKm.length,
        veiculos_km_alta_lista: altaKm.map(c => ({ plate: (c.vehicles as { plate: string })?.plate, km: c.mileage })),
      },
    };
  }

  if (name === "buscar_veiculo_por_nome") {
    const nome = ((args.nome as string) ?? "").trim();
    if (!nome) return { error: "Parâmetro 'nome' é obrigatório." };
    const { data, error } = await supabase
      .from("vehicles")
      .select("id, plate, brand, model, color, status, current_tenant_id, rent_weekly")
      .or(`brand.ilike.%${nome}%,model.ilike.%${nome}%,color.ilike.%${nome}%`)
      .order("brand");
    if (error) return { error: error.message };
    if (!data?.length) return { error: `Nenhum veículo encontrado com "${nome}".` };
    return data;
  }

  if (name === "listar_veiculos") {
    const status = (args.status as string) ?? "todos";
    let q = supabase
      .from("vehicles")
      .select("id, plate, brand, model, year, color, type, status, km, fuel_level, rent_weekly, current_tenant_id, notes")
      .order("brand");
    if (status !== "todos") q = q.eq("status", status);
    const { data, error } = await q;
    if (error) return { error: error.message };
    return { total: (data ?? []).length, veiculos: data };
  }

  if (name === "criar_contrato_locacao") {
    const tenantId = args.tenant_id as string;
    const vehicleId = args.vehicle_id as string;

    // Buscar dados para validação e confirmação
    const [tenantRes, vehicleRes] = await Promise.all([
      supabase.from("tenants").select("id, name, phone, rent_weekly, status").eq("id", tenantId).single(),
      supabase.from("vehicles").select("id, plate, brand, model, status, current_tenant_id").eq("id", vehicleId).single(),
    ]);

    if (tenantRes.error || !tenantRes.data) return { error: `Locatário não encontrado: ${tenantRes.error?.message ?? "ID inválido"}` };
    if (vehicleRes.error || !vehicleRes.data) return { error: `Veículo não encontrado: ${vehicleRes.error?.message ?? "ID inválido"}` };

    const tenant = tenantRes.data;
    const vehicle = vehicleRes.data;

    if (vehicle.status === "locado") {
      return { error: `Veículo ${vehicle.plate} já está locado. Faça o check-out antes de criar um novo contrato.` };
    }

    const vehicleUpdate: Record<string, unknown> = { status: "locado", current_tenant_id: tenantId };
    if (args.rent_weekly) vehicleUpdate.rent_weekly = args.rent_weekly;

    const { error: vErr } = await supabase.from("vehicles").update(vehicleUpdate).eq("id", vehicleId);
    if (vErr) return { error: vErr.message };

    // Garantir que o locatário fique com status ativo
    await supabase.from("tenants").update({ status: "ativo" }).eq("id", tenantId);

    return {
      ok: true,
      mensagem: "Contrato criado com sucesso.",
      locatario: tenant.name,
      telefone: tenant.phone ?? "—",
      veiculo: `${vehicle.plate} — ${vehicle.brand} ${vehicle.model}`,
      valor_semanal: `R$${args.rent_weekly ?? (vehicle as { rent_weekly?: number }).rent_weekly ?? "—"}`,
      status_veiculo: "locado",
    };
  }

  if (name === "gerar_comprovante") {
    const rawPlate = (args.vehicle_plate as string) ?? "";
    const plate = normalizePlate(rawPlate);

    const { data: veh } = await supabase
      .from("vehicles")
      .select("id, plate, brand, model")
      .ilike("plate", plate)
      .limit(1)
      .single();

    if (!veh) return { error: `Veículo com placa "${rawPlate}" não encontrado.` };

    const { data: ck } = await supabase
      .from("checkins")
      .select("checkin_type, mileage, fuel_level, photos, notes, created_at, tenants(name)")
      .eq("vehicle_id", veh.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (!ck) return { error: `Nenhum check-in registrado para o veículo ${veh.plate}.` };

    const FUEL: Record<number, string> = { 100: "Cheio", 75: "3/4", 50: "Meio Tanque", 25: "1/4", 10: "Reserva" };
    const fuelLabel = FUEL[ck.fuel_level as number] ?? `${ck.fuel_level}%`;

    const dt = new Date(ck.created_at as string);
    const dateStr = dt.toLocaleDateString("pt-BR") + " às " +
      dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

    const kmStr = ck.mileage ? Number(ck.mileage).toLocaleString("pt-BR") + " km" : "Não registrada";
    const photos = Array.isArray(ck.photos) && (ck.photos as unknown[]).length > 0
      ? `${(ck.photos as unknown[]).length} foto(s) documentadas no servidor seguro.`
      : "Documentadas no servidor seguro.";
    const tenantName = (ck.tenants as { name?: string })?.name;

    // ── Resumo de Devolução (checkout type 'exit') ─────────────────────────
    if (ck.checkin_type === "exit") {
      // Buscar o check-in de entrega mais recente antes deste checkout para calcular KM rodados
      let kmDrivenStr = "";
      if (ck.mileage) {
        const { data: prevCk } = await supabase
          .from("checkins")
          .select("mileage")
          .eq("vehicle_id", veh.id)
          .neq("checkin_type", "exit")
          .not("mileage", "is", null)
          .lt("created_at", ck.created_at as string)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();
        if (prevCk?.mileage) {
          const driven = Number(ck.mileage) - Number(prevCk.mileage);
          if (driven > 0) kmDrivenStr = Number(driven).toLocaleString("pt-BR") + " km rodados nesta locação";
        }
      }

      const lines = [
        `*RESUMO DE DEVOLUCAO - MYFROTA*`,
        ``,
        `Veiculo: ${veh.plate} — ${veh.brand} ${veh.model}`,
        `Data: ${dateStr}`,
        `KM na devolucao: ${kmStr}`,
      ];
      if (kmDrivenStr) lines.push(`Total rodado: ${kmDrivenStr}`);
      lines.push(`Tanque: ${fuelLabel}`);
      lines.push(`Fotos: ${photos}`);
      if (ck.notes) lines.push(`Obs: ${ck.notes}`);
      if (tenantName) lines.push(`Motorista: ${tenantName}`);
      lines.push(`---------------------------`);
      lines.push(`Veiculo devolvido com sucesso. Obrigado pela preferencia!`);

      return { ok: true, comprovante: lines.join("\n"), vehicle: veh.plate, tipo: "devolucao" };
    }

    // ── Comprovante de Check-in (entrega / devolucao) ──────────────────────
    const tipo = ck.checkin_type === "entrega" ? "Entrega" : "Devolucao";
    const lines = [
      `*COMPROVANTE DE CHECK-IN - MYFROTA*`,
      ``,
      `Veiculo: ${veh.plate} — ${veh.brand} ${veh.model}`,
      `Tipo: ${tipo}`,
      `Data: ${dateStr}`,
      `KM: ${kmStr}`,
      `Tanque: ${fuelLabel}`,
      `Fotos: ${photos}`,
    ];
    if (ck.notes) lines.push(`Obs: ${ck.notes}`);
    if (tenantName) lines.push(`Motorista: ${tenantName}`);
    lines.push(`---------------------------`);
    lines.push(`Favor conferir os dados acima antes de iniciar a viagem.`);

    return { ok: true, comprovante: lines.join("\n"), vehicle: veh.plate, tipo: "checkin" };
  }

  return { error: `Ferramenta desconhecida: ${name}` };
}

// ── OCR de multa via visão IA ─────────────────────────────────────────────────
async function extractFineDataFromImage(
  imageUrl: string,
): Promise<{ plate: string | null; amount: number | null; description: string | null }> {
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://frotaapp.app",
        "X-Title": "FrotaApp Fine OCR",
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [{
          role: "user",
          content: [
            { type: "image_url", image_url: { url: imageUrl } },
            { type: "text", text: 'Esta é uma foto de auto de infração ou multa de trânsito. Extraia: 1) Placa do veículo, 2) Valor da multa em R$, 3) Descrição resumida da infração. Responda APENAS com JSON puro, sem markdown: {"plate":"ABC1D23","amount":195.23,"description":"Excesso de velocidade"}. Se não identificar algum campo, use null.' },
          ],
        }],
        max_tokens: 120,
        temperature: 0,
      }),
    });
    if (!res.ok) return { plate: null, amount: null, description: null };
    const json = await res.json();
    const content = (json.choices?.[0]?.message?.content ?? "{}").trim()
      .replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    return JSON.parse(content);
  } catch (_) {
    return { plate: null, amount: null, description: null };
  }
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

  // 5) Tentar extrair dados via visão IA (OCR)
  await tgTyping(chatId);
  const extracted = await extractFineDataFromImage(publicUrl);
  console.log(`[photo] extracted:`, JSON.stringify(extracted));

  // 6) Se há legenda OU dados extraídos → processar via agente imediatamente
  const hasExtracted = extracted.plate || extracted.amount;
  if (caption.trim() || hasExtracted) {
    let context = `O admin enviou uma foto de multa (salva em: ${publicUrl}).`;
    if (hasExtracted) {
      context += ` Análise automática da imagem detectou: placa="${extracted.plate ?? "não identificada"}", valor=R$${extracted.amount ?? "não identificado"}, infração="${extracted.description ?? "não identificada"}".`;
    }
    if (caption.trim()) context += ` Legenda do admin: "${caption}".`;
    context += ` Use registrar_multa para registrar com os dados extraídos. Se a placa não foi detectada, pergunte ao admin.`;

    const answer = await runAdminAgent(supabase, context, chatId);
    await tgSend(chatId, answer);
  } else {
    await tgSend(chatId, "📸 Foto recebida e salva!\n\nChefe, qual o valor e a placa desta multa para eu registrar?");
  }
}

// ── Agentic Loop ──────────────────────────────────────────────────────────────
// ── Memória de conversação por chat (últimas 10 mensagens) ────────────────────
const conversationMemory = new Map<string, ChatMessage[]>();
const MAX_MEMORY = 10;

function getMemory(chatId: string | number): ChatMessage[] {
  return conversationMemory.get(String(chatId)) ?? [];
}

function addToMemory(chatId: string | number, msg: ChatMessage) {
  const key = String(chatId);
  const mem = conversationMemory.get(key) ?? [];
  mem.push(msg);
  // Manter apenas as últimas MAX_MEMORY mensagens
  while (mem.length > MAX_MEMORY) mem.shift();
  conversationMemory.set(key, mem);
}

async function runAdminAgent(
  supabase: ReturnType<typeof createClient>,
  userMessage: string,
  chatId: number | string,
): Promise<string> {
  const today = new Date().toLocaleDateString("pt-BR");
  const SYSTEM = [
    `Você é o "Estagiário" — o Assistente de Inteligência Artificial do FrotaApp. Hoje é ${today}. Você trabalha para o DONO da locadora. Ele é seu CHEFE. Seja leal, eficiente, proativo e direto.`,
    ``,
    `═══ O QUE É O FROTAAPP ═══`,
    `Plataforma SaaS B2B de gestão de frotas para locadoras de veículos de aplicativo (Uber, 99, inDriver). 4 canais: Painel Web, Bot Telegram (VOCÊ), Portal do Motorista, Pré-Cadastro. Cada locadora = "client". Cada motorista = "tenant".`,
    ``,
    `═══ MÓDULO VEÍCULOS ═══`,
    `Campos: id, client_id, type(carro/moto), brand(Honda/Toyota/VW/Fiat/Hyundai/Chevrolet), model(Civic/Corolla/Polo/Argo/HB20/Onix/Mobi), year, plate(formato ABC1D23 ou ABC-1234), color, km(inteiro), fuel_level(0-100), tire_condition(novo/bom/meia vida/troca necessária), rent_weekly(R$350-600/sem), status, current_tenant_id, photos[], docs_ipva, docs_seguro, docs_revisao, notes.`,
    `STATUS: "disponivel"=pronto p/ locar, "locado"=com motorista, "manutenção"=na oficina, "inadimplente"=motorista devendo.`,
    `COMBUSTÍVEL: Cheio=100, 3/4=75, Meio=50, 1/4=25, Reserva=10.`,
    `PNEUS: novo(●●●●), bom(●●●○), meia vida(●●○○), troca necessária(●○○○).`,
    `LIMITE: Cada locadora tem vehicle_limit (default 10). Acima do limite = bloqueado.`,
    ``,
    `═══ MÓDULO LOCATÁRIOS ═══`,
    `Campos: id(=token do portal), client_id, name, cpf(000.000.000-00), rg, birth_date, phone(WhatsApp), phone2, email, cnh(num CNH), cnh_category(A/B/AB/C/D/E), app_used(Uber/99/InDriver/Lyft/Outro), app_rating(ex:4.87), address, bairro, cidade, estado(SP/RJ/MG), cep, emergency_name, emergency_phone, emergency_relation(Mãe/Pai/Esposa), telegram_username, telegram_chat_id, status(ativo/encerrado/pendente), paid_status(bool), blacklisted(bool), rent_weekly, vehicle_id, payment_day(segunda-feira..domingo), payment_method(Pix/Dinheiro/Boleto/Stripe), pix_key, deposits(caução), notes.`,
    `STATUS: "pendente"=veio pelo pré-cadastro, aguarda aprovação. "ativo"=contrato ativo, locando veículo. "encerrado"=devolveu veículo.`,
    `FLUXO NOVO MOTORISTA: 1)Preenche formulário de 3 etapas(Identificação→Habilitação&App→Endereço&Emergência) na URL /pre-cadastro?ref=CLIENT_ID. 2)status="pendente". 3)Admin aprova(escolhe veículo, valor, dia pgto) ou rejeita. 4)Aprovado→ativo, veículo→locado.`,
    `PORTAL DO MOTORISTA: URL /portal/TENANT_ID. Mostra: dados pessoais, veículo vinculado, pagamentos, botão Stripe, download do contrato PDF.`,
    `CONTRATO PDF: Gerado automaticamente com dados do locador, locatário, veículo, valor e termos.`,
    ``,
    `═══ MÓDULO CHECK-IN / CHECK-OUT ═══`,
    `Tabela: checkins. Campos: id, client_id, vehicle_id, tenant_id, checkin_type("entrega"=check-in/"exit"=check-out), mileage(KM), fuel_level, tire_condition, photos[], notes, damage_notes, created_at.`,
    `CHECK-IN (ENTREGA): Veículo "disponivel" → admin registra KM, combustível, fotos → insere checkins → atualiza km/fuel do veículo.`,
    `CHECK-OUT (DEVOLUÇÃO): Veículo "locado" → admin registra KM retorno, combustível, danos → insere checkins tipo "exit" → calcula KM rodados(retorno-entrega) → veículo volta p/ "disponivel", tenant_id=null.`,
    `COMPROVANTE: gerar_comprovante busca último checkin/checkout e gera texto formatado p/ WhatsApp. Se for exit, gera "Resumo de Devolução" com KM rodados.`,
    ``,
    `═══ MÓDULO PAGAMENTOS ═══`,
    `Campos: id, client_id, tenant_id, vehicle_id, due_date(vencimento), paid_date(data pgto), paid_status(true=pago/false=pendente), value_amount(R$), payment_method(Pix/Dinheiro/Boleto/Stripe), week_label.`,
    `VISÕES: semana(seg-dom), mês(1o ao último dia), todos.`,
    `KPIs: Receita Total, Total Recebido, Total Pendente, Inadimplência%= (pendentes/total)×100.`,
    `FLUXO: Admin cria→paid_status=false. Motorista paga→Admin confirma OU Stripe webhook marca automaticamente. Stripe usa Connect com split automático.`,
    `MÉTODOS: Pix(transferência instantânea, mais comum), Dinheiro(espécie), Boleto(bancário), Stripe(cartão online via checkout).`,
    ``,
    `═══ MÓDULO MANUTENÇÃO ═══`,
    `Campos: id, client_id, vehicle_id, event_type("expense"=gasto realizado/"schedule"=agendamento futuro), category, date, description, value_amount(R$), done(bool).`,
    `CATEGORIAS: 🔧Revisão, 🛞Pneu, 🛑Freios, 🛢️Óleo, ⚡Elétrica, 🔨Funilaria, 📄IPVA, 📝Outro.`,
    `expense=gasto já pago (ex:"Troquei 4 pneus R$1.200"). schedule=agendamento futuro (ex:"Revisão programada 20/04"). Agendamentos não concluídos = alertas no Dashboard.`,
    ``,
    `═══ MÓDULO SEGUROS ═══`,
    `Campos: id, client_id, vehicle_id, insurer(Porto Seguro/Bradesco/Azul), policy_number, start_date, expiry_date, premium_amount(R$), notes.`,
    `ALERTAS: Dashboard detecta seguros vencendo em ≤15 dias. Vermelho=≤7 dias, Amarelo=8-15 dias.`,
    ``,
    `═══ MÓDULO MULTAS ═══`,
    `Campos: id, client_id, vehicle_id, tenant_id, amount(R$), description(ex:"Excesso de velocidade"), infraction_code, due_date, status("pendente"/"paga"/"contestada"), photo_url.`,
    `VIA TELEGRAM: Admin envia FOTO do auto de infração → sistema faz OCR com IA → extrai placa, valor, descrição → insere multa automaticamente.`,
    ``,
    `═══ MÓDULO BLACKLIST ═══`,
    `Campos: cpf_or_plate, reason, created_at. CPFs/placas bloqueados não podem ser aprovados. Motivos: inadimplência grave, dano, roubo, falsificação.`,
    ``,
    `═══ DASHBOARD KPIs ═══`,
    `Receita Mensal(semana×4), Lucro(receita-gastos), Gastos, Taxa Ocupação(locados/total×100), Compliance(em dia/total×100), Gráfico Barras(6 meses), Alertas(seguros, multas), Checklist(IPVA, seguro, revisão).`,
    `Growth% = ((mês_atual-mês_anterior)/mês_anterior)×100.`,
    ``,
    `═══ REGRAS DE OURO ═══`,
    `1. NUNCA invente dados. SEMPRE chame ferramenta ANTES de responder.`,
    `2. "Civic","Corolla","Polo" → buscar_veiculo_por_nome. "BRA2E25" → placa. NUNCA trate nome como placa.`,
    `3. Pronomes "ele/esse/aquele" → use contexto das mensagens anteriores.`,
    `4. Problemas("quebrou/bateu/furou") → busque veículo, reporte, SUGIRA AÇÃO("colocar em manutenção").`,
    `5. Formato: direto, executivo, emojis moderados, R$ com 2 decimais, datas DD/MM/AAAA, KM≥1000→"45k km".`,
    `6. Resumo da frota → verificar_vencimentos(dias=7) → "🛡X seguros|🚨Y multas|🔧Z revisões|🚗W KM alta".`,
    `7. Comprovante → gerar_comprovante → envie VERBATIM, sem alterar.`,
    `8. Contrato → listar_locatarios→tenant_id + buscar_veiculo_por_nome→vehicle_id → criar_contrato_locacao.`,
    `9. Cálculos financeiros → listar_manutencao(category=...) → somar values. listar_pagamentos → filtrar.`,
    `10. Limites: NÃO altere status direto, NÃO delete, NÃO acesse outros clientes. Se impossível→"faça pelo painel web".`,
    `11. Nunca exponha UUIDs ou termos técnicos. "vehicle_id"→"o carro", "tenant_id"→"o motorista".`,
    `12. Listas: máx 10 itens, avise se houver mais.`,
    ``,
    `═══ EXEMPLOS DE CONVERSAÇÃO ═══`,
    `"Como tá a frota?" → verificar_vencimentos → relatório executivo com taxa de ocupação.`,
    `"O Polo foi pra oficina" → buscar_veiculo_por_nome("Polo") → reporte status + sugira checkout.`,
    `"Ele quebrou" → (contexto=Polo anterior) → ações: checkout, registrar manutenção, notificar motorista.`,
    `"Quem tá devendo?" → listar_pagamentos(paid_status=false) → lista de inadimplentes.`,
    `"Gera comprovante do Civic" → buscar_veiculo_por_nome → pega placa → gerar_comprovante → envie verbatim.`,
    `"Registra multa R$200 no Polo excesso velocidade" → buscar_veiculo_por_nome → registrar_multa.`,
    `"Cria contrato pro Carlos com Corolla" → listar_locatarios → buscar_veiculo_por_nome → criar_contrato_locacao.`,
    `"Quanto gastei com pneus?" → listar_manutencao(category="Pneu") → somar value_amount.`,
    `"Qual carro é mais rentável?" → listar todos veículos + rent_weekly → ranking.`,
    ``,
    `═══ PERSONALIDADE ═══`,
    `Profissional mas acessível. Chame o admin de "chefe" quando natural. Seja proativo. Se der erro, tente de outro jeito. Português brasileiro sempre. Não repita o que o admin já sabe. Respostas curtas e densas.`,
  ].join("\n");




  // Salvar mensagem do usuário na memória
  addToMemory(chatId, { role: "user", content: userMessage });

  // Montar mensagens com contexto (system + memória + mensagem atual)
  const memory = getMemory(chatId);
  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM },
    ...memory,
  ];

  for (let round = 0; round < 8; round++) {
    console.log(`[agent] round ${round}, messages: ${messages.length} `);
    await tgTyping(chatId);

    const reqBody = {
      model: AI_MODEL,
      messages,
      tools: AI_TOOLS,
      tool_choice: round === 0 ? "required" : "auto",
      max_tokens: 1024,
      temperature: 0.15,
    };

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_KEY} `,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://frotaapp.app",
        "X-Title": "FrotaApp Admin Agent",
      },
      body: JSON.stringify(reqBody),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[agent] OpenRouter ${res.status}: ${errText} `);
      return `Erro na IA[${res.status}]: ${errText.slice(0, 300)} `;
    }

    const completion = await res.json();
    console.log(`[agent] finish_reason: ${completion.choices?.[0]?.finish_reason} `);

    const choice = completion.choices?.[0];
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

function saveAssistantResponse(chatId: number | string, response: string) {
  addToMemory(chatId, { role: "assistant", content: response });
}

// ── Handler Principal ─────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method !== "POST") return new Response("ok");

  try {
    const body = await req.json();
    const msg = body?.message;
    if (!msg) return new Response("ok");

    const chatId: number = msg.chat?.id;
    const username: string = msg.from?.username ?? "";
    const text: string = msg.text ?? "";

    console.log(`[webhook] @${username} (${chatId}): ${text.slice(0, 80)} `);

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
            `✅ Olá, * ${tenant.name}* !Seu perfil foi vinculado com sucesso.\n\nVocê receberá notificações de cobrança diretamente aqui. 🚗`,
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
            `✅ Olá, * ${matched.name}* !Seu perfil foi vinculado com sucesso.\n\nVocê receberá notificações de cobrança diretamente aqui. 🚗`,
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
        saveAssistantResponse(chatId, answer);
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
