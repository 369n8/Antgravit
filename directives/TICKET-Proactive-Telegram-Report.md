# TICKET: Relatório Diário Proativo (O Gerente que Acorda Primeiro)

## 1. Visão Executiva e ROI
**O Problema Atual:** Hoje o sistema é passivo. O dono da frota precisa lembrar de mandar mensagem pro robô para saber como estão os negócios. Isso não gera dependência.
**A Solução (Lock-in):** Vamos inverter o jogo. Todo dia de manhã, antes do dono acordar, o Sistema coleta tudo o que aconteceu de noite, analisa o financeiro, junta os riscos e dispara um Briefing Matinal no Telegram.
**ROI:** O frotista adota o MyFrot como o "primeiro jornal do dia". Ele toma café lendo o que o robô dele fez. Custo zero de aquisição para retenção máxima (Churn = 0).

## 2. Arquitetura da Solução (Push Notifications via Cron)

### A. Nova Edge Function: `daily-ai-report`
Precisamos de um novo script autônomo. Ele não escuta o celular do usuário, ele acorda sozinho através de um relógio (Cron Job).
- **Entrada:** Engatilhado via Cron (Supabase `pg_cron`).
- **Processamento:**
  1. Varre a tabela `clients` e pega todo mundo que conectou o Telegram (`telegram_chat_id IS NOT NULL`).
  2. Para cada cliente, varre o banco e sumariza os dados financeiros e operacionais (faturas hoje, calotes, multas pendentes, vistorias, veículos locados).
  3. Manda esse estado para o **OpenRouter (Gemini 2.0 Flash)** mastigar. O Prompt é: *"Você é o Diretor Operacional. Gere o briefing matinal de hoje. Fale de dinheiro e risco. Curto, direto, sem firula."*
  4. Dispara a mensagem ativamente na API do Telegram (`sendMessage`) para aquele dono.

### B. O Agendador (Supabase Cron)
Para a função rodar sozinha às 08:00 todos os dias, a extensão `pg_net` e `pg_cron` do Supabase farão o trabalho pesado através do próprio banco de dados Postgres.

## 3. Escopo de Execução para o Claude (Lead Engineer)

1. **Criar a Edge Function: `daily-ai-report`**
   - Utilizar as mesmas credenciais: `TELEGRAM_BOT_TOKEN`, `OPENROUTER_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
   - Clonar a lógica de sumarização de dados (`summarizePagamentos`, `summarizeInvoices`, etc.) que já temos no `ai-manager-bot`.
   - Escrever o loop que itera sobre todos os donos de frota ativos.

2. **Configurar o Disparo (Cron Job no Postgres)**
   - Criar um script SQL em `execution/backend/setup_cron.sql` para habilitar o log do pg_cron e invocar a edge function diariamente.
   - Alternativamente, usar o hook nativo do próprio `supabase/functions/` ou agendador externo, caso o pg_cron esteja bloqueado.

## 4. Próxima Fase (V2)
- No briefing da manhã, se houver faturas vencendo no dia, o robô já manda o link de cobrança (WhatsApp) gerado pelo módulo Monopoly (Stripe) pro dono apenas dar um "Encaminhar".
