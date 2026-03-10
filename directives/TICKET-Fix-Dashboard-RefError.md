# TICKET: Fix Dashboard V2 Reference Error

## Problema
O componente `DashboardV2.jsx` está quebrando com a mensagem: `Can't find variable: fineProfit`.
Isso ocorre porque a variável foi definida dentro do hook `useMemo` (objeto `stats`) mas está sendo chamada diretamente no JSX.

## Correção
- Ajustar todas as referências de `fineProfit` para `stats.fineProfit`.
- Garantir que outras métricas como `stats.activeCount` e `stats.occupancy` também estejam sendo acessadas corretamente.

## Arquivos Afetados
- `execution/frontend/src/components/DashboardV2.jsx`

## Instrução para o Claude
"Corrija o ReferenceError no DashboardV2.jsx trocando as chamadas diretas de fineProfit por stats.fineProfit e verifique se há outros campos do objeto stats sendo usados de forma incorreta."
