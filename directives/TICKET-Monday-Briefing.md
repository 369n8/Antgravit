# TICKET: Briefing Estratégico de Segunda-Feira (07:00)

> **Prioridade:** 🟠 ALTA — Diferencial de lock-in: o frotista começa a semana com estratégia pronta
> **Estimativa:** 2-3 horas
> **Dependências:** Edge Function `daily-ai-report` já existente (adaptar, não criar do zero)

---

## Problema

O briefing diário das 08h dá o estado do dia. Mas segunda-feira é diferente: o frotista precisa saber o que **aconteceu na semana passada** e o que **vai exigir atenção esta semana**. O resumo genérico não dá isso.

Um frotista que recebe toda segunda uma análise estratégica pronta **não abandona o produto**.

---

## Solução

Criar um modo especial para a segunda-feira: o **Briefing Semanal Estratégico**, que chega às 07:00 (1 hora antes do briefing normal).

### Formato da mensagem no Telegram

```
📊 SEMANA ENCERRADA — Balanço Executivo
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🗓️ Semana: 03/03 a 09/03/2026

💰 FINANCEIRO
├ Receita recebida: R$ 4.200
├ Em aberto: R$ 800 (2 motoristas)
└ vs. semana anterior: ▲ 12%

🚗 FROTA
├ Carros locados: 8 de 10
├ Check-ins recebidos: 6 de 8 ⚠️
└ Manutenções atrasadas: 1 (Honda Civic)

⚠️ PRIORIDADES DESTA SEMANA
1. Cobrar João Silva — R$400 (14 dias atraso)
2. Renovar seguro do Corolla (vence 15/03)
3. Aprovar 2 vistorias pendentes

🎯 META DA SEMANA
Com 2 carros disponíveis, você pode locar e faturar +R$ 700 esta semana.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 Use /semana para ver agenda detalhada
```

---

## Implementação

### 1. Modificar `daily-ai-report` para detectar segunda-feira

```typescript
// supabase/functions/daily-ai-report/index.ts

const today = new Date();
const dayOfWeek = today.getDay(); // 0=Dom, 1=Seg, ...

if (dayOfWeek === 1) {
  // Segunda-feira: gerar relatório semanal estratégico
  await sendWeeklyStrategicBriefing(supabaseClient, tenantId, chatId);
} else {
  // Outros dias: briefing diário padrão
  await sendDailyBriefing(supabaseClient, tenantId, chatId);
}
```

### 2. Função `sendWeeklyStrategicBriefing`

```typescript
async function sendWeeklyStrategicBriefing(client, tenantId, chatId) {
  const lastMonday = getLastMonday();
  const lastSunday = getLastSunday();

  // Consultar dados da semana anterior
  const { data: payments } = await client
    .from('payments')
    .select('amount, status, tenant_id')
    .eq('tenant_id', tenantId)
    .gte('created_at', lastMonday.toISOString())
    .lte('created_at', lastSunday.toISOString());

  const recebido = payments?.filter(p => p.status === 'pago').reduce((s, p) => s + p.amount, 0) ?? 0;
  const emAberto = payments?.filter(p => p.status === 'pendente').reduce((s, p) => s + p.amount, 0) ?? 0;

  // Consultar check-ins da semana
  const { data: checkins } = await client
    .from('weekly_checkins')
    .select('*')
    .eq('tenant_id', tenantId)
    .gte('week_start', lastMonday.toISOString().slice(0, 10));

  // Consultar inadimplentes (> 7 dias)
  const { data: overdue } = await client
    .from('payments')
    .select('amount, tenants(name)')
    .eq('tenant_id', tenantId)
    .eq('status', 'pendente')
    .lte('due_date', new Date(Date.now() - 7 * 86400000).toISOString());

  // Veículos disponíveis
  const { data: available } = await client
    .from('vehicles')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('status', 'disponivel');

  // Montar e enviar mensagem
  const msg = buildWeeklyMessage({ recebido, emAberto, checkins, overdue, available });
  await sendTelegram(chatId, msg);
}
```

### 3. Ajuste no Cron

O cron do `daily-ai-report` já existe. Apenas garantir que na segunda-feira ele rode às **07:00** (1h antes do normal):

```sql
-- Atualizar cron para segunda-feira rodar às 07:00
-- Dias úteis (ter-sáb) rodam às 08:00, segunda às 07:00
-- Opção simples: manter às 08:00 e dentro da função tratar o conteúdo diferente
-- (mais simples, menos infra)
```

---

## Por que 07:00 na segunda?

O frotista acorda cedo. Às 07h de segunda ele está tomando café e decidindo o dia. Se chegar a análise da semana **antes** de ele abrir qualquer planilha ou WhatsApp, ele vai tomar decisões melhores E vai associar o produto ao sucesso da decisão.

**Isso é lock-in emocional.** Depois de 3 semanas recebendo isso, ele não cancela.

---

## Critério de Aprovação

- [ ] Segunda-feira às 07:00: mensagem semanal estratégica chega
- [ ] Terça a domingo às 08:00: briefing diário normal
- [ ] Receita semanal calculada corretamente (pago vs. pendente)
- [ ] Prioridades da semana listadas (máximo 3 itens)
- [ ] Meta da semana calculada com base em carros disponíveis
