# TICKET: Remoção de CRM e Operacionalização da IA Core (O Cérebro do Frotista)

## 1. Objetivo de Negócio (O Jogo de Poder)
**Diagnóstico:** Um SaaS com abas que o usuário não usa gera fadiga cognitiva e passa a impressão de ser uma ferramenta "genérica". Se a dor aguda dele não é captar "leads" novos e sim GERIR o caixa e os ativos (carros + motoristas inadimplentes) que ele já tem, a tela de CRM é inútil e atrapalha.
**A Solução (Lock-in Absoluto):** Enxugar o sistema. Cortar a gordura. Transformar o Dashboard em um "Assistente Executivo". Ele não deve procurar a informação; a informação (e a ação) deve ir até ele mastigada.

## 2. A Limpeza (O que morre hoje)
- **Adeus `Leads.jsx` e CRM:** Remover rotas, remover botões da barra lateral. O foco é `Operação` e `Caixa`.

## 3. A Substituição: O Painel de Inteligência Operacional
O Dashboard (`Dashboard.jsx`), que já ganhou o Calendário de Vencimentos, precisa de um módulo de "Insight" ou "Atenção Crítica" (A IA do Sistema falando com o Frotista). 

### Foco em 3 Gatilhos Inteligentes (Ações Predivitas):
Em vez de ele clicar nos menus, o Dashboard vai ter uma coluna "O que você precisa resolver hoje":
1. **Risco Financeiro:** "O Inquilino X está com a fatura atrasada há 2 dias. [Bloquear Veículo?]"
2. **Risco de Patrimônio:** "Veículo Y (Placa ABC) chegou a 10.000km desde a última revisão. [Agendar Manutenção]"
3. **Risco Jurídico:** "Nova multa atrelada ao Inquilino Z. [Mandar Cobrança pelo WhatsApp]"

## 4. Escopo do Claude (A Limpeza e Refatoração)
1. **Faxina Inicial:** Excluir `pages/Leads.jsx`. Remover menções de `Leads` em `App.jsx` e `Sidebar.jsx`.
2. **Dashboard de Alta Performance (`Dashboard.jsx`):** 
   - A lateral direita (ou o topo) será dedicada aos "Alertas Inteligentes".
   - O Claude deve criar um Hook ou Função de Utilidade (`useExecutiveSummary`) que varra: `fines` (status='pendente'), `invoices` (status='overdue'), e `vehicles` (baseado na km das `weekly_inspections`) e retorne uma lista consolidada de AÇÕES de alta prioridade.
   - Cada alerta deve ter um Botão de Ação Direta (Pagar, Contestar, Avisar Telegram).

## 5. Expectativa
O frotista abre o aplicativo de manhã com um café na mão. Ele não navega. Ele olha para o centro da tela, clica em 3 botões vermelhos ("Cobrar Atrasado", "Aprovar Vistoria", "Indicar Condutor da Multa"), e vai jogar golfe. O MyFrot virou o cérebro da empresa dele. O sistema não é uma tabela bonita, é um gerente de operações trabalhando 24/7.
