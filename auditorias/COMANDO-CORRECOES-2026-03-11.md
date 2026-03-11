# COMANDO DE CORRECOES — MyFrot.ai
## Cole este bloco inteiro no Claude Code ou Antigravity

---

Voce e um agente de desenvolvimento senior. Execute as correcoes abaixo em ordem de prioridade. Para cada item: leia o arquivo relevante, faca a correcao, teste se possivel, e confirme o que foi feito. Nao pergunte — execute.

## CONTEXTO DO PROJETO
- Projeto: MyFrot.ai (SaaS de gestao de frotas)
- Stack: React + Vite (frontend), Supabase Edge Functions (backend), Telegram Bot, Stripe, PIX
- Arquitetura: 3 camadas (directives/ → orquestracao → execution/)
- Raiz do projeto: pasta atual

---

## CORRECAO 1 — BUG DASHBOARD V2 (CRITICO - 5 min)

**Problema:** DashboardV2.jsx tem ReferenceError com variavel `fineProfit` nao definida ou mal posicionada.

**Acao:**
1. Leia `execution/frontend/src/components/DashboardV2.jsx`
2. Encontre todas as referencias a `fineProfit`
3. Verifique se a variavel e calculada ANTES de ser usada
4. Se nao for, mova o calculo para o lugar correto ou inicialize com valor padrao (0)
5. Verifique se ha outros ReferenceErrors similares no mesmo arquivo
6. Salve e confirme a correcao

---

## CORRECAO 2 — SEGURANCA: FINES_WEBHOOK_SECRET (CRITICO - 2 min)

**Problema:** O secret atual ("super_secret_benny_123_abc") e fraco e previsivel.

**Acao:**
1. Gere um novo secret seguro usando crypto.randomUUID() ou similar em Node
2. Atualize o valor de `FINES_WEBHOOK_SECRET` no arquivo `.env` da raiz
3. Documente que este secret tambem precisa ser atualizado nos Supabase Secrets via:
   `supabase secrets set FINES_WEBHOOK_SECRET=<novo_valor>`
4. Confirme a correcao

---

## CORRECAO 3 — VALIDAR DAILY-AI-REPORT (ALTO - 30 min)

**Problema:** O relatorio diario matinal (principal diferencial do produto) pode estar desconectado ou com erro silencioso.

**Acao:**
1. Leia `supabase/functions/daily-ai-report/index.ts`
2. Verifique:
   - A funcao esta sendo triggerada por cron? (procure em supabase/migrations por pg_cron relacionado)
   - Ela usa ADMIN_TELEGRAM_ID corretamente?
   - Ela chama o LLM via OpenRouter?
   - Ha algum try/catch que pode estar engolindo erros silenciosamente?
3. Leia `supabase/functions/ai-manager-bot/index.ts` tambem
4. Se encontrar problemas, corrija-os
5. Se a funcao parece boa mas o ADMIN_TELEGRAM_ID estiver vazio, documente isso como bloqueio
6. Crie um arquivo `auditorias/status-daily-report.md` com o diagnostico

---

## CORRECAO 4 — UNIFICAR DASHBOARDS (MEDIO - 20 min)

**Problema:** Existem dois dashboards coexistindo: `Dashboard.jsx` e `DashboardV2.jsx`. Isso gera confusao.

**Acao:**
1. Leia ambos os arquivos: `execution/frontend/src/components/Dashboard.jsx` e `DashboardV2.jsx`
2. Identifique qual e mais completo e atual
3. Verifique em `App.jsx` qual esta sendo roteado como principal
4. Se V2 e o oficial: certifique-se que esta corretamente importado e roteado em App.jsx
5. Adicione um comentario no topo do arquivo legado: `// DEPRECATED - usar DashboardV2.jsx`
6. NAO delete o arquivo legado agora — apenas marque como deprecated

---

## CORRECAO 5 — CRIAR ROADMAP (ALTO - 45 min)

**Problema:** Ha 18 tickets sem ordem de prioridade. Os agentes nao tem clareza do que atacar primeiro.

**Acao:**
1. Liste todos os arquivos em `directives/` que comecam com `TICKET-`
2. Leia cada um rapidamente para entender escopo e dependencias
3. Crie o arquivo `directives/ROADMAP.md` com a seguinte estrutura:

```markdown
# ROADMAP MyFrot.ai

## FASE 1 — ESTABILIDADE (Esta semana)
Tickets que corrigem bugs ou completam funcionalidades ja iniciadas

## FASE 2 — MULTAS & IA (Proxima semana)
Tickets relacionados ao sistema de multas e IA manager

## FASE 3 — MONETIZACAO (Proximo mes)
Tickets de Stripe, PIX e modelo de receita

## FASE 4 — ESCALA (Futuro)
Tickets de features novas e crescimento

## TICKETS SEM FASE (Para triagem)
Tickets que precisam de decisao do fundador
```

4. Distribua os 18 tickets nas fases com justificativa de 1 linha cada
5. Marque conflitos explicitamente (ex: TICKET-LLM-Telegram-Upgrade vs TICKET-LLM-Cost-Optimization)

---

## CORRECAO 6 — LIMPEZA DE CODIGO MORTO (MEDIO - 15 min)

**Acao:**
1. Leia `execution/frontend/src/pages/AutomacaoIA.jsx`
2. Verifique se esta sendo usado em App.jsx
3. Se nao estiver ou estiver quebrado, adicione comentario `// DISABLED - aguardando refatoracao`
4. Verifique se `Leads` esta sendo importado/usado em algum lugar do App.jsx
5. Se nao, adicione comentario similar
6. NAO delete arquivos — apenas documente o que esta morto

---

## CORRECAO 7 — DOCUMENTAR VARIAVEL FALTANDO (RAPIDO - 5 min)

**Acao:**
1. Abra o arquivo `.env` na raiz
2. O campo `ADMIN_TELEGRAM_ID=SEU_TELEGRAM_ID_AQUI` esta vazio
3. Adicione um comentario claro acima dele:
   `# URGENTE: Preencha com seu Chat ID do Telegram. Para descobrir, envie /start para @userinfobot`
4. Adicione tambem as variaveis que estao faltando mas sao necessarias, com comentarios explicativos:
   - `PUBLIC_URL=` (URL HTTPS publica onde o backend Express esta hospedado — necessaria para webhook Telegram)
   - `WEBHOOK_SECRET=` (Secret para validar chamadas ao backend Express)
   - `STRIPE_SECRET_KEY=` (Se Stripe estiver ativo)
5. Salve o .env atualizado

---

## AO FINALIZAR

Crie o arquivo `auditorias/correcoes-executadas-2026-03-11.md` com:
- Lista de cada correcao: STATUS (feito / parcial / bloqueado)
- O que foi alterado em cada arquivo
- Qualquer decisao que precisa do fundador
- Proximos passos recomendados

Commit final com mensagem: `fix: auditoria 11/03 - correcoes criticas de seguranca, bugs e organizacao`
