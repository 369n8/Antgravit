# TICKET: Reengenharia de Custos do LLM (OpenRouter + Agente Assíncrono)

## 1. O Risco Financeiro (Você tem razão)
Se o Robô for engatilhado via Webhook a cada mensagem boba que o Frotista enviar ("E aí?", "Bom dia") ou para frotas de 100+ carros (JSONs gigantes com 150 invoices detalhadas por query), o custo de chamar o modelo (Token In + Token Out) vai devorar a margem do SaaS. A IA precisa ser inteligente, mas **cirúrgica e barata**.

## 2. A Solução (Cérebro Híbrido + OpenRouter)

### A. Troca Custo-Benefício (OpenRouter)
- Substituir a URL base da `openai` na Edge Function `ai-manager-bot` para `https://openrouter.ai/api/v1/chat/completions`.
- Modelo alvo inicial: `google/gemini-flash-1.5` ou `meta-llama/llama-3-8b-instruct`. (Extremamente rápidos e custam centavos por milhão de tokens comparado ao GPT-4o).
- Configuração no Supabase: A chave que você mencionou será inserida no painel como `OPENROUTER_API_KEY`.

### B. O Guarda-Costas do Custo (Filtro LLM)
Nós não podemos mandar toda a base de dados em cada request. Precisamos de Otimização de Contexto:
1. **Dados Agregados vs Dados Crus:** Se a frota tem 100 carros, o banco não manda as 100 multas para a IA formatar. O Node.js/Supabase faz a contagem em SQL (`COUNT`, `SUM`) e só passa o Resumo Cru para o LLM humanizar.
    - *Exemplo Ruim (Caro):* Passo 100 linhas de JSON para o LLM. (5.000 tokens)
    - *Exemplo Bom (Barato):* Passo "Total faturas: 4, Valor Total: 3000, Piores: João(1200), Carlos(800)" pro LLM. (30 tokens).

2. **Interceptador de Bom Dia:** Se o usuário mandar texto livre ("Bom dia"), a função NÃO bate no banco de dados inteiro. Ela manda o histórico rápido pro LLM com a instrução: "Seja educado e peça pra ele usar os comandos /resumo ou /multas". Isso impede consumo excessivo de dados relacionais e cálculos do Supabase sem necessidade.

## 3. Escopo de Refatoração do Claude
1. Modificar a Edge Function `ai-manager-bot` para usar a base URL do OpenRouter.
2. Trocar o modelo default para um de baixo custo (ex: Llama-3-8b-instruct ou Gemini Flash via OpenRouter).
3. Alterar os "Collectors" (as funções que leem o Supabase antes do LLM) para passar ao invés de *linhas cruas*, **strings sumarizadas condensadas**.
4. Incluir log/cálculo de tokens opcional se possível, para métrica do dono do SaaS.
