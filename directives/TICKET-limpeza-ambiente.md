# TICKET-limpeza-ambiente: Desinstalação de Extensões Irrelevantes

## Problema
O ambiente de desenvolvimento MyFrot no Mac Mini M4 contém extensões que não pertencem ao stack (React/Supabase), gerando ruído cognitivo e consumo desnecessário de recursos.
Impacto: Perda de agilidade técnica. Mantendo ferramentas irrelevantes, o sistema desperdiça memória que deveria estar dedicada às instâncias do MyFrot.

## Tabelas do Supabase
Nenhuma. Alteração de infraestrutura local.

## Lógica de Negócio
1. Identificar extensões solicitadas para remoção.
2. Executar desinstalação via CLI `code`.
3. Rodar `npm run build` para garantir integridade do ambiente pós-limpeza.

## Critério de Aceite
- `llvm-vs-code-extensions.vscode-clangd` desinstalada.
- `Shopify.ruby-lsp` desinstalada.
- Build passando.
