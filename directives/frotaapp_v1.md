# FrotaApp v1 - Arquitetura de Software e Diretrizes de Implementação

> Este documento (SOP) serve como a Diretiva Principal para a construção do FrotaApp, um SaaS para Gestão de Frotas de Veículos.  
> Qualquer IA ou agente operacional lendo este arquivo deve seguir rigorosamente as restrições abaixo.

## 1. Regras Inegociáveis

1. **Estrutura de Pastas e Código Real:**  
   Todo o código escrito para este projeto deve ser gerado EXCLUSIVAMENTE dentro da pasta `execution/`.  
   - Frontend deve ser implementado em `execution/frontend/`.  
   - Backend deve ser implementado em `execution/backend/`.  

2. **Banco de Dados Relacional (Supabase):**  
   Não utilizar dados hardcoded no frontend. Todos os dados devem ser consumidos e persistidos no Supabase. O esquema relacional obrigatório está detalhado na secção abaixo.

3. **Frontend Real Time:**  
   O frontend deverá se conectar à base de dados exclusivamente usando a biblioteca `@supabase/supabase-js`. O uso de dados estáticos para simular o banco (como exibidos no protótipo antigo) é terminantemente **proibido**.

4. **Backend e Telegram Bot:**  
   O bot do Telegram deve ser desenvolvido utilizando o Express, configurado para escutar via **Webhooks** dinâmicos.
   - É terminantemente **PROÍBIDO** usar `polling: true` para evitar gargalos e bloqueios no sistema.
   - O núcleo lógico de IA do bot fará uso exclusivo da API do **Gemini**.

## 2. Esquema do Banco de Dados Relacional (Supabase)

O esquema central foi derivado da lógica do aplicativo de gestão de frotas e deverá conter, no mínimo, as seguintes tabelas e relacionamentos:

- **clients**  
  Tabela para armazenar os donos das frotas (os clientes do SaaS).  
  *Colunas básicas:* `id`, `name`, `email`, `created_at`.

- **vehicles**  
  Veículos pertencentes à frota vinculados a um `client_id`.  
  *Colunas básicas:* `id`, `client_id`, `type` (car/moto), `brand`, `model`, `year`, `plate`, `color`, `km`, `fuel_level`, `tire_condition`, `status` (locado, disponível, manutenção), `rent_weekly`, `docs_ipva`, `docs_seguro`, `docs_revisao`, `fines`, `dents`, `notes`, `created_at`.

- **tenants**  
  Motoristas / Locatários dos veículos vinculados a um `client_id` (e opcionalmente a um `vehicle_id` se estiverem locando no momento).  
  *Colunas básicas:* `id`, `client_id`, `name`, `cpf`, `rg`, `birth_date`, `phone`, `email`, `cnh`, `cnh_expiry`, `cnh_category`, `app_used`, `address`, `emergency_contact`, `vehicle_id`, `rent_weekly`, `deposits`, `status` (ativo, encerrado), `blacklisted`, `created_at`.

- **payments**  
  Obrigações financeiras (semanais/mensais) e pagamentos efetuados vinculados ao `tenant_id` e `client_id`.  
  *Colunas básicas:* `id`, `client_id`, `tenant_id`, `week_label`, `due_date`, `paid_date`, `value_amount`, `paid_status` (boolean), `payment_method`, `created_at`.

- **maintenance**  
  Agenda de manutenções e registros de gastos por veículo vinculados a um `vehicle_id` e `client_id`.  
  *Tabela pode ser dividida em `expenses` e `maintenance_schedule`, ou unidas como eventos.*  
  *Colunas básicas:* `id`, `client_id`, `vehicle_id`, `event_type` (expense, schedule), `category` (Manutenção, Pneu, Seguro, etc.), `date`, `description`, `value_amount`, `done` (boolean), `created_at`.

## 3. Instruções de Orquestração (Agente IA)

Quando for instruído a **iniciar o desenvolvimento** do FrotaApp:

1. Acesse o Supabase via CLI (em `execution/`) ou instrua a criação dos schemas SQL e migrações iniciais refletindo as tabelas acima, configurando políticas do Row Level Security (RLS).
2. Na pasta `execution/frontend/`, inicialize o projeto Web (Vite/React ou Next.js) seguindo a estrutura de Design baseada em Tailwind ou estilização condizente, conectando o painel aos dados do Supabase.
3. Na pasta `execution/backend/`, inicialize o projeto Node/Express para servir os Webhooks do Telegram Bot.
4. Conecte o bot ao LLM do Gemini.

> **Nunca apague ou altere esta Diretiva** sem ordem explícita do usuário. Este é o plano mestre arquitetural do FrotaApp.
