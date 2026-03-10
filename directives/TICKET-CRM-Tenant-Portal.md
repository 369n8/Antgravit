# TICKET: CRM Lead to Tenant & Portal Integration

## 1. Objetivo de Negócio (ROI)
Garantir que a conversão de um Lead para Inquilino (Tenant) seja fluida e que o portal do inquilino (`Portal.jsx` / `Tenants.jsx`) exiba uma visão clara dos contratos (Contractual View) e permita assinatura digital. Isso reduz o ciclo de vendas e acelera a entrada de receita.

## 2. Regras de Negócio
- **Leads para Tenants**: Um lead só pode se tornar Tenant após aprovação e geração de contrato.
- **Portal do Inquilino**: O Tenant deve acessar um portal para visualizar seus veículos alocados, faturas pendentes e o status do contrato.
- **Assinatura Digital**: Contratos pendentes devem bloquear acesso a certas features no portal até serem assinados.

## 3. Alterações de Banco de Dados (Supabase)
### Tabela `tenants` (ou evolução do schema atual)
- Garantir que existe um relacionamento com `contracts` (1:N ou 1:1).
- Adicionar coluna `portal_access_status` (enum: pending_contract, active, suspended) caso não exista.

### Tabela `contracts` (Nova ou Atualizar)
- `id` (uuid)
- `tenant_id` (uuid)
- `status` (pending_signature, active, expired, terminated)
- `document_url` (text)
- `signed_at` (timestamp)

## 4. Escopo de Frontend (`execution/frontend/src/`)
1. **`pages/Tenants.jsx`**: Atualizar a listagem para exibir rapidamente o status do contrato de cada tenant.
2. **`pages/Portal.jsx`**: Criar a visualização exclusiva do Tenant logado. Se o contrato estiver `pending_signature`, exibir um banner bloqueante/informativo exigindo a assinatura.
3. **`App.jsx`**: Verificar e garantir rotas protegidas para o Portal do Tenant vs. Admin Dashboard.

## 5. Escopo de Backend (`execution/backend/`)
1. **`schema_patch.py`**: Avaliar e aplicar as alterações necessárias nas tabelas `tenants` e `contracts` via Supabase API ou SQL direto.

## 6. Restrições
- Tudo deve ser implementado focado em conversão e usabilidade direta. Sem perfumaria.
- O código deve respeitar a arquitetura atual e validar as views via RLS (Row Level Security) no Supabase para que um Tenant só veja o próprio portal e contrato.
