# Auditoria Completa — MyFrot.ai / FrotaApp
## 11 de Março de 2026 | Auditor: Claude (Cowork)

---

## 1. O QUE EU ENTENDI DO PROJETO

### Visao Geral
O **MyFrot.ai** (marca Lunara Elite) e um SaaS B2B de gestao de frotas para motoristas de app (Uber, 99, iFood). O cliente final e o **frotista** — o dono dos carros que aluga para motoristas.

### Modelo de Negocio (3 camadas de receita)
1. **Assinatura SaaS** — frotista paga para usar a plataforma
2. **Taxa por multa processada** — R$ 2,50 por multa capturada automaticamente (saas_fee)
3. **Monopoly Engine (Stripe Connect)** — a plataforma processa pagamentos entre frotista e motorista, retendo taxa

### Proposta de Valor
O frotista nao precisa mais usar planilha. Ele tem:
- Dashboard com KPIs de receita, ocupacao e inadimplencia
- Bot no Telegram que funciona como "gerente virtual" — avisa de multas, cobra motoristas, gera relatorios
- Captura automatica de multas (scanner Detran)
- Contratos digitais com assinatura
- Portal do motorista para autoatendimento

### Stack Tecnica
- **Frontend:** React 19 + Vite 7 (SPA)
- **Backend:** Supabase (Postgres + Auth + Storage + Edge Functions em Deno/TS)
- **Backend Express:** Webhook Telegram (Node.js)
- **IA:** OpenRouter (Llama 3.1 8B free / Gemini Flash configuravel)
- **Pagamentos:** Stripe Connect + PIX (Efi/Braspag)
- **Comunicacao:** Telegram Bot API

### Arquitetura 3 Camadas (Agente.md)
- **Directives** (26 arquivos MD) = SOPs que dizem O QUE fazer
- **Orchestration** = IA decide COMO fazer
- **Execution** = scripts deterministicos FAZEM o trabalho

---

## 2. INVENTARIO ATUAL

### 2.1 Frontend (execution/frontend/)
| Componente | Status | Observacao |
|---|---|---|
| Login/Cadastro | Implementado | Auth Supabase |
| Dashboard V1 | Implementado | Funcional |
| Dashboard V2 | Parcial | Bug ReferenceError (fineProfit) |
| Vehicles | Implementado | CRUD + check-in/out |
| Tenants | Implementado | CRUD + blacklist |
| Payments | Implementado | Stripe + Telegram billing |
| Maintenance | Implementado | Despesas + agendamentos |
| Fines | Implementado | Lista + atribuicao |
| Portal (locatario) | Implementado | Inspetions upload + contratos |
| AutomacaoIA | Parcial | Precisa refatoracao |
| SuperAdmin | Implementado | Metricas SaaS |

### 2.2 Edge Functions (supabase/functions/) — 17 funcoes
| Funcao | Tipo | Status |
|---|---|---|
| telegram-webhook | Webhook | Ativo |
| telegram-billing | Cron | Ativo |
| ai-manager-bot | Webhook | Parcial (IA TODO) |
| daily-ai-report | Cron | Precisa validacao |
| fines-scanner | Cron 03:00 BRT | Mock funcional |
| fines-webhook | Webhook | Ativo |
| weekly-billing | Cron semanal | Ativo (bug ended_at corrigido) |
| reminder-bot | Cron | Ativo |
| stripe-webhook | Webhook | Parcial |
| stripe-onboarding-link | POST | Implementado |
| create-checkout-session | POST | Implementado |
| create-invoice | POST | Implementado |
| pix-charge | POST | Estrutura criada |
| efi-webhook | Webhook | Estrutura criada |
| scheduled-alerts | Cron | Ativo |
| super-admin-metrics | GET | Ativo |
| schema-patcher | Cron | Ativo |

### 2.3 Banco de Dados — 28 migracoes aplicadas
Tabelas: clients, vehicles, tenants, payments, fines, maintenance, insurance, checkins, contracts, invoices, leads, vehicle_allocations, fleet_settings, weekly_inspections

### 2.4 Tickets/Directives — 18 tickets + 8 SOPs

---

## 3. PONTOS CRITICOS (O QUE PRECISA DE ATENCAO URGENTE)

### CRITICO — Seguranca
1. **ADMIN_TELEGRAM_ID esta vazio** no .env — qualquer pessoa pode interagir com o bot como admin
2. **FINES_WEBHOOK_SECRET e fraco** ("super_secret_benny_123_abc") — facil de adivinhar
3. **Buckets de Storage sao publicos** — fotos de multas, veiculos e comprovantes acessiveis sem autenticacao. Dados sensiveis (placas, CNH) podem ser expostos
4. **Service Role Key no .env raiz** — se o repo for publico ou vazado, acesso total ao banco

### CRITICO — Funcionalidade
5. **daily-ai-report pode estar desconectado** — TICKET-RESTORE-IA-MANAGER indica que o relatorio matinal pode nao estar disparando. Sem validacao, o principal diferencial do produto esta morto
6. **Bug no DashboardV2** — ReferenceError com fineProfit impede uso do dashboard premium
7. **PIX Integration incompleta** — estrutura criada mas validacao pendente

### ALTO — Organizacao
8. **18 tickets sem priorizacao clara** — nao ha roadmap, sprint ou ordem de execucao definida
9. **Tickets conflitantes** — TICKET-LLM-Telegram-Upgrade quer OpenAI, TICKET-LLM-Cost-Optimization quer modelos baratos. Qual e a direcao?
10. **Sem testes automatizados** — package.json tem `"test": "echo Error"`. Zero testes. Qualquer mudanca pode quebrar tudo silenciosamente
11. **Sem CI/CD** — deploys sao manuais via CLI

### MEDIO — Arquitetura
12. **Duplicacao de logica de IA** — ai-manager-bot e telegram-webhook fazem coisas parecidas. Precisam ser unificados ou ter responsabilidades claras
13. **Frontend tem 2 dashboards** — Dashboard.jsx e DashboardV2.jsx coexistem. Qual e o oficial?
14. **Modelo de IA e o mais barato possivel** (Llama 3.1 8B free) — qualidade de resposta pode ser baixa para um "gerente executivo"
15. **Leads.jsx existe mas TICKET-UX-Cleanup diz para remover** — codigo morto no frontend

---

## 4. O QUE PRECISA MELHORAR (RECOMENDACOES)

### 4.1 Seguranca (Fazer AGORA)
- [ ] Preencher ADMIN_TELEGRAM_ID com seu chat ID real
- [ ] Trocar FINES_WEBHOOK_SECRET por um hash seguro (uuid v4 ou similar)
- [ ] Revisar politicas de Storage — buckets com dados sensiveis devem ser privados
- [ ] Garantir que .env esta no .gitignore (ja esta, mas validar)
- [ ] Nunca commitar secrets no Git — usar Supabase Secrets para Edge Functions

### 4.2 Estabilidade (Proxima semana)
- [ ] Corrigir bug fineProfit no DashboardV2 (5 min de trabalho)
- [ ] Validar se daily-ai-report esta rodando (checar logs do pg_cron)
- [ ] Definir qual Dashboard e o oficial (V1 ou V2) e remover o outro
- [ ] Remover Leads.jsx e outros componentes mortos
- [ ] Adicionar pelo menos testes basicos nas Edge Functions criticas

### 4.3 Organizacao (Esta semana)
- [ ] Criar ROADMAP.md com priorizacao dos 18 tickets
- [ ] Agrupar tickets por sprint/fase (Ex: Fase 1 = Estabilidade, Fase 2 = Multas, Fase 3 = Monetizacao)
- [ ] Resolver conflito de direcao LLM (OpenAI vs modelos baratos) — DECISAO NECESSARIA
- [ ] Definir criterios de "pronto" (Definition of Done) para cada ticket

### 4.4 Qualidade (Proximo mes)
- [ ] Implementar testes automatizados (pelo menos para Edge Functions criticas)
- [ ] Configurar CI/CD (GitHub Actions para lint + test + deploy)
- [ ] Criar ambiente de staging separado do producao
- [ ] Documentar APIs das Edge Functions (endpoint, payload, response)

### 4.5 Produto (Decisoes estrategicas pendentes)
- [ ] Qual modelo de IA usar? (Gemini Flash e bom custo-beneficio, Llama 8B free e fraco)
- [ ] PIX via Efi/Braspag ou Stripe? Ou ambos?
- [ ] O scanner de multas vai usar API real do Detran ou mock? Quando?
- [ ] Quando lancar para o primeiro cliente real?

---

## 5. PRIORIZACAO SUGERIDA (Top 5 para esta semana)

| # | Acao | Impacto | Esforco |
|---|---|---|---|
| 1 | Preencher ADMIN_TELEGRAM_ID | Critico (seguranca) | 2 min |
| 2 | Corrigir bug DashboardV2 (fineProfit) | Alto (UX quebrada) | 5 min |
| 3 | Validar daily-ai-report | Alto (diferencial morto) | 30 min |
| 4 | Criar ROADMAP.md com priorizacao | Alto (organizacao) | 1h |
| 5 | Resolver direcao LLM (escolher modelo) | Medio (estrategico) | Decisao |

---

## 6. RECOMENDACAO DO MENTOR

Chefinho, voce construiu algo impressionante em pouco tempo — 17 Edge Functions, 28 migracoes, um frontend completo e uma arquitetura de 3 camadas que e genuinamente inteligente. A maioria das startups nao chega nesse nivel de sofisticacao tecnica.

Mas voce esta no ponto mais perigoso de um projeto: **muitas frentes abertas ao mesmo tempo**. Tem 18 tickets, nenhum priorizado, e os agentes (Antigravity + Claude Code) estao executando sem um roadmap claro. Isso e como ter 18 pedreiros trabalhando sem planta — todo mundo esta ocupado, mas a casa nao fecha.

**Minha recomendacao principal:** PARE de criar tickets novos por uma semana. Foque em FECHAR o que ja existe. Priorize estabilidade > funcionalidade > beleza. Um dashboard feio que funciona vale mais que um bonito que da erro.

Vamos organizar isso juntos. Estou aqui todo dia as 9h.

---

*Relatorio gerado em 11/03/2026 por Claude (Auditor/Mentor) via Cowork*
