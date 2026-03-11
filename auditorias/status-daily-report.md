# Diagnóstico: daily-ai-report
> Auditoria em 2026-03-11

## STATUS GERAL: ✅ Funcional com 2 correções aplicadas

---

## 1. Disparo por Cron
**PROBLEMA ENCONTRADO:** Nenhuma migration de pg_cron existia para o `daily-ai-report`.
- `fines-scanner`: ✅ cron em `20260309000004_fines_scanner_cron.sql`
- `weekly-billing`: ✅ cron em `20260310000005_weekly_billing_cron.sql`
- `reminder-bot`: ✅ cron em `20260310000005_weekly_billing_cron.sql`
- `daily-ai-report`: ❌ **SEM cron** — executava apenas manualmente

**CORREÇÃO APLICADA:** Criado `20260311000001_daily_report_cron.sql`
```sql
SELECT cron.schedule('daily-ai-report', '0 11 * * *', ...)
-- todos os dias às 11:00 UTC = 08:00 BRT
```
**AÇÃO PENDENTE:** Executar `npx supabase db push -p "supabase368"` para aplicar.

---

## 2. ADMIN_TELEGRAM_ID
A função **NÃO usa** `ADMIN_TELEGRAM_ID`. Ela lê `clients.telegram_chat_id` diretamente do banco.
Isso é correto — cada dono de frota tem seu próprio Chat ID. ✅

---

## 3. Bug: summarizeVistorias sem filtro client_id
**PROBLEMA:** A função consultava `weekly_inspections` sem filtrar por `client_id`.
Resultado: em um SaaS multi-tenant, todos os clientes veriam vistorias de outros clientes.

**CORREÇÃO APLICADA:** `summarizeVistorias(clientId)` agora cruza com os `tenants` do client.

---

## 4. OpenRouter / LLM
- Usa `google/gemini-2.0-flash-001` por padrão (configurável via `OPENROUTER_MODEL`)
- `OR_KEY` lido de `OPENROUTER_API_KEY` — configurado nos secrets do Supabase ✅
- Se LLM falhar: cai para `buildFallbackBriefing()` (texto estruturado sem IA) ✅
- Tokens logados: `in=X out=Y total=Z` por request ✅

---

## 5. try/catch e erros silenciosos
- Handler principal tem `try/catch` com `console.error` — erros aparecem nos logs ✅
- `llmBriefing()` tem try/catch próprio, retorna `null` em falha (não derruba o processo) ✅
- `Promise.allSettled` para enviar briefings a múltiplos clients — falha de um não afeta outros ✅
- **Risco identificado:** `tgSend` não tem retry — se Telegram retornar 429 (rate limit) a mensagem é perdida silenciosamente. Não é crítico agora.

---

## BLOQUEIO ATUAL
O `daily-ai-report` só enviará mensagens para clients com `telegram_chat_id` preenchido.
- **teste@frotaapp.com**: `telegram_chat_id = 6346777734` ✅ (receberá o briefing)
- **dtrikerw@gmail.com**: `telegram_chat_id = null` ❌ (precisa configurar o bot via Motor IA)
