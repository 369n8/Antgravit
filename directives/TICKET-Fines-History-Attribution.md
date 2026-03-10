# TICKET: Motor de Atribuição Retroativa de Multas e Histórico de Locação

## 1. Objetivo de Negócio (ROI)
**O gargalo:** As multas chegam semanas depois da infração. Se o carro já trocou de inquilino, não adianta verificar quem está com o carro *hoje*. O dono da frota precisa saber exatamente quem estava com a chave no dia e hora exatos da infração para transferir os pontos (CNH) e cobrar o valor, blindando a si mesmo e ao CNPJ da frota.
**ROI:** Tolerância zero para falhas de cobrança. Nunca mais assumir pontos na CNH por não conseguir identificar o motorista a tempo.

## 2. A Falha da Arquitetura Atual
Atualmente, se olharmos apenas para `tenants.vehicle_id`, só sabemos o motorista *atual*. Precisamos de uma linha do tempo imutável (History).

## 3. Regras de Negócio e Banco de Dados (Supabase)

### A. Tabela de Histórico de Locação (`vehicle_allocations`)
Temos que criar (ou robustecer se já existir) uma tabela que grave:
- `id` (uuid)
- `vehicle_id` (uuid)
- `tenant_id` (uuid)
- `start_date` (timestamptz)
- `end_date` (timestamptz - nulo se for a locação ativa)
*Gatilho (Trigger):* Toda vez que um tenant alugar um carro (Check-in) ou devolver (Check-out) no FrotaApp, essa tabela deve ser preenchida.

### B. O Motor de Busca Retroativa (No Webhook de Multas)
Quando o Scanner (Mock ou API real) trouxer uma multa com `infraction_date`, o backend executará um SQL blindado:
```sql
SELECT tenant_id FROM vehicle_allocations 
WHERE vehicle_id = multa_vehicle_id
  AND start_date <= infraction_date 
  AND (end_date IS NULL OR end_date >= infraction_date)
LIMIT 1;
```
Se achar, a multa ganha o `tenant_id_at_infraction` correto para sempre.

### C. Visualização de Gestão de Multas (Frontend)
- **Criar Página Dedicada:** `pages/Fines.jsx` (Adicionar link na Sidebar "Multas / CNH" com ícone de Alerta).
- A página deve mostrar uma tabela clara para o dono da frota:
  - Carro (Placa/Modelo)
  - Data e Hora da Infração
  - Descrição e Valor
  - **Inquilino Responsável (Baseado na busca retroativa)**
  - Status (Pendente, Indicação Feita, Paga)

## 4. Escopo do Claude (Execução)
1. **`schema_patch.py` / migrations:** Criar tabela `vehicle_allocations` e popular/backfill com os inquilinos atuais.
2. **Backend Webhook (`fines-scanner / fines-webhook`):** Atualizar a query do webhook para buscar o motorista na tabela de alocações usando a `infraction_date`.
3. **Frontend (`Fines.jsx` & `App.jsx`):** Construir a interface do despachante digital para o dono ver quem tomou a multa, para qual CPF/CNH transferir e o botão de cobrar.

## 5. Restrições
- Não quebrar o fluxo atual de multas; apenas tornar a amarração à prova de balas focada em datas do passado.
- O painel de Multas deve ser objetivo, estilo lista de tarefas, permitindo o dono da frota focar nas que estão pendentes de indicação de condutor.
