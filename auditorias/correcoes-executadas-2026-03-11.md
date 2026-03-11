# Auditoria de Correções — MyFrot.ai
> Data: 2026-03-11
> Executado por: Claude Sonnet 4.6

---

## CORREÇÃO 1 — Bug DashboardV2 fineProfit
**STATUS: ✅ JÁ RESOLVIDO (nenhuma ação necessária)**

O ticket TICKET-Fix-Dashboard-RefError descreve um `ReferenceError: fineProfit` que foi resolvido em sessão anterior. O arquivo atual `execution/frontend/src/components/DashboardV2.jsx` usa `stats.activeCount`, `stats.occupancy`, `stats.idRate` e `stats.alerts` — todos corretamente acessados via objeto `stats` do `useMemo`. Não há referência a `fineProfit` em nenhum ponto do arquivo.

---

## CORREÇÃO 2 — Segurança: FINES_WEBHOOK_SECRET
**STATUS: ✅ FEITO**

- **Arquivo alterado:** `.env` (raiz do projeto)
- **Antes:** `FINES_WEBHOOK_SECRET=super_secret_benny_123_abc` (weak, guessable)
- **Depois:** `FINES_WEBHOOK_SECRET=e9bb67e182144745b30c1d088eae4e3cf2599297834747b6b2c880711472e67a` (64 chars hex, gerado com crypto)
- **AÇÃO PENDENTE DO FUNDADOR:** Atualizar o secret também no Supabase:
  ```
  npx supabase secrets set FINES_WEBHOOK_SECRET=e9bb67e182144745b30c1d088eae4e3cf2599297834747b6b2c880711472e67a
  ```

---

## CORREÇÃO 3 — Validar daily-ai-report
**STATUS: ✅ FEITO (2 bugs corrigidos)**

Ver diagnóstico completo em `auditorias/status-daily-report.md`.

### Bugs corrigidos:
1. **Cron faltando:** Criado `supabase/migrations/20260311000001_daily_report_cron.sql` — agenda `daily-ai-report` para 08:00 BRT todos os dias
2. **multi-tenant bug em summarizeVistorias:** Função não filtrava por `client_id` — todos os clientes veriam vistorias de outros. Corrigido adicionando parâmetro `clientId` e cruzando com tabela `tenants`.

- **Arquivo alterado:** `supabase/functions/daily-ai-report/index.ts`
- **Arquivo criado:** `supabase/migrations/20260311000001_daily_report_cron.sql`
- **AÇÃO PENDENTE:** `npx supabase db push -p "supabase368"` para aplicar o cron

---

## CORREÇÃO 4 — Unificar Dashboards
**STATUS: ✅ FEITO**

Análise da cadeia de imports:
- `App.jsx` → importa `Dashboard` de `pages/Dashboard.jsx` ✅
- `pages/Dashboard.jsx` → importa `DashboardV2` de `components/DashboardV2.jsx` ✅
- `components/Dashboard.jsx` → **não importado em lugar nenhum** ← arquivo legado

O roteamento está correto. DashboardV2 é o dashboard oficial.

- **Arquivo alterado:** `execution/frontend/src/components/Dashboard.jsx`
- Adicionado no topo: `// DEPRECATED — usar DashboardV2.jsx (em components/) via pages/Dashboard.jsx`

---

## CORREÇÃO 5 — Criar ROADMAP
**STATUS: ✅ FEITO**

- **Arquivo criado:** `directives/ROADMAP.md`
- 18 tickets distribuídos em 4 fases (Estabilidade → Multas & IA → Monetização → Escala)
- Conflitos explicitados: LLM-Cost-Optimization vs LLM-Telegram-Upgrade
- Decisões do fundador documentadas (provedor de multas, modelo LLM, ADMIN_TELEGRAM_ID)

---

## CORREÇÃO 6 — Limpeza de código morto
**STATUS: ✅ FEITO**

- `AutomacaoIA.jsx`: **ATIVO** — importado e roteado em `App.jsx` na key `automacao`
- `components/Dashboard.jsx`: **MORTO** — não importado, marcado como `// DEPRECATED`
- `pages/Leads.jsx`: Não existe nenhum arquivo `Leads.jsx` no projeto. Não há menção de Leads no `App.jsx`.

---

## CORREÇÃO 7 — Documentar variáveis faltando
**STATUS: ✅ FEITO**

- **Arquivo alterado:** `.env` (raiz)
- Adicionado comentário `# URGENTE` no `ADMIN_TELEGRAM_ID`
- Adicionadas variáveis documentadas com comentários:
  - `PUBLIC_URL=` — URL pública do backend Express
  - `WEBHOOK_SECRET=` — Secret para validar webhooks
  - `STRIPE_SECRET_KEY=` — Chave Stripe (com link para obter)

---

## DECISÕES PENDENTES DO FUNDADOR

| Prioridade | Decisão | Impacto |
|-----------|---------|---------|
| 🔴 URGENTE | Preencher `ADMIN_TELEGRAM_ID` no .env | Sem isso não recebe alertas do sistema |
| 🔴 URGENTE | `npx supabase secrets set FINES_WEBHOOK_SECRET=e9bb6...` | Atualizar secret fraco no servidor |
| 🔴 URGENTE | `npx supabase db push -p "supabase368"` | Ativar cron do daily-ai-report |
| 🟡 IMPORTANTE | Escolher provedor de multas (Infosimples/Zapay/API Brasil) | Desbloqueia TICKET-Automated-Fines |
| 🟡 IMPORTANTE | Configurar bot Telegram na conta dtrikerw@gmail.com | Sem token = sem alertas para esse cliente |
| 🟢 PLANEJAMENTO | Decidir entre LLM-Cost-Optimization vs LLM-Upgrade | Antes de escalar o número de clientes |

---

## PRÓXIMOS PASSOS TÉCNICOS RECOMENDADOS

1. Aplicar migration pendente: `npx supabase db push -p "supabase368"`
2. Atualizar secret no Supabase: `npx supabase secrets set FINES_WEBHOOK_SECRET=e9bb67e182144745b30c1d088eae4e3cf2599297834747b6b2c880711472e67a`
3. Deploy do `daily-ai-report` atualizado: `npx supabase functions deploy daily-ai-report --project-ref bmwvigbktrypgkcbxlxi --no-verify-jwt`
4. Rebuild e redeploy do frontend (Dashboard.jsx legado marcado como deprecated)
5. Testar o daily-ai-report manual: `POST /functions/v1/daily-ai-report` com `{"manual_for_client": "<uuid>"}`
6. Atacar TICKET-ROI-Segregation (Fase 1) — remover métricas do Super Admin do dashboard do frotista
