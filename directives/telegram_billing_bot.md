# Diretiva Técnica: Telegram Billing Bot via Supabase (FrotaApp)

> Este é um SOP (Procedimento Operacional Padrão) que define a arquitetura e o fluxo de integração para a funcionalidade de cobrança de locatários inadimplentes via Telegram, utilizando Supabase Edge Functions.

## 1. Arquitetura do Backend (Supabase Edge Functions)

Para manter a aplicação serverless e escalável, a lógica de comunicação com a API do Telegram será responsabilidade do Supabase, não havendo necessidade de polling contínuo via servidor Express tradicional para esta funcionalidade específica.

*   **Edge Function Padrão:**
    *   **Nome:** `telegram-billing`
    *   **Objetivo:** Receber uma requisição HTTP POST contendo os dados da cobrança e disparar uma mensagem padronizada no Telegram do usuário.
*   **Payload Esperado (POST body):**
    *   `client_name` (string): Nome do locatário.
    *   `amount_due` (number/string): Valor devido em atraso (ex: "480.00").
    *   `telegram_username` (string): Username do locatário no Telegram para envio da mensagem.
*   **Integração com API do Telegram:**
    *   A Edge Function utilizará a variável de ambiente (secret) `TELEGRAM_BOT_TOKEN` armazenada seguramente no provedor do Supabase.
    *   Far-se-á um fetch simples (HTTP POST) à API nativa do Telegram (`https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/sendMessage`), formatando a string de texto baseada no payload recebido e enviando para o target especificado via username/chat_id associado.

## 2. Interface e Integração no Frontend (UI/UX)

O acionamento desta cobrança ocorrerá a partir da visualização das pendências na tela de pagamentos do dashboard do proprietário da frota.

*   **Mapeamento de Inadimplência:**
    *   No componente `Payments.jsx`, deve-se filtrar e mapear a lista de obrigações rastreando aquelas marcadas como "Em atraso" (`paid_status` igual a false ou a Data de Vencimento ter passado).
*   **Ação de Cobrança (Botão Bento Grid):**
    *   Em cada card de pagamento atrasado (obedecendo estritamente ao design system Bento Grid: cantos 24px, sombra difusa, fundo branco), deve-se incluir um botão de call-to-action sutil de texto `"📱 Cobrar"`.
    *   O botão *não* deve chamar atenção exagerada com cores de alerta fortes em repouso, para manter o visual limpo de dashboards de saúde/finanças modernas.
*   **Integração (Client-side Supabase):**
    *   No evento `onClick` do botão `"📱 Cobrar"`, o frontend deverá disparar: `await supabase.functions.invoke('telegram-billing', { body: { client_name: "...", amount_due: "...", telegram_username: "..." } })`.
*   **Feedback Visual:**
    *   Ao finalizar o invoke com sucesso, uma notificação (toast/alerta flutuante) minimalista deve informar ao locador: `"Cobrança enviada"`.

## Resumo da Execução Esperada

1. Criar e fazer o deploy da Edge Function `telegram-billing` na infra do Supabase, assegurando o uso seguro do `TELEGRAM_BOT_TOKEN`.
2. No frontend `Payments.jsx`, identificar dívidas e incluir o botão "📱 Cobrar" com a formatação Bento Grid apropriada.
3. Vincular o click do botão à invocação HTTP da Edge Function e renderizar o toast `"Cobrança enviada"` logo em sequência.
