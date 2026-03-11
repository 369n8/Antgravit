/**
 * daily-ai-report — Edge Function (Briefing Matinal Proativo)
 *
 * DISPARO: Cron às 11:00 UTC (08:00 BRT) todos os dias via pg_cron/pg_net
 *          ou manual via POST { manual_for_client: "<uuid>" }
 *
 * PIPELINE:
 *   1. Busca todos os clients com telegram_chat_id preenchido
 *   2. Para cada client: map/reduce no banco → string compacta ~80 tokens
 *   3. OpenRouter (Gemini 2.0 Flash) → briefing executivo humanizado
 *   4. sendMessage no Telegram do dono da frota (NUNCA dos motoristas)
 *
 * IMPORTANTE: O briefing vai APENAS para o dono da frota via Telegram.
 * Motoristas/locatários NÃO recebem comunicação por este canal.
 *
 * SECRETS necessários (Supabase Dashboard → Edge Functions → Secrets):
 *   OPENROUTER_API_KEY       → chave do OpenRouter
 *   OPENROUTER_MODEL         → (opcional) default: google/gemini-2.0-flash-001
 *   TELEGRAM_BOT_TOKEN       → token do @BotFather
 *   SUPABASE_URL             → automático
 *   SUPABASE_SERVICE_ROLE_KEY→ automático
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

// ── Env ───────────────────────────────────────────────────────────────────────

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BOT_TOKEN    = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
const OR_KEY       = Deno.env.get("OPENROUTER_API_KEY") ?? "";
const LLM_MODEL    = Deno.env.get("OPENROUTER_MODEL") ?? "google/gemini-2.0-flash-001";

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── System Prompt (briefing matinal — tom proativo, não reativo) ──────────────

const BRIEFING_SYSTEM_PROMPT =
  `Você é o Diretor Operacional da MyFrot entregando o briefing das 08h para o dono da frota via Telegram.
CONTEXTO: O dono gerencia locatários (motoristas) com pagamentos semanais. Cada motorista deve enviar um
relatório semanal com km atual + nível de óleo + foto/vídeo do veículo. Hoje pode haver cobranças vencendo.
REGRAS ABSOLUTAS:
1. Comece diretamente pelo risco mais alto. Sem introduções longas.
2. Omita categorias zeradas (ex: se não há multas, NÃO mencione multas).
3. Para cada risco: valor total + pior caso pelo nome. Ex: "3 faturas em atraso (R$ 2.100) — pior: João, 5 dias."
4. Inclua agenda do dia se houver cobranças vencendo hoje.
5. Inclua status dos relatórios semanais se houver pendentes.
6. Termine com UMA pergunta de ação concreta. Ex: "Devo cobrar o João agora?"
7. Máximo 8 linhas. Sem asteriscos. Valores no formato R$ 1.234,56.`;

// ── Utils ─────────────────────────────────────────────────────────────────────

const daysSince  = (d: string) => Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
const daysUntil  = (d: string) => Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
const R$         = (v: number | string | null) =>
  `R$ ${Number(v ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
const fName      = (s: string | null | undefined) => (s ?? "—").split(" ")[0];

// Retorna segunda-feira da semana atual
function currentWeekStart(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const mon = new Date(now);
  mon.setDate(now.getDate() + diff);
  mon.setHours(0, 0, 0, 0);
  return mon.toISOString().slice(0, 10);
}

// Início e fim do mês atual
function currentMonthRange(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  return { start, end };
}

// ── Telegram helper ───────────────────────────────────────────────────────────

async function tgSend(chatId: string, text: string, token?: string): Promise<void> {
  const tk = token || BOT_TOKEN;
  if (!tk || !chatId) return;
  const res = await fetch(`https://api.telegram.org/bot${tk}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  });
  if (!res.ok) console.error("[tgSend] error:", res.status, await res.text());
}

// ── LLM via OpenRouter ────────────────────────────────────────────────────────

async function llmBriefing(compactState: string, clientName: string): Promise<string | null> {
  if (!OR_KEY) return null;

  const weekday = new Date().toLocaleDateString("pt-BR", {
    weekday: "long", timeZone: "America/Sao_Paulo",
  });
  const dateStr = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo",
  });

  const userMessage =
    `Dados da frota de ${clientName} em ${weekday}, ${dateStr}:\n${compactState}`;

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OR_KEY}`,
        "HTTP-Referer": "https://myfrot.ai",
        "X-Title": "MyFrot Daily Report",
      },
      body: JSON.stringify({
        model: LLM_MODEL,
        max_tokens: 350,
        temperature: 0.65,
        messages: [
          { role: "system", content: BRIEFING_SYSTEM_PROMPT },
          { role: "user",   content: userMessage },
        ],
      }),
    });

    if (!res.ok) {
      console.error("[llm] OpenRouter error:", res.status, await res.text());
      return null;
    }

    const json = await res.json();

    if (json.usage) {
      console.log(
        `[llm] client=${clientName} model=${LLM_MODEL} ` +
        `in=${json.usage.prompt_tokens} out=${json.usage.completion_tokens} ` +
        `total=${json.usage.total_tokens}`
      );
    }

    return json.choices?.[0]?.message?.content?.trim() ?? null;
  } catch (err) {
    console.error("[llm] exception:", err);
    return null;
  }
}

// ── Compact summarizers (JS faz o trabalho, LLM recebe strings, não arrays) ──

async function summarizeInvoices(clientId: string): Promise<{ text: string; count: number; total: number }> {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await sb.from("invoices")
    .select("amount, due_date, tenants(name)")
    .eq("client_id", clientId)
    .in("status", ["pending", "overdue"])
    .lt("due_date", today)
    .order("due_date", { ascending: true })
    .limit(8);

  if (!data?.length) return { text: "zero faturas em atraso", count: 0, total: 0 };
  const total = data.reduce((s, i) => s + Number(i.amount ?? 0), 0);
  const items = data
    .map(i => `${fName((i as any).tenants?.name)} ${R$(i.amount)} (${i.due_date ? daysSince(i.due_date) : 0}d)`)
    .join(", ");
  return { text: `${data.length} fatura(s): ${items}. Total: ${R$(total)}`, count: data.length, total };
}

async function summarizeFines(clientId: string): Promise<{ text: string; count: number; total: number }> {
  const since24h = new Date(Date.now() - 86400000).toISOString();

  const [pendRes, newRes] = await Promise.all([
    sb.from("fines")
      .select("amount, vehicles(plate), tenants!fines_tenant_id_fkey(name)")
      .eq("client_id", clientId).eq("status", "pendente")
      .order("date", { ascending: false }).limit(6),
    sb.from("fines")
      .select("id", { count: "exact", head: true })
      .eq("client_id", clientId).eq("status", "pendente").gte("created_at", since24h),
  ]);

  const data  = pendRes.data ?? [];
  const newCt = newRes.count ?? 0;

  if (!data.length) return { text: "zero multas pendentes", count: 0, total: 0 };
  const total = data.reduce((s, f) => s + Number(f.amount ?? 0), 0);
  const items = data
    .map(f => `${(f as any).vehicles?.plate ?? "—"} ${fName((f as any).tenants?.name)} ${R$(f.amount)}`)
    .join(", ");
  const newNote = newCt > 0 ? ` [+${newCt} nova(s) esta madrugada]` : "";
  return { text: `${data.length} multa(s)${newNote}: ${items}. Total: ${R$(total)}`, count: data.length, total };
}

async function summarizeVehicles(clientId: string): Promise<string> {
  const { data } = await sb.from("vehicles")
    .select("status")
    .eq("client_id", clientId);
  if (!data?.length) return "frota vazia";
  const locados = data.filter(v => v.status === "locado").length;
  return `${locados}/${data.length} locados`;
}

async function summarizeVistorias(clientId: string): Promise<{ text: string; count: number }> {
  const { data } = await sb.from("weekly_inspections")
    .select("current_km, tenant_id, tenants(name), vehicles(plate)")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(5);
  // Filtra vistorias dos tenants deste client
  const { data: clientTenants } = await sb.from("tenants")
    .select("id").eq("client_id", clientId);
  const tenantIds = new Set((clientTenants ?? []).map((t: any) => t.id));
  const filtered = (data ?? []).filter((i: any) => tenantIds.has(i.tenant_id));
  if (!filtered.length) return { text: "zero vistorias pendentes", count: 0 };
  const items = filtered
    .map((i: any) => `${fName(i.tenants?.name)}·${i.vehicles?.plate ?? "—"}`)
    .join(", ");
  return { text: `${filtered.length} vistoria(s) pendente(s): ${items}`, count: filtered.length };
}

async function summarizeInsurance(clientId: string): Promise<{ text: string; count: number }> {
  const today    = new Date().toISOString().slice(0, 10);
  const in15days = new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10);
  const { data } = await sb.from("insurance")
    .select("expiry_date, insurer, vehicles(plate)")
    .eq("client_id", clientId)
    .gte("expiry_date", today).lte("expiry_date", in15days)
    .order("expiry_date");
  if (!data?.length) return { text: "zero seguros vencendo (15d)", count: 0 };
  const items = data
    .map(i => `${(i as any).vehicles?.plate ?? "—"} ${i.insurer ?? "—"} ${daysUntil(i.expiry_date)}d`)
    .join(", ");
  return { text: `${data.length} seguro(s) vencendo: ${items}`, count: data.length };
}

// Cobranças que vencem hoje (ainda não pagas)
async function summarizeTodayDue(clientId: string): Promise<{ text: string; count: number; total: number }> {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await sb.from("invoices")
    .select("amount, tenants(name)")
    .eq("client_id", clientId)
    .in("status", ["pending", "overdue"])
    .eq("due_date", today)
    .limit(10);

  if (!data?.length) return { text: "nenhuma cobrança vence hoje", count: 0, total: 0 };

  const total = data.reduce((s, i) => s + Number(i.amount ?? 0), 0);
  const items = data
    .map(i => `${fName((i as any).tenants?.name)} ${R$(i.amount)}`)
    .join(", ");

  return {
    text: `${data.length} cobrança(s) vencem hoje: ${items}. Total: ${R$(total)}`,
    count: data.length,
    total,
  };
}

// Status dos relatórios semanais
async function summarizeWeeklyChecks(clientId: string): Promise<{ text: string }> {
  const weekStart = currentWeekStart();

  // Total locatários ativos
  const { count: totalTenants } = await sb.from("tenants")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId)
    .eq("status", "ativo");

  // Checks enviados esta semana
  const { count: submitted } = await sb.from("weekly_checks")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId)
    .gte("week_start", weekStart)
    .in("status", ["submitted", "approved"]);

  const total = totalTenants ?? 0;
  const done = submitted ?? 0;
  const pending = total - done;

  if (total === 0) return { text: "sem locatários ativos para relatório semanal" };

  if (pending === 0) {
    return { text: `todos os ${total} motoristas enviaram o relatório semanal` };
  }

  return {
    text: `${done}/${total} motoristas enviaram o relatório semanal · ${pending} ainda não enviou`,
  };
}

// Projeção financeira mensal e anual
async function summarizeFinancialProjection(clientId: string): Promise<{ text: string }> {
  const { start: monthStart, end: monthEnd } = currentMonthRange();

  const [monthRes, tenantsRes] = await Promise.all([
    sb.from("invoices")
      .select("amount")
      .eq("client_id", clientId)
      .eq("status", "paid")
      .gte("due_date", monthStart)
      .lte("due_date", monthEnd),
    sb.from("tenants")
      .select("rent_weekly, rent_amount")
      .eq("client_id", clientId)
      .eq("status", "ativo"),
  ]);

  const monthRev = (monthRes.data ?? []).reduce((s, i) => s + Number(i.amount ?? 0), 0);
  const activeTenants = tenantsRes.data ?? [];
  const totalWeeklyRent = activeTenants.reduce((s, t) => s + Number(t.rent_weekly ?? t.rent_amount ?? 0), 0);
  const monthlyProjection = totalWeeklyRent * 4.33;
  const annualProjection = monthlyProjection * 12;

  const monthName = new Date().toLocaleDateString("pt-BR", { month: "long" });

  return {
    text: [
      `receita_${monthName}: ${R$(monthRev)}`,
      `projeção_mensal (${activeTenants.length} ativos × ${R$(totalWeeklyRent)}/sem × 4,33): ${R$(monthlyProjection)}`,
      `projeção_anual: ${R$(annualProjection)}`,
    ].join(" · "),
  };
}

// Estado completo condensado — toda a frota em ~100 tokens para o LLM
async function buildCompactState(clientId: string): Promise<string> {
  const [
    vehText,
    invData,
    finData,
    visData,
    insData,
    todayDueData,
    weeklyChecksData,
    financialData,
  ] = await Promise.all([
    summarizeVehicles(clientId),
    summarizeInvoices(clientId),
    summarizeFines(clientId),
    summarizeVistorias(clientId),
    summarizeInsurance(clientId),
    summarizeTodayDue(clientId),
    summarizeWeeklyChecks(clientId),
    summarizeFinancialProjection(clientId),
  ]);

  return [
    `frota: ${vehText}`,
    `inadimplencia: ${invData.text}`,
    `multas: ${finData.text}`,
    `vistorias: ${visData.text}`,
    `seguros: ${insData.text}`,
    `cobranças_hoje: ${todayDueData.text}`,
    `relatórios_semanais: ${weeklyChecksData.text}`,
    `financeiro: ${financialData.text}`,
  ].join("\n");
}

// Fallback humanizado (sem API key ou falha do LLM)
function buildFallbackBriefing(
  compactState: string,
  nome: string,
  weekday: string,
  dateStr: string,
): string {
  const lines = [
    `🌅 <b>Bom dia, ${nome}! ${weekday}, ${dateStr}</b>`,
    "",
    compactState
      .split("\n")
      .map(l => `  ${l}`)
      .join("\n"),
    "",
    "━━━━━━━━━━━━━━━",
    "💬 <i>/resumo /multas /inadimplentes /vistorias /vencimentos /semana /financeiro /checkins</i>",
  ];
  return lines.join("\n");
}

// ── Per-client briefing ───────────────────────────────────────────────────────

async function sendDailyBriefing(client: {
  id: string;
  name: string | null;
  telegram_chat_id: string | null;
  telegram_bot_token?: string | null;
}): Promise<void> {
  if (!client.telegram_chat_id) return;

  const nome = fName(client.name);
  const weekday = new Date().toLocaleDateString("pt-BR", {
    weekday: "long", timeZone: "America/Sao_Paulo",
  });
  const dateStr = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo",
  });
  const weekdayCap = weekday.charAt(0).toUpperCase() + weekday.slice(1);

  const compactState = await buildCompactState(client.id);

  // Tenta LLM — se falhar usa fallback estruturado
  const llmText = await llmBriefing(compactState, nome);

  let message: string;
  if (llmText) {
    // Cabeçalho + corpo do LLM
    message = `🌅 <b>Bom dia, ${nome}!</b>\n<i>${weekdayCap}, ${dateStr}</i>\n\n${llmText}`;
  } else {
    message = buildFallbackBriefing(compactState, nome, weekdayCap, dateStr);
  }

  await tgSend(client.telegram_chat_id, message, client.telegram_bot_token ?? undefined);
  console.log(`[daily-ai-report] sent to ${nome} (${client.telegram_chat_id}) llm=${!!llmText}`);
}

// ── Main handler ──────────────────────────────────────────────────────────────

serve(async (req) => {
  const CORS = { "Content-Type": "application/json" };

  try {
    // Suporte a disparo manual (UI ou teste): POST { manual_for_client: "<uuid>" }
    let manualClientId: string | null = null;
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      manualClientId = body?.manual_for_client ?? null;
    }

    // Busca clientes com Telegram configurado
    let query = sb
      .from("clients")
      .select("id, name, telegram_chat_id, telegram_bot_token")
      .not("telegram_chat_id", "is", null);

    if (manualClientId) {
      query = query.eq("id", manualClientId) as typeof query;
    }

    const { data: clients, error } = await query;
    if (error) throw error;

    if (!clients?.length) {
      return new Response(
        JSON.stringify({ ok: true, message: "Nenhum cliente com Telegram configurado." }),
        { status: 200, headers: CORS }
      );
    }

    // Envia briefings em paralelo (cada cliente é independente)
    await Promise.allSettled(
      clients.map(c => sendDailyBriefing(c as any))
    );

    return new Response(
      JSON.stringify({ ok: true, clients_notified: clients.length, manual: !!manualClientId }),
      { status: 200, headers: CORS }
    );
  } catch (e) {
    console.error("[daily-ai-report] exception:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: CORS });
  }
});
