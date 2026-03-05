# Projeto com Arquitetura de 3 Camadas

Este projeto segue a arquitetura definida no arquivo `Agente.md`, separando preocupações em três camadas:

## 1. Diretiva (Directives) - `directives/`
Contém POPs (Procedimentos Operacionais Padrão) em Markdown que definem objetivos, entradas e ferramentas.

## 2. Orquestração (Orchestration)
Camada de tomada de decisão baseada em IA (você).

## 3. Execução (Execution) - `execution/`
Scripts Python determinísticos para processamento de dados, chamadas de API e operações de arquivo.

---
**Observação:** Arquivos temporários são gerados em `.tmp/` e não devem ser versionados.
