# TICKET: Monopoly Engine (Integração Stripe Connect & Cobrança Autônoma)

## 1. Objetivo de Negócio (ROI & Lock-in)
**O Plano Mestre:** O dono da frota não pode usar o MyFrot apenas para "ver planilhas bonitas". O dinheiro dele PRECISA passar por dentro do sistema. Quando o SaaS controla o recebível, o *churn* (cancelamento) cai para zero. O frotista se torna dependente da nossa infraestrutura.
**ROI:** O frotista para de cobrar no boca a boca. O sistema gera a cobrança, envia o link (PIX/Cartão via Stripe), concilia o pagamento automaticamente e dá a baixa. Nós seguramos a operação financeira dele.

## 2. O Cenário Atual (Arquitetura Prévia)
O código já possui rastros de `Stripe Connect` (App.jsx tem botão "Conta Bancária / Conectando..."). Isso significa que a fundação para fazer on-boarding de contas conectadas (Standard/Express) já foi plantada no banco `clients` (`stripe_connect_status`).
Precisamos ativar o **motor de cobrança real**.

## 3. Arquitetura da "Monopoly Engine"

### A. Geração de Cobrança (Backend / Edge Functions)
1. **Cron Job Diário (Billing Engine):**
   - Roda todo dia às 06:00.
   - Olha a tabela `tenants`. Pega quem tem o vencimento (`billing_day`) igual a "Hoje".
   - Verifica se não há uma Fatura (Invoice) aberta para aquela semana.
   - Chama a API do Stripe (on behalf of the connected account) e cria um **Payment Link** ou **Invoice** (PIX habilitado).
   - Salva numa nova tabela `invoices` (id, tenant_id, stripe_invoice_id, amount, status, payment_url, due_date).

### B. O Webhook de Conciliação (A Mágica)
1. Edge Function `stripe-webhook`:
   - Escuta eventos do Stripe (`checkout.session.completed` ou `payment_intent.succeeded`).
   - Identifica qual invoice foi paga.
   - Atualiza a tabela `invoices` para `status = 'paid'`.
   - **Bônus de Autoridade:** Dispara notificação ("Pagamento Recebido - Tenant X").

### C. A Cara do Dinheiro (Frontend)
1. **`pages/Dashboard.jsx` (Calendário Semanal):**
   - Onde o frotista via "João - R$ 700", agora ele verá o **Status do Pagamento** daquela semana (Aguardando Pagamento, Atrasado, Pago).
2. **`pages/Portal.jsx` (O Condutor Encurralado):**
   - O condutor entra no portal dele. O primeiro card gigante na tela é a Fatura da Semana. Botão verde: "PAGAR AGORA (PIX)".
   - Se estiver atrasado, o portal é bloqueado (igual ao bloqueio de contrato). "Você tem faturas em atraso. Regularize para acessar o veículo."

## 4. Escopo do Claude (Execução Fase 1)
Como o Stripe Connect já tem o esqueleto via App.jsx:
1. **`schema_patch.py`:** Criar tabela `invoices` para rastrear as faturas geradas e atrelá-las aos inquilinos.
2. **`create-invoice` (Edge Function):** Criar a função que pega o `weekly_rate` do tenant, cria a fatura no Stripe rodando na conta conectada do Frotista, e retorna o Link de Pagamento.
3. **Frontend (`Portal.jsx`):** Consumir essa função. Mostrar a fatura pesada na tela do Inquilino com o botão de Pagar. 

## 5. Estratégia
Nada de setups manuais complexos. O Frotista clica em "Conta Bancária" no topo, conecta o Stripe dele (onboarding do Stripe Connect), e o sistema cuida do resto. O dinheiro cai direto na conta dele, a gente não toca no saldo, só intermediamos a tecnologia (e ganhamos o lock-in).
