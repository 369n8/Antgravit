/**
 * ai-manager-bot — Edge Function (OpenRouter + Cost-Optimized)
 *
 * Pipeline de custo cirúrgico:
 *   1. Small-talk? → Resposta hardcoded. Zero DB. Zero LLM.
 *   2. Comando? → Query mínima → map/reduce JS → string compacta → LLM
 *   3. Texto livre real? → Estado condensado (60 tokens vs 1000+) → LLM
 *
 * Modelo: google/gemini-2.0-flash-001 via OpenRouter (~$0.075/1M tokens)
 * vs GPT-4o (~$5/1M tokens) = 66x mais barato para 50 frotas.
 *
 * IMPORTANTE: Este bot é EXCLUSIVO para o DONO da frota.
 * Motoristas/locatários NÃO têm acesso ao bot do Telegram.
 * Toda a comunicação com motoristas ocorre pelo Portal do locatário no app.
 *
 * ── Secrets (Supabase Dashboard → Edge Functions → Secrets) ──────
 *  OPENROUTER_API_KEY       → chave do OpenRouter
 *  OPENROUTER_MODEL         → (opcional) default: google/gemini-2.0-flash-001
 *  TELEGRAM_BOT_TOKEN       → token do @BotFather
 *  SUPABASE_URL             → automático
 *  SUPABASE_SERVICE_ROLE_KEY→ automático
 *
 * ── Registrar webhook ────────────────────────────────────────────
 *  curl "https://api.telegram.org/bot<TOKEN>/setWebhook" \
 *    -d "url=https://<ref>.supabase.co/functions/v1/ai-manager-bot"
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

// ── Env ───────────────────────────────────────────────────────────────────────

const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
const OPENROUTER_KEY = Deno.env.get("OPENROUTER_API_KEY") ?? "";
const LLM_MODEL = Deno.env.get("OPENROUTER_MODEL") ?? "google/gemini-2.0-flash-001";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── System Prompt (compacto — ~90 tokens, não 300+) ──────────────────────────

const SYSTEM_PROMPT =
  `Você é o Diretor Operacional de IA da MyFrot, falando APENAS com o dono da frota via Telegram.
CONTEXTO: O bot gerencia pagamentos semanais e relatórios de vistoria semanal dos motoristas.
Relatório semanal = motorista submete km atual + nível de óleo + foto/vídeo do veículo toda semana.
Pagamentos são semanais — cada motorista tem um dia fixo para pagar (segunda a sábado).
REGRAS ABSOLUTAS:
1. RESPONDA DIRETAMENTE A PERGUNTA: Se o chefe perguntou por pagamento/dinheiro/status de carros, não fale de multas ou dados não solicitados. Foque apenas no que foi perguntado!
2. Seja ultra-direto e humano (máximo 4 linhas). Sem asteriscos ou formatação markdown de robô. Valores no formato R$ 1.234,56.
3. Se for um pedido geral de RESUMO, foque em prejuízo: faturas em atraso, calotes e multas. Oculte o que está zero (ex: "zero manutenções").
4. AÇÃO PRÁTICA: Ao relatar um risco ou pendência, finalize sugerindo uma atitude (Ex: "Devo cobrar o João agora?", "Quer que eu avise da multa pendente?").`;

// ── Small-talk detector — zero DB, zero LLM ──────────────────────────────────

const SMALL_TALK_RE = /^(bom dia|boa tarde|boa noite|oi|olá|ola|e aí|eai|eae|tudo bem|tudo bom|ok|certo|👍|✅|😊|obrigad|valeu|tmj|flw|até|tchau|sim|não|nao)\b/i;

const SMALL_TALK_REPLY =
  `Olá! Me manda um comando e resolvo agora:\n\n` +
  `/resumo — situação geral da frota\n` +
  `/inadimplentes — quem está devendo\n` +
  `/multas — infrações pendentes\n` +
  `/vistorias — aguardando aprovação\n` +
  `/vencimentos — seguros próximos\n` +
  `/semana — agenda de pagamentos da semana\n` +
  `/financeiro — receita mensal e projeção anual\n` +
  `/checkins — relatórios semanais dos motoristas`;

// ── Telegram helpers ──────────────────────────────────────────────────────────

async function tgSend(chatId: number | string, text: string, token?: string) {
  const tk = token || BOT_TOKEN;
  if (!tk) return;
  await fetch(`https://api.telegram.org/bot${tk}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  }).catch(e => console.error("[tgSend]", e));
}

async function tgTyping(chatId: number | string, token?: string) {
  const tk = token || BOT_TOKEN;
  if (!tk) return;
  await fetch(`https://api.telegram.org/bot${tk}/sendChatAction`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, action: "typing" }),
  }).catch(() => { });
}

// ── LLM via OpenRouter (OpenAI-compatible endpoint) ──────────────────────────

async function llmReply(
  compactContext: string,   // string pré-computada, NÃO arrays crus
  userIntent: string,
  fallback: string,
): Promise<string> {
  if (!OPENROUTER_KEY) {
    console.warn("[llm] OPENROUTER_API_KEY não configurada — usando fallback");
    return fallback;
  }

  const userMessage = `Dados da frota:\n${compactContext}\n\nPedido: ${userIntent}`;

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENROUTER_KEY}`,
        "HTTP-Referer": "https://myfrot.ai",
        "X-Title": "MyFrot Manager Bot",
      },
      body: JSON.stringify({
        model: LLM_MODEL,
        max_tokens: 300,        // output curto = custo baixo
        temperature: 0.6,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
      }),
    });

    if (!res.ok) {
      console.error("[llm] OpenRouter error:", res.status, await res.text());
      return fallback;
    }

    const json = await res.json();

    // Log de tokens para rastreamento de custo
    if (json.usage) {
      console.log(
        `[llm] model=${LLM_MODEL} ` +
        `in=${json.usage.prompt_tokens} out=${json.usage.completion_tokens} ` +
        `total=${json.usage.total_tokens}`
      );
    }

    return json.choices?.[0]?.message?.content?.trim() ?? fallback;
  } catch (err) {
    console.error("[llm] exception:", err);
    return fallback;
  }
}

// ── Utils ─────────────────────────────────────────────────────────────────────

const daysSince = (d: string) => Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
const daysUntil = (d: string) => Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
const R$ = (v: number | string | null) =>
  `R$ ${Number(v ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
const fName = (s: string | null) => (s ?? "—").split(" ")[0];
const ptDate = (d: string) => { const [y, m, day] = d.slice(0, 10).split("-"); return `${day}/${m}/${y}`; };

// Retorna a segunda-feira da semana atual (ISO date string)
function currentWeekStart(): string {
  const now = new Date();
  const day = now.getDay(); // 0=dom, 1=seg, ...
  const diff = day === 0 ? -6 : 1 - day;
  const mon = new Date(now);
  mon.setDate(now.getDate() + diff);
  mon.setHours(0, 0, 0, 0);
  return mon.toISOString().slice(0, 10);
}

// Retorna o início e fim do mês atual
function currentMonthRange(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  return { start, end };
}

// Nome do dia da semana em pt-BR (0=dom)
const DAY_NAMES_PT: Record<number, string> = {
  0: "Domingo",
  1: "Segunda",
  2: "Terça",
  3: "Quarta",
  4: "Quinta",
  5: "Sexta",
  6: "Sábado",
};

// ── Auth ──────────────────────────────────────────────────────────────────────

async function resolveClient(chatId: number): Promise<{ id: string; name: string | null; telegram_bot_token: string | null } | null> {
  const { data, error } = await sb.from("clients")
    .select("id, name, telegram_bot_token")
    .eq("telegram_chat_id", String(chatId))
    .maybeSingle();
  if (error) console.error("[auth] error resolving client:", error.message);
  return (data as any) ?? null;
}

// ── Compact summarizers — JS faz o trabalho, LLM recebe strings, não arrays ──
//
// Regra de ouro: cada summarizer retorna UMA string compacta.
// Ex: "3 faturas: João R$700 (3d), Carlos R$450 (1d). Total: R$1.150"
// → ~20 tokens, não 300+.

async function summarizeInvoices(clientId: string): Promise<{ text: string; count: number; total: number }> {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await sb.from("invoices")
    .select("amount, due_date, tenants(name, phone)")   // colunas mínimas
    .eq("client_id", clientId)
    .in("status", ["pending", "overdue"])
    .lt("due_date", today)
    .order("due_date", { ascending: true })
    .limit(8);                                           // cap — frota gigante não explode o contexto

  if (!data?.length) return { text: "sem faturas em atraso", count: 0, total: 0 };

  const total = data.reduce((s, i) => s + Number(i.amount ?? 0), 0);
  // Linha por motorista: "João R$700 (3d)"
  const items = data
    .map(i => `${fName((i as any).tenants?.name)} ${R$(i.amount)} (${i.due_date ? daysSince(i.due_date) : 0}d)`)
    .join(", ");

  return { text: `${data.length} fatura(s): ${items}. Total: ${R$(total)}`, count: data.length, total };
}

async function summarizeFines(clientId: string): Promise<{ text: string; count: number; total: number }> {
  const { data } = await sb.from("fines")
    .select("amount, description, date, vehicles(plate), tenants!fines_tenant_id_fkey(name)")
    .eq("client_id", clientId)
    .eq("status", "pendente")
    .order("date", { ascending: false })
    .limit(8);

  if (!data?.length) return { text: "sem multas pendentes", count: 0, total: 0 };

  const total = data.reduce((s, f) => s + Number(f.amount ?? 0), 0);
  const items = data
    .map(f => {
      const placa = (f as any).vehicles?.plate ?? "—";
      const nome = fName((f as any).tenants?.name);
      const inf = f.description ? f.description.slice(0, 30) : "—";
      return `${placa} ${nome} ${R$(f.amount)} (${inf})`;
    })
    .join(", ");

  return { text: `${data.length} multa(s): ${items}. Total: ${R$(total)}`, count: data.length, total };
}

async function summarizeVistorias(): Promise<{ text: string; count: number }> {
  const { data } = await sb.from("weekly_inspections")
    .select("current_km, created_at, tenants(name), vehicles(plate)")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(6);

  if (!data?.length) return { text: "sem vistorias pendentes", count: 0 };

  const items = data
    .map(i => `${fName((i as any).tenants?.name)}·${(i as any).vehicles?.plate ?? "—"}·${i.current_km ? Number(i.current_km).toLocaleString("pt-BR") + "km" : "—"} (${ptDate(i.created_at.slice(0, 10))})`)
    .join(", ");

  return { text: `${data.length} vistoria(s): ${items}`, count: data.length };
}

async function summarizeVencimentos(clientId: string): Promise<{ text: string; count: number }> {
  const today = new Date().toISOString().slice(0, 10);
  const in15days = new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10);
  const { data } = await sb.from("insurance")
    .select("expiry_date, insurer, vehicles(plate)")
    .eq("client_id", clientId)
    .gte("expiry_date", today)
    .lte("expiry_date", in15days)
    .order("expiry_date");

  if (!data?.length) return { text: "sem seguros vencendo (15d)", count: 0 };

  const items = data
    .map(i => `${(i as any).vehicles?.plate ?? "—"} ${i.insurer ?? "—"} ${daysUntil(i.expiry_date)}d`)
    .join(", ");

  return { text: `${data.length} seguro(s) vencendo: ${items}`, count: data.length };
}

async function summarizePagamentos(clientId: string): Promise<{ text: string; count: number }> {
  const { data } = await sb.from("invoices")
    .select("amount, due_date, tenants(name)")
    .eq("client_id", clientId)
    .eq("status", "paid")
    .order("due_date", { ascending: false })
    .limit(5);

  if (!data?.length) return { text: "nenhum pagamento recebido recentemente", count: 0 };

  const total = data.reduce((s, i) => s + Number(i.amount ?? 0), 0);
  const items = data.map(i => `${fName((i as any).tenants?.name)} ${R$(i.amount)}`).join(", ");

  return { text: `${data.length} último(s) pagamento(s): ${items}. Total Ganhos: ${R$(total)}`, count: data.length };
}

// Agenda de pagamentos desta semana agrupada por dia
async function summarizeWeeklyAgenda(clientId: string): Promise<string> {
  // Busca locatários ativos com dia de pagamento definido e valor semanal
  const { data: tenants } = await sb.from("tenants")
    .select("name, payment_day, rent_weekly, rent_amount")
    .eq("client_id", clientId)
    .eq("status", "ativo")
    .order("payment_day", { ascending: true });

  if (!tenants?.length) return "nenhum locatário ativo";

  // Agrupa por payment_day (0-6, onde 1=segunda)
  const byDay: Record<number, { name: string; value: number }[]> = {};
  for (const t of tenants) {
    const day = t.payment_day ?? 1;
    const value = Number(t.rent_weekly ?? t.rent_amount ?? 0);
    if (!byDay[day]) byDay[day] = [];
    byDay[day].push({ name: fName(t.name), value });
  }

  const todayDow = new Date().getDay();
  const lines: string[] = [];
  for (const [dayStr, motoristas] of Object.entries(byDay)) {
    const day = Number(dayStr);
    const dayName = DAY_NAMES_PT[day] ?? `Dia ${day}`;
    const total = motoristas.reduce((s, m) => s + m.value, 0);
    const names = motoristas.map(m => `${m.name} ${R$(m.value)}`).join(", ");
    const marker = day === todayDow ? " ◀ HOJE" : "";
    lines.push(`${dayName}${marker}: ${names} → Total: ${R$(total)}`);
  }

  return lines.join("\n");
}

// Status dos checks semanais desta semana
async function summarizeWeeklyChecksStatus(clientId: string): Promise<string> {
  const weekStart = currentWeekStart();

  // Total de locatários ativos
  const { count: totalTenants } = await sb.from("tenants")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId)
    .eq("status", "ativo");

  // Checks submetidos esta semana
  const { count: submitted } = await sb.from("weekly_checks")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId)
    .gte("week_start", weekStart)
    .in("status", ["submitted", "approved"]);

  const total = totalTenants ?? 0;
  const done = submitted ?? 0;
  const pending = total - done;

  if (total === 0) return "sem locatários ativos";

  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return `${done}/${total} relatórios semanais enviados (${pct}%) · ${pending} pendente(s)`;
}

// Estado completo em strings condensadas — toda a frota em ~80 tokens
async function buildCompactState(clientId: string): Promise<string> {
  const today = new Date().toISOString().slice(0, 10);
  const since24h = new Date(Date.now() - 86400000).toISOString();

  // Roda em paralelo — única rodada de I/O
  const [vehRes, invData, finesData, inspData, insData, finesNewRes, pagamentosData, agendaText, checksText] = await Promise.all([
    sb.from("vehicles").select("status", { count: "exact" }).eq("client_id", clientId),
    summarizeInvoices(clientId),
    summarizeFines(clientId),
    summarizeVistorias(),
    summarizeVencamentos(clientId),
    sb.from("fines")
      .select("amount, vehicles(plate), tenants!fines_tenant_id_fkey(name)", { count: "exact" })
      .eq("client_id", clientId).eq("status", "pendente").gte("created_at", since24h),
    summarizePagamentos(clientId),
    summarizeWeeklyAgenda(clientId),
    summarizeWeeklyChecksStatus(clientId),
  ]);

  const vehs = vehRes.data ?? [];
  const locados = vehs.filter(v => v.status === "locado").length;
  const total = vehs.length;

  // Multas novas 24h — string compacta
  const newFines = finesNewRes.data ?? [];
  const newFinesText = newFines.length > 0
    ? `${newFines.length} nova(s) (24h): ` +
    newFines.slice(0, 3).map(f => `${(f as any).vehicles?.plate ?? "—"} ${fName((f as any).tenants?.name)} ${R$(f.amount)}`).join(", ")
    : "nenhuma multa nova";

  return [
    `frota: ${locados}/${total} locados`,
    `inadimplencia: ${invData.text}`,
    `recebimentos_recentes: ${pagamentosData.text}`,
    `multas: ${finesData.text}`,
    `multas_novas_24h: ${newFinesText}`,
    `vistorias: ${inspData.text}`,
    `seguros: ${insData.text}`,
    `agenda_semanal:\n${agendaText}`,
    `checks_semanais: ${checksText}`,
  ].join("\n");
}

// Corrige nome da função (typo original preservado para não quebrar nada)
const summarizeVencamentos = summarizeVencimentos;

// ── Fallbacks (sem API key) ───────────────────────────────────────────────────

const FB = {
  resumo: (ctx: string, nome: string) =>
    `📊 ${nome}, aqui o status:\n${ctx}\n\nUse /inadimplentes /multas /vistorias para detalhes.`,

  inadimplentes: (inv: Awaited<ReturnType<typeof summarizeInvoices>>) =>
    inv.count === 0 ? "✅ Caixa limpo." : `💸 ${inv.text}`,

  multas: (fin: Awaited<ReturnType<typeof summarizeFines>>) =>
    fin.count === 0 ? "✅ Sem multas." : `⚖️ ${fin.text}`,

  vistorias: (vis: Awaited<ReturnType<typeof summarizeVistorias>>) =>
    vis.count === 0 ? "✅ Sem vistorias." : `📋 ${vis.text}`,

  vencimentos: (ven: Awaited<ReturnType<typeof summarizeVencimentos>>) =>
    ven.count === 0 ? "✅ Seguros OK (15d)." : `🛡️ ${ven.text}`,
};

// ── Handlers ──────────────────────────────────────────────────────────────────

function handleStart(name: string): string {
  return (
    `Gerente IA da sua frota, ${name}. Comandos disponíveis:\n\n` +
    `/resumo — situação geral: caixa, frota, pendências\n` +
    `/inadimplentes — faturas em atraso\n` +
    `/multas — infrações pendentes\n` +
    `/vistorias — aguardando aprovação\n` +
    `/vencimentos — seguros próximos (15 dias)\n` +
    `/semana — agenda de pagamentos da semana atual\n` +
    `/financeiro — receita mensal e projeção anual\n` +
    `/checkins — relatórios semanais: quem enviou e quem não enviou\n\n` +
    `Ou escreva em linguagem natural. Ex: "Quem tomou mais multas?"`
  );
}

async function handleResumo(clientId: string, nome: string): Promise<string> {
  const ctx = await buildCompactState(clientId);
  const fallback = FB.resumo(ctx, nome);
  return llmReply(ctx, "Resumo executivo da minha operação agora.", fallback);
}

async function handleInadimplentes(clientId: string): Promise<string> {
  const inv = await summarizeInvoices(clientId);
  if (inv.count === 0) return "✅ Caixa limpo. Nenhuma fatura em atraso.";
  return llmReply(
    `inadimplencia: ${inv.text}`,
    "Analise as faturas em atraso e me diga quem cobrar primeiro e como.",
    FB.inadimplentes(inv),
  );
}

async function handleMultas(clientId: string): Promise<string> {
  const fin = await summarizeFines(clientId);
  if (fin.count === 0) return "✅ Sem multas pendentes na frota.";
  return llmReply(
    `multas_pendentes: ${fin.text}`,
    "Qual o risco financeiro das multas e o que devo fazer agora?",
    FB.multas(fin),
  );
}

async function handleVistorias(): Promise<string> {
  const vis = await summarizeVistorias();
  if (vis.count === 0) return "✅ Nenhuma vistoria aguardando aprovação.";
  return llmReply(
    `vistorias_aguardando: ${vis.text}`,
    "Me dê o status das vistorias e o que preciso fazer.",
    FB.vistorias(vis),
  );
}

async function handleVencimentos(clientId: string): Promise<string> {
  const ven = await summarizeVencimentos(clientId);
  if (ven.count === 0) return "✅ Nenhum seguro vencendo nos próximos 15 dias.";
  return llmReply(
    `seguros_vencendo: ${ven.text}`,
    "Qual seguro devo renovar com urgência?",
    FB.vencimentos(ven),
  );
}

// /semana — agenda de pagamentos desta semana agrupada por dia
async function handleSemana(clientId: string): Promise<string> {
  const { data: tenants } = await sb.from("tenants")
    .select("id, name, payment_day, rent_weekly, rent_amount")
    .eq("client_id", clientId)
    .eq("status", "ativo")
    .order("payment_day", { ascending: true });

  if (!tenants?.length) return "Nenhum locatário ativo encontrado.";

  const byDay: Record<number, { id: string; name: string; value: number }[]> = {};
  for (const t of tenants) {
    const day = t.payment_day ?? 1;
    const value = Number(t.rent_weekly ?? t.rent_amount ?? 0);
    if (!byDay[day]) byDay[day] = [];
    byDay[day].push({ id: t.id, name: fName(t.name), value });
  }

  // Verifica pagamentos já recebidos esta semana para cada locatário
  const weekStart = currentWeekStart();
  const allTenantIds = tenants.map(t => t.id);
  const { data: paidsThisWeek } = await sb.from("invoices")
    .select("tenant_id, amount")
    .eq("client_id", clientId)
    .eq("status", "paid")
    .gte("due_date", weekStart)
    .in("tenant_id", allTenantIds);

  const paidSet = new Set((paidsThisWeek ?? []).map(p => p.tenant_id));

  const todayDow = new Date().getDay();
  const lines: string[] = [`📅 Agenda da semana (${new Date().toLocaleDateString("pt-BR")}):\n`];

  let grandTotal = 0;

  for (const [dayStr, motoristas] of Object.entries(byDay).sort((a, b) => Number(a[0]) - Number(b[0]))) {
    const day = Number(dayStr);
    const dayName = DAY_NAMES_PT[day] ?? `Dia ${day}`;
    const dayTotal = motoristas.reduce((s, m) => s + m.value, 0);
    grandTotal += dayTotal;

    const isToday = day === todayDow;
    const prefix = isToday ? "▶ " : "  ";

    const names = motoristas
      .map(m => `${m.name} ${R$(m.value)}${paidSet.has(m.id) ? " ✓" : ""}`)
      .join(", ");

    lines.push(`${prefix}${dayName}: ${names}`);
    lines.push(`   → Total do dia: ${R$(dayTotal)}`);
  }

  lines.push(`\nTotal esperado na semana: ${R$(grandTotal)}`);
  lines.push(`(✓ = já recebido esta semana)`);

  return lines.join("\n");
}

// /financeiro — receita mensal e projeção anual
async function handleFinanceiro(clientId: string): Promise<string> {
  const { start: monthStart, end: monthEnd } = currentMonthRange();
  const weekStart = currentWeekStart();

  const [weekRes, monthRes, overdueRes, tenantsRes] = await Promise.all([
    // Receita da semana atual
    sb.from("invoices")
      .select("amount")
      .eq("client_id", clientId)
      .eq("status", "paid")
      .gte("due_date", weekStart),

    // Receita do mês atual
    sb.from("invoices")
      .select("amount")
      .eq("client_id", clientId)
      .eq("status", "paid")
      .gte("due_date", monthStart)
      .lte("due_date", monthEnd),

    // Inadimplência: total de faturas vencidas não pagas
    sb.from("invoices")
      .select("amount")
      .eq("client_id", clientId)
      .in("status", ["pending", "overdue"])
      .lt("due_date", new Date().toISOString().slice(0, 10)),

    // Média de aluguel para projeção
    sb.from("tenants")
      .select("rent_weekly, rent_amount")
      .eq("client_id", clientId)
      .eq("status", "ativo"),
  ]);

  const weekRev = (weekRes.data ?? []).reduce((s, i) => s + Number(i.amount ?? 0), 0);
  const monthRev = (monthRes.data ?? []).reduce((s, i) => s + Number(i.amount ?? 0), 0);
  const overdue = (overdueRes.data ?? []).reduce((s, i) => s + Number(i.amount ?? 0), 0);

  // Projeção: média de aluguel semanal * 4.33 * 12 (por locatário ativo)
  const activeTenants = tenantsRes.data ?? [];
  const avgWeekly = activeTenants.length > 0
    ? activeTenants.reduce((s, t) => s + Number(t.rent_weekly ?? t.rent_amount ?? 0), 0)
    : 0;
  const monthlyProjection = avgWeekly * 4.33;
  const annualProjection = monthlyProjection * 12;

  const lines = [
    `💰 Financeiro da frota:\n`,
    `Semana atual: ${R$(weekRev)} recebidos`,
    `Mês atual (${new Date().toLocaleDateString("pt-BR", { month: "long" })}): ${R$(monthRev)} recebidos`,
    ``,
    `Projeção mensal (${activeTenants.length} ativos × media ${R$(avgWeekly)}/sem × 4,33): ${R$(monthlyProjection)}`,
    `Projeção anual: ${R$(annualProjection)}`,
    ``,
    `Inadimplência em aberto: ${R$(overdue)}`,
  ];

  return lines.join("\n");
}

// /checkins — quem enviou o relatório semanal e quem não enviou
async function handleCheckins(clientId: string): Promise<string> {
  const weekStart = currentWeekStart();

  // Todos os locatários ativos
  const { data: tenants } = await sb.from("tenants")
    .select("id, name, vehicles(plate)")
    .eq("client_id", clientId)
    .eq("status", "ativo");

  if (!tenants?.length) return "Nenhum locatário ativo.";

  // Checks enviados esta semana
  const { data: checks } = await sb.from("weekly_checks")
    .select("tenant_id, current_km, oil_level, status, submitted_at")
    .eq("client_id", clientId)
    .gte("week_start", weekStart)
    .in("status", ["submitted", "approved"]);

  const checkMap = new Map<string, { current_km: number | null; oil_level: string | null; status: string }>();
  for (const c of (checks ?? [])) {
    checkMap.set(c.tenant_id, { current_km: c.current_km, oil_level: c.oil_level, status: c.status });
  }

  const submitted: string[] = [];
  const pending: string[] = [];

  for (const t of tenants) {
    const check = checkMap.get(t.id);
    const plate = (t as any).vehicles?.plate ?? "—";
    if (check) {
      const km = check.current_km ? `${Number(check.current_km).toLocaleString("pt-BR")}km` : "km?";
      const oil = check.oil_level === "ok" ? "óleo OK" : check.oil_level === "baixo" ? "óleo BAIXO" : check.oil_level === "trocar" ? "TROCAR ÓLEO" : "óleo?";
      const st = check.status === "approved" ? "✅" : "📋";
      submitted.push(`${st} ${fName(t.name)} (${plate}): ${km} · ${oil}`);
    } else {
      pending.push(`❌ ${fName(t.name)} (${plate}): não enviou`);
    }
  }

  const weekStartFmt = ptDate(weekStart);
  const lines = [
    `📋 Relatórios semanais (semana de ${weekStartFmt}):\n`,
    `Enviados (${submitted.length}/${tenants.length}):`,
    ...(submitted.length ? submitted : ["  — nenhum ainda"]),
    ``,
    `Pendentes (${pending.length}):`,
    ...(pending.length ? pending : ["  — todos enviaram! ✅"]),
  ];

  return lines.join("\n");
}

async function handleFreeText(clientId: string, text: string, nome: string): Promise<string> {
  // Guard: small-talk já foi filtrado antes de chegar aqui.
  // Para perguntas reais, usa estado compacto como contexto.
  const ctx = await buildCompactState(clientId);
  return llmReply(ctx, text, `Não entendi, ${nome}. Tente /resumo para a situação geral.`);
}

// ── Main handler ──────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method !== "POST") return new Response("ok");

  let update: any;
  try { update = await req.json(); }
  catch { return new Response("bad json", { status: 400 }); }

  const msg = update?.message ?? update?.edited_message;
  if (!msg) return new Response("ok");

  const chatId = msg.chat?.id;
  const rawText = (msg.text ?? "").trim();
  const userFirst = msg.from?.first_name ?? "Chefe";

  if (!chatId) return new Response("ok");

  // Mídias sem texto
  if (!rawText) {
    await tgSend(chatId, "Só processo texto por enquanto. Manda /resumo ou uma pergunta.");
    return new Response("ok");
  }

  const cmd = rawText.split(" ")[0].toLowerCase();

  // /start — pode ser dono (sem payload) OU locatário (payload = tenantId)
  if (cmd === "/start" || cmd === "/ajuda" || cmd === "/help") {
    const payload = rawText.split(" ")[1]?.trim(); // Ex: /start abc-uuid-do-tenant

    // Se há payload, tenta registrar como locatário
    if (payload && payload.length > 10) {
      const { data: tenant, error: tErr } = await sb
        .from("tenants")
        .select("id, name, client_id")
        .eq("id", payload)
        .maybeSingle();

      if (!tErr && tenant) {
        // Salva chat_id do locatário
        await sb.from("tenants")
          .update({ telegram_chat_id: String(chatId) })
          .eq("id", tenant.id);

        await tgSend(chatId,
          `✅ Olá, ${fName(tenant.name)}!\n\n` +
          `Seu Telegram foi vinculado com sucesso.\n` +
          `Você vai receber cobranças PIX diretamente aqui.\n\n` +
          `Quando uma cobrança for gerada, enviaremos o QR Code e o código Copia-e-Cola para você pagar rapidinho. 💰`
        );
        return new Response("ok");
      }
    }

    // Sem payload válido = dono da frota
    await tgSend(chatId, handleStart(userFirst));
    return new Response("ok");
  }

  // Small-talk — sem auth, sem DB, sem LLM — resposta instantânea
  if (SMALL_TALK_RE.test(rawText) && !rawText.startsWith("/")) {
    await tgSend(chatId, SMALL_TALK_REPLY);
    return new Response("ok");
  }

  // Auth
  const client = await resolveClient(chatId);
  const nome = client?.name ? fName(client.name) : userFirst;

  if (!client) {
    await tgSend(chatId,
      `🔒 Acesso não autorizado.\nChat ID: <code>${chatId}</code>\n\n` +
      `Cadastre em Motor IA → Gerente no Telegram no app MyFrot.`
    );
    return new Response("ok");
  }

  const clientToken = client.telegram_bot_token ?? undefined;

  // Typing indicator enquanto processa
  await tgTyping(chatId, clientToken);

  let reply: string;
  try {
    switch (cmd) {
      case "/resumo":
        reply = await handleResumo(client.id, nome); break;
      case "/inadimplentes":
      case "/devendo":
      case "/calotes":
        reply = await handleInadimplentes(client.id); break;
      case "/multas":
      case "/infracoes":
      case "/infrações":
        reply = await handleMultas(client.id); break;
      case "/vistorias":
      case "/vistoria":
        reply = await handleVistorias(); break;
      case "/vencimentos":
      case "/seguros":
        reply = await handleVencimentos(client.id); break;
      case "/semana":
      case "/agenda":
        reply = await handleSemana(client.id); break;
      case "/financeiro":
      case "/financas":
      case "/finanças":
      case "/receita":
        reply = await handleFinanceiro(client.id); break;
      case "/checkins":
      case "/checkin":
      case "/relatorios":
      case "/relatórios":
        reply = await handleCheckins(client.id); break;
      default:
        if (rawText.startsWith("/")) {
          reply = "Comando não reconhecido. Disponíveis: /resumo /inadimplentes /multas /vistorias /vencimentos /semana /financeiro /checkins";
        } else {
          // Texto livre real (não small-talk) — passa pelo LLM com contexto compacto
          reply = await handleFreeText(client.id, rawText, nome);
        }
    }
  } catch (err) {
    console.error("[handler]", err);
    reply = "Erro interno. Tente /resumo em alguns segundos.";
  }

  await tgSend(chatId, reply, clientToken);
  return new Response("ok");
});
