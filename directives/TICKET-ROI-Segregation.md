# TICKET: Arrumar Burrice de ROI (Locadora vs SaaS)

## Problema
O DashboardV2 do frotista está mostrando métricas de ROI que pertencem ao Super Admin (Willy). 
Confundimos "Lucro da Plataforma" com "Lucro da Locadora".

## Nova Definição de ROI
1. **Painel do Frotista (Locadora)**:
   - `fine_profit` = `admin_fee` (Taxa Administrativa cobrada do motorista) + `spread_profit` (Lucro no SNE).
   - Isso é o lucro "mágico" que ele tem por usar o sistema.
   - **Remover** qualquer menção a taxas pagas ao SaaS no painel dele.

2. **Painel Super Admin (Plataforma - Willy)**:
   - `saas_fine_revenue` = Contagem de multas processadas * R$ 2,50 (Nossa taxa por multa).
   - `total_saas_roi` = MRR + `saas_fine_revenue`.
   - Exibir no `SuperAdmin.jsx` o faturamento extra gerado pelas multas.

## Ações Necessárias
- [ ] Criar coluna `saas_fee` na tabela `fines` (valor: 2.50 por multa) -> Migração SQL.
- [ ] Atualizar `fines-webhook` para preencher `saas_fee`.
- [ ] Atualizar `SuperAdmin.jsx` para exibir o faturamento de multas da plataforma.
- [ ] Limpar o `DashboardV2.jsx` para mostrar apenas o ROI limpo da locadora.

## Delegacia
- "Claude, crie a migração para adicionar `saas_fee` na tabela `fines`. Atualize o `fines-webhook` para inserir esse valor fixo de 2.50 em cada multa detectada. Depois, ajuste o `SuperAdmin.jsx` para somar esse valor no faturamento global."
