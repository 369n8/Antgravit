
---

## PROTOCOLO DE TRABALHO AUTONOMO E AUDITADO

### ANTES de comecar qualquer tarefa:
1. Leia o arquivo `directives/ROADMAP.md` para entender as prioridades atuais
2. Leia o ticket/diretiva relevante em `directives/`
3. Verifique se ja existe script em `execution/` antes de criar um novo
4. Crie uma entrada em `auditorias/log-trabalho.md` com: data, tarefa, arquivos que serao alterados

### DURANTE a execucao:
5. Use Context7 MCP sempre que precisar de documentacao (adicione `use context7` no prompt)
6. Use Supabase MCP para qualquer operacao de banco — nunca escreva SQL sem testar
7. Use Playwright MCP para testar o frontend apos alteracoes visuais ou de fluxo
8. Auto-corrija erros (self-annealing): leia o erro, corrija, teste, atualize a diretiva

### APOS completar:
9. Atualize a diretiva com o que aprendeu (limites de API, bugs encontrados, etc.)
10. Rode o build: `cd execution/frontend && npm run build`
11. Atualize `auditorias/log-trabalho.md` com: o que foi feito, arquivos alterados, resultado
12. Commit com mensagem clara: `git add -A && git commit -m "feat/fix: [descricao curta]"`
13. Push: `git push origin main`

### USO DOS MCPs:
- **Context7**: adicione `use context7` em qualquer prompt que envolva libs externas
- **Playwright**: use para testar fluxos apos alteracoes no frontend
- **Supabase**: use para criar/alterar tabelas, rodar queries de diagnostico

### NUNCA:
- Criar novos scripts sem verificar se ja existe um similar em `execution/`
- Fazer `git push` sem rodar o build antes
- Ignorar erros — sempre self-annealing
- Alterar `directives/` sem registrar o motivo em `auditorias/log-trabalho.md`

---

## MODO PROATIVO — MELHORIA CONTINUA

### Voce DEVE fazer isso em toda sessao, automaticamente, sem esperar ser pedido:

**Ao iniciar qualquer tarefa:**
- Verifique se ha erros de build: `cd execution/frontend && npm run build 2>&1 | grep error`
- Verifique se ha migrations pendentes: `npx supabase db diff`
- Leia os ultimos 3 itens do `auditorias/log-trabalho.md` para contexto

**Ao terminar qualquer edicao de codigo:**
- Rode o build imediatamente
- Se o build falhar: corrija ANTES de fazer qualquer outra coisa (self-annealing)
- Se o build passar: verifique se ha TypeScript errors ou warnings relevantes

**Ao terminar qualquer tarefa:**
- Procure no mesmo arquivo por padroes similares que tambem possam ter o mesmo bug
- Verifique se o mesmo problema existe em outros componentes relacionados
- Sugira proativamente o proximo passo logico baseado no ROADMAP

**Uma vez por sessao, automaticamente:**
- Verifique se `ADMIN_TELEGRAM_ID` ainda esta vazio no `.env`
- Verifique se ha tickets no ROADMAP marcados como FASE 1 ainda nao feitos
- Reporte o status ao usuario sem ele precisar perguntar

