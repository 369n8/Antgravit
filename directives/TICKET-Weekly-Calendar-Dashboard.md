# TICKET: Central de Operações Semanais (Dashboard Inteligente)

## 1. Objetivo de Negócio (ROI)
**O Problema Atual:** O frotista tem que pescar informações em várias abas para saber o que fazer hoje. Quem paga? Quem entrega o carro? Quem faz vistoria?
**A Solução (ROI Diário):** Um calendário interativo e centralizado de caixa e operações. Transformar o SaaS de um "banco de dados estático" em um **Gerente de Operações Ativo**. O sistema diz ao dono da frota o que fazer a cada dia da semana. Fim do desperdício de tempo.

## 2. Regras de Negócio e Componente (Frontend Inteligente)

### O Componente Visual `WeeklyCalendar` 
- Uma barra horinzontal com os 7 dias da semana (Segunda a Domingo).
- O dia atual (Hoje) deve estar sempre destacado.
- Clicar em qualquer dia carrega os dados referentes àquele dia:
  1. **Recebimentos/Cobranças:** Inquilinos cujo `billing_day` cai naquele dia.
  2. **Vistorias Previstas:** Quais inquilinos têm revisão agendada ou vistoria pendente para o dia.
  3. **Pendências do Passado:** (Se clicar em Hoje, o sistema *grita* na tela os calotes de dias anteriores).

## 3. Escopo de Frontend (`execution/frontend/src/`)
1. **`pages/Dashboard.jsx`:** 
   - Mover o atual card isolado de "Vencimentos de Hoje" e transformá-lo na **Central de Operações**.
   - Criar abas clicáveis (Monday, Tuesday...) com nomes localizados (Seg, Ter, Qua...).
   - Buscar e derivar o estado a partir de `tenants` cruzando a propriedade `billing_day`.
   - Adicionar botões de ação rápida nesses cards (Ex: Botão de enviar alerta via Telegram ou WhatsApp direto do card de cobrança do dia).

## 4. Escopo de Backend & Performance
1. O backend atual tem as tabelas necessárias (`tenants` com `billing_day`, `fines`, e `weekly_inspections`).
2. O componente do frontend (Dashboard) fará um `select` robusto e agrupará os locatários por `billing_day` na memória local ou via hook `useMemo` (React) para que a troca de dias seja instantânea (zero delay = percepção de app "Inteligente").

## 5. Restrições
- **Zero fricção:** Nenhuma navegação de página deve ser necessária para ver a lista de devedores da quinta-feira, apenas o clique na aba.
- **Microinterações:** A interface deve ser "viva". Se o dia não tem ninguém, exiba uma mensagem positiva ("Caixa limpo hoje. Aproveite para escalar a frota."). Se tem dívida pesada, use vermelho e botões claros de ação (Cobrar/Bloquear).
