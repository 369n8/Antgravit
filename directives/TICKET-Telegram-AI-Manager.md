# TICKET: O Gerente Telegram (Inteligência Artificial Ativa) e Limpeza de UX

## 1. Objetivo de Negócio (A Cartada Final de Lock-in)
**O Diagnóstico:** O usuário (frotista) achou o sistema confuso porque ele ainda precisa entrar no sistema, caçar informações e apertar botões. E colocar o motor da máquina de multas dentro de uma aba chamada "Configurações" é contra-intuitivo.
**A Solução (The AI Lock-in):** O MyFrot deixa de ser "só um site". O Cérebro do sistema vai morar no Telegram do Frotista. Uma IA que chama o Frotista pelo nome de manhã, dá o resumo do dia, avisa se alguém tomou multa e pergunta: *"Posso aprovar a vistoria do João?"*. O frotista responde *"Sim"* no Telegram, e a IA faz a mágica no banco de dados.

## 2. Faxina de UX (Frontend Imediato)
1. **Destruir a página `Settings.jsx`:** Configurar multas não é "configuração de conta". 
2. **Nova Aba: `Motor IA` (ou `Automações`):** Esta aba substitui "Configurações" na Sidebar e será o cérebro onde o Frotista gerencia como o Robô trabalha (Token do Detran, Conexão do Bot do Telegram, Permissões da IA).
3. **Consolidação:** A aba "Gestão de CNH" vai focar unicamente nas infrações e atrelações.

## 3. O Gerente Telegram (Arquitetura do Bot)

### A. Infraestrutura do Bot
- Criar um Bot no BotFather do Telegram e pegar o Token.
- Habilitar (ou reaproveitar se já existe) o modal de `Conectar Telegram` na interface para salvar o `chat_id` na tabela `clients`.

### B. A Inteligência (Edge Function: `ai-manager-bot`)
- Criar um Webhook no Supabase que recebe mensagens do Telegram.
- **Integração com LLM (OpenAI/Gemini/Anthropic):** Quando o frotista manda texto/áudio ("Quem está devendo hoje?"), a Edge Function traduz o texto, faz a query no Supabase e devolve um resumo humanizado.
- **Ações Ativas (Proatividade):** Aproveitando o Cron Job diário das multas (03h00) e do Calendário Diário (06h00), a função manda push para o celular do dono da frota: *"Bom dia, chefe. Capturei 3 multas novas na madrugada. Duas do João e uma do Pedro. Já amarrei nos perfis deles. A fatura do Carlos de R$ 700 vence hoje. Quer que eu mande o link de cobrança pro WhatsApp dele?"*

## 4. Escopo do Claude (Execução Imediata)
1. **Refatoração Visual:** Renomear rotas em `App.jsx` e `Sidebar.jsx`. Matar "Configurações" e criar a visão da "Central da IA / Motor de Automações". Transferir a UI do Scanner de Multas para cá.
2. **Fundação do Bot:** Criar a base da Edge Function (ou o esqueleto em Python) para receber webhooks do Telegram e integrar comandos crus (Ex: `/resumo`, `/multas`).
3. **Mudar a percepção:** Tornar a UI o mais limpa possível. A UI serve apenas de espelho, o cérebro real estará no chat.

## 5. Restrição Estratégica
A IA não precisa ser perfeita no Dia 1. Ela precisa ser **útil**. Se ela souber mandar uma notificação clara com os atrasados e as multas recém-pescadas, você já tirou um peso absurdo das costas do dono da frota. Ele vai amar o seu software.
