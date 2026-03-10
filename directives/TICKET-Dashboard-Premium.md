# TICKET: Dashboard Premium "Magic" V2

## Objetivo
Transformar o dashboard do FrotaApp em uma ferramenta de "Gestão de Elite", focando em ROI, Proatividade da IA e Estética Premium (Glassmorphism + Dark Mode).

## Requisitos de Design
- **Estética**: Glassmorphism, gradientes suaves, tipografia moderna (Inter/Outfit).
- **IA First**: Um card de "Status da Operação" gerado pela IA (ou simulado com base em dados reais).
- **Foco em Dinheiro**: Exibir lucro bruto vs lucro líquido (após custos e taxas).

## Componentes do Dashboard V2
1. **Status IA (Hero Section)**: "Mensagem do Cérebro" resumindo o dia.
2. **KPI Grid (Cards Magnéticos)**:
   - Receita Semanal (Progress Bar).
   - Lucro em Multas (Taxas e Spreads).
   - Ocupação da Frota.
   - Inadimplência Atual.
3. **Feed de Atividade do Motor**: O que a IA está fazendo agora (Scans, Disparos de Telegram).
4. **Shortcuts Mágicos**: Botões de ação rápida (Configurar Motor, Nova Locação, Gerar Faturas).

## Dados Necessários (Backend)
- Total de `admin_fee` e `spread_profit` da tabela `fines`.
- Total de `invoices` vencidas vs pagas na semana.
- Quantidade de `vehicles` por status.

## Delegacia
- Criar `execution/frontend/src/components/DashboardV2.jsx`.
- Atualizar `execution/frontend/src/pages/Dashboard.jsx` para usar o novo componente.
