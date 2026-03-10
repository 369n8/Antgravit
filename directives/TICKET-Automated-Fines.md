# TICKET: Motor de Captura Autônoma de Multas (Detran/Senatran)

## 1. Objetivo de Negócio (ROI)
Eliminar 100% da intervenção humana na captura, identificação de condutor e cobrança de multas. O frotista apenas insere o CPF/CNPJ e a senha do gov.br (ou certificado digital) UMA VEZ. O sistema varre os órgãos de trânsito em background, identifica a placa, cruza com a data no histórico de locação e pendura a dívida no locatário correto.
ROI: Fim de multas pagas com atraso, fim de perda de prazo de indicação de condutor, e redução de churn de locatários por cobranças surpresas meses depois.

## 2. O Problema da Fragmentação (A Verdade Bruta)
Não existe UMA API mágica e gratuita que varra todos os Detrans do Brasil só com um CPF/CNPJ. O Detran é estadual. O Senatran (nacional) exige integração gov.br avançada ou empresas cadastradas.
Para construirmos isso *dentro* do nosso SaaS sem depender do frotista assinar Zapier ou Make, precisaremos consumir um serviço de enriquecimento de dados/despachante digital via API (Ex: Infosimples, Zapay, API Brasil, ou Tabela Fipe/Sinesp via scraping, embora scraping seja frágil).

## 3. A Solução (Arquitetura)

### Passo 1: O Cofre de Credenciais (Supabase)
O dono da frota precisa de uma tela de "Configurações de Integração" onde ele insere as credenciais da frota (CPF/CNPJ e placa por placa, ou credenciais gov.br se usarmos um broker avançado).
- Tabela `fleet_settings`: Armazena tokens de API ou credenciais criptografadas do frotista.

### Passo 2: O Motor de Busca (Cron Job)
Precisamos de um Worker/Cron Job rodando no Supabase (pg_cron ou Edge Function com Schedule).
- A cada 24/48 horas, o Cron acorda.
- Ele pega todas as placas ativas na tabela `vehicles`.
- Dispara requisições para a API terceira escolhida (ex: Infosimples).

### Passo 3: O Cérebro de Atribuição (O Webhook Atualizado)
Quando a API terceira responde com uma lista de infrações:
- O Worker lê `data_infracao`, `placa` e `valor`.
- Consulta: "Quem estava com o `vehicle_id` (placa X) na data Y?"
- Se encontrar o `tenant_id`, insere na tabela `fines` com o status `open` e atrela ao inquilino.
- O inquilino recebe um email/notificação: "Nova infração registrada. Pague para evitar bloqueio."

## 4. O que o Claude precisa construir AGORA (Fase 1: Infraestrutura Interna Total)

Não podemos plugar a API paga *hoje* sem a infraestrutura rodar liso. O Claude vai simular o comportamento externo com um Mock e deixar tudo pronto para só trocarmos a URL no final.

1. **`schema_patch.py`**: Criar tabela `fleet_settings` para guardar credenciais/CPF criptografado.
2. **Cron Job Supabase**: Configurar uma Edge Function roteirizada (Scheduled Function) que roda diariamente.
3. **Mock do Detran**: A Edge Function vai, por enquanto, consultar um mock que nós mesmos faremos (ou gerar dados falsos de multas) e injetar no Webhook para provar que a esteira funciona de ponta a ponta sem clique humano.
4. **Painel de Configuração Frontend**: Uma tela no Dashboard ou Settings para o frotista inserir o CNPJ/CPF da frota.

## Aviso Severo sobre APIs Reais
Assim que esta infra estiver pronta e validada pelo mock interno, você, Willy, terá que assinar um serviço de API de Consulta de Veículos (custa centavos por consulta). O Claude não pode criar dados reais do Detran do nada.
