# Passagem de Bastão (SOP de Simplificação e Auditoria)

Sempre que a fundação (arquitetura, UI, integração de novos módulos B2B) for finalizada por mim (Antigravity), você DEVE rodar o seguinte comando no seu terminal com o **Claude Code CLI** para auditar, simplificar e efetivar as alterações no backend real ou no próprio código recém-refatorado:

```bash
claude "Leia as regras no arquivo directives/claudecode_skills.md. Usando o modo Ultra Think, audite agressivamente o último trabalho feito. Seu objetivo é simplificar, reduzir entropia, extrair códigos duplicados (se não houverem, mantenha como está), garantir a manutenção da lógica de negócio principal e executar qualquer script pendente no banco de dados Supabase que o arquivo .env exija. Valide se a interface está em conformidade com o 'Design Impecável v2' do projeto (shared.jsx). Depois de gerar e testar as refatorações, rode internamente a sua skill de 'simplify'. Me dê o relatório de redução e as confirmações de conexão com o banco."
```

## Instruções Adicionais
- **Não altere o prompt acima**. Ele amarra o Claude ao SOP Inegociável que acabamos de registrar.
- Você só usa esse comando no final de cada Sprint de feature (quando eu entregar os arquivos prontos e injetados no frontend/backend).
