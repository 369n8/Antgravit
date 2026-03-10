# TICKET: Upgrade do Cérebro (Integração OpenAI no Gerente Telegram)

## 1. Objetivo de Negócio (A Diferença entre um Robô e um Gerente)
**O Problema Atual:** O bot do Telegram está funcionando, mas ele fala como uma máquina de preencher formulários ("Chefe, temos 1 manutenção próxima... R$293.47"). Isso é **vago** porque não diz ao dono da frota **o que fazer com a informação**. O frotista quer soluções, não apenas leitura de tabelas.
**A Solução (The Real AI):** Injetar a API da OpenAI (GPT-4o-mini ou GPT-4o) na Edge Function do Telegram. O bot vai receber os dados crus do banco e o LLM vai formatar a mensagem com tom executivo, focado em **AÇÃO** imediata.

## 2. A Nova Dinâmica do Bot (O Prompt do Sistema)
O LLM receberá o seguinte contexto invisível no backend:
*"Você é o Gerente Operacional Sênior de uma locadora de veículos. Seu chefe é o dono da frota. Você deve repassar as pendências diárias de forma ultra-concisa, brutalmente objetiva, sempre focando em dinheiro (risco financeiro) e operações críticas. Nunca dê apenas a informação; sempre ofereça a próxima ação lógica."*

**Exemplo de Resposta Atual (Burra):** 
"As multas do Corolla ABC-1234 são: R$293.47. A última está pendente."

**Nova Resposta (Inteligente):**
"Chefe, o Corolla ABC-1234 tomou 3 multas seguidas (total R$1.467). A última de R$293,47 por celular na direção ainda está pendente de indicação. O carro hoje está com o Inquilino X. Quer que eu gere o link de cobrança de repasse e envie pro WhatsApp dele agora, ou prefere contestar a infração?"

## 3. Arquitetura da Edge Function (`ai-manager-bot`)
1. Instalar o SDK da OpenAI na Edge Function do Supabase.
2. Adicionar a `OPENAI_API_KEY` nos secrets do Supabase.
3. Modificar o fluxo de `/resumo` e `/multas`:
   - Passo A: Fazer as mesmas queries robustas no banco (buscar multas, invoices, vistorias).
   - Passo B: Montar um JSON com o "estado do mundo".
   - Passo C: Passar esse JSON para a OpenAI com o System Prompt executivo.
   - Passo D: Retornar a string gerada pela OpenAI de volta para a API do Telegram.
4. Opcional (Fase 2): Interpretar linguagem natural do chat. Se o frotista digitar "Quem é o pior pagador hoje?", o bot converte isso numa inferência de banco. Por enquanto, focar apenas em humanizar e tornar as respostas proativas pros comandos existentes.

## 4. Escopo do Claude (Execução Tática)
1. Atualizar o script da Edge Function `ai-manager-bot` para usar Fetch/OpenAI.
2. Criar uma injeção de prompt formidável (System Prompt).
3. Testar a geração da resposta. A mensagem de volta deve ser limpa, sem asteriscos demais de markdown, e direta ao ponto.
