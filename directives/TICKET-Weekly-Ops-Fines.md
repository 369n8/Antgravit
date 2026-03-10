# TICKET: Gestão Semanal & Automação de Multas (Fines + Vistorias)

## 1. Objetivo de Negócio (ROI)
- **Previsibilidade de Caixa:** Organizar recebimentos por dia da semana estabiliza e facilita o fluxo de cobrança para frotistas. Menos tempo cobrando, mais tempo escalando.
- **Proteção do Ativo (Carro):** A vistoria semanal obrigatória (vídeo e KM) blinda a locadora contra depreciação oculta e fraudes de quilometragem. O veículo é a máquina de fazer dinheiro, mantê-lo vigiado corta prejuízos na devolução.
- **Redução de Passivo (Multas):** Descobrir multas tarde demais custa caro (perda de prazo para transferência de pontuação ou pagamento com desconto). Centralizar e automatizar a captura de multas resolve uma das maiores dores das locadoras.

## 2. Regras de Negócio e Arquitetura

### A. Recebimentos por Dia da Semana (Billing Days)
- A entidade `tenants` precisa de uma nova dimensão: **Dia de Vencimento** (ex: `billing_day`: 'Monday', 'Tuesday', etc).
- O **Admin Dashboard** ganha um painel: "Recebimentos da Semana" filtrado pelo dia atual. Ajuda o dono da frota a saber exatamente quem cobrar hoje.

### B. Vistoria Semanal (Inquilino)
- No Portal (`Portal.jsx`), o Inquilino recebe um alerta (e possível bloqueio) no dia da vistoria.
- Deve fazer **Upload de 1 Vídeo** (mostrando o estado geral do carro 360) e informar a **KM atual**.
- O Admin aprova ou rejeita a vistoria no painel (`Tenants.jsx`). Se rejeitar, o inquilino refaz.

### C. Automação de Multas (Fines Foundation)
- Integrações com Detran/Senatran não são triviais (mudam por estado e requerem APIs pagas como Infosimples, Zapier etc.). 
- **Estratégia MVP de Alto Valor:** Criaremos a infraestrutura interna (Tabela `fines`) e um **Webhook** no backend. Esse Webhook estará pronto para receber POSTs de serviços externos de automação (Make/n8n) que vão sondar o Detran e injetar as multas direto no FrotaApp.
- Ao receber a multa, o sistema a atrela ao veículo e, pela data da infração, descobre qual Tenant estava com o carro, gerando o débito autônomo.

## 3. Alterações de Banco de Dados (Supabase)
### `tenants`
- ADD Column `billing_day` (varchar ou enum: monday, tuesday, wednesday, thursday, friday, saturday, sunday).

### `weekly_inspections` (Nova Tabela)
- `id` (uuid)
- `tenant_id` (uuid)
- `vehicle_id` (uuid)
- `video_url` (text)
- `current_km` (int)
- `status` (enum: pending, approved, rejected)
- `created_at` (timestamp)

### `fines` (Nova Tabela)
- `id` (uuid)
- `vehicle_id` (uuid)
- `tenant_id_at_infraction` (uuid - opcional/computado)
- `infraction_date` (timestamp)
- `amount` (numeric)
- `description` (text)
- `status` (enum: open, paid, transferred)

## 4. Escopo de Frontend (`execution/frontend/src/`)
1. **`pages/Dashboard.jsx`**: Adicionar widget "Vencimentos de Hoje", mapeando tenants pelo `billing_day`.
2. **`pages/Portal.jsx` (Área do Inquilino)**: Componente para envio de Vistoria (Upload de Vídeo + input de KM).
3. **`pages/Tenants.jsx`**: Área para revisão das vistorias (Aprovar/Rejeitar) e atalho para ver Multas atreladas.

## 5. Escopo de Backend (`execution/backend/`)
1. **`schema_patch.py`**: Criar as novas tabelas e modificar `tenants` garantindo RLS.
2. **`create_bucket.py` (ou similar)**: Garantir (ou criar) um bucket no Supabase Storage chamado `inspections` com políticas seguras (apenas inquilinos inserem, admin lê).
3. **`fines_webhook.py`**: Criar um endpoint (Flask/FastAPI/Supabase Edge Function) para inserção programática de multas via sistemas externos.

## 6. Restrições e Execução
- **Sem Perfumaria:** O upload do vídeo deve ser cru e direto para o Supabase Storage. Despreze edições complexas de vídeo. O frotista quer a prova visual e a KM, apenas.
- Foque primeiro na Gestão de Recebimentos e na Vistoria. A Fundação das multas deve ser estrutural para permitir a automação via Zapier/Make num segundo momento.
