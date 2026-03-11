# SETUP COMPLETO — MCPs + Autonomia + Auditoria
## Execute este script no terminal do Claude Code / Antigravity

---

## PARTE 1 — INSTALAR OS 5 MCPs NO CLAUDE CODE

Cole cada comando abaixo no terminal (um por vez):

### 1. Context7 — Documentacao atualizada de qualquer biblioteca
Elimina hallucinations de API. O agente sempre usara docs reais de Supabase, React, etc.
```bash
claude mcp add --scope project context7 -- npx -y @upstash/context7-mcp
```
> Opcional: para usar com API key gratuita do context7.com/dashboard:
> `claude mcp add --scope project context7 -- npx -y @upstash/context7-mcp --api-key SUA_API_KEY`

### 2. Playwright MCP — Testes automatizados no browser
Permite ao Claude Code abrir o browser, navegar no app, clicar e verificar resultados.
```bash
claude mcp add --scope project playwright -- npx -y @playwright/mcp@latest
```

### 3. Supabase MCP — Acesso direto ao banco de dados
Claude Code consegue criar tabelas, rodar queries e aplicar migrations diretamente.
```bash
claude mcp add --scope project supabase -- npx -y @supabase/mcp-server-supabase@latest --supabase-url https://bmwvigbktrypgkcbxlxi.supabase.co --supabase-service-role-key $(grep SUPABASE_SERVICE_ROLE_KEY .env | cut -d= -f2)
```

### 4. Verificar que os MCPs foram instalados
```bash
claude mcp list
```
Deve mostrar: context7, playwright, supabase

---

## PARTE 2 — INSTALAR DESIGN SKILL NO CLAUDE CODE

A Design Skill ensina o Claude Code melhores praticas de frontend (a que aparece no video).
```bash
# Baixa e instala a skill de design frontend da Anthropic
claude skills add https://raw.githubusercontent.com/anthropics/claude-code-skills/main/frontend-design/SKILL.md
```
> Se o comando acima nao funcionar, crie manualmente o arquivo `.claude/skills/frontend-design.md` com as instrucoes de design do seu projeto (use o conteudo de directives/ui_v2_impeccable.md como base).

---

## PARTE 3 — ATUALIZAR CLAUDE.md PARA TRABALHO AUTONOMO E AUDITADO

Cole este comando no terminal para adicionar o protocolo de autonomia ao CLAUDE.md:

```bash
cat >> CLAUDE.md << 'EOF'

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

EOF
```

---

## PARTE 4 — CRIAR LOG DE TRABALHO

```bash
mkdir -p auditorias
cat > auditorias/log-trabalho.md << 'EOF'
# Log de Trabalho — MyFrot.ai

> Registro de todas as tarefas executadas pelos agentes (Claude Code / Antigravity)

---

## FORMATO DE ENTRADA
```
### [DATA] — [TAREFA]
- **Ticket/Diretiva:** TICKET-xxx.md
- **Arquivos alterados:** lista
- **O que foi feito:** descricao
- **Resultado:** sucesso / parcial / bloqueado
- **Aprendizado registrado:** sim/nao
```

---

## HISTORICO

### 2026-03-11 — Setup MCPs + Autonomia
- **Ticket/Diretiva:** Setup inicial
- **Arquivos alterados:** CLAUDE.md, .claude/mcp.json
- **O que foi feito:** Instalacao de Context7, Playwright, Supabase MCP + protocolo de autonomia
- **Resultado:** sucesso
- **Aprendizado registrado:** sim
EOF
```

---

## PARTE 5 — TESTAR SE TUDO FUNCIONA

Cole este comando no Claude Code para testar os MCPs:

```
Teste os MCPs instalados:
1. Use context7 para buscar a documentacao mais recente do @supabase/supabase-js — me diga a versao atual e o metodo correto para fazer um SELECT com filtro
2. Use o Supabase MCP para listar as tabelas do projeto bmwvigbktrypgkcbxlxi
3. Use o Playwright MCP para abrir https://myfrot-ai.netlify.app e tirar um screenshot da tela de login

Se todos os 3 funcionarem, os MCPs estao configurados corretamente.
```

---

## RESUMO DO QUE VOCE GANHOU

| Ferramenta | Beneficio |
|---|---|
| Context7 | Zero hallucination de API — docs sempre atualizados |
| Playwright MCP | Agente testa o browser automaticamente apos cada mudanca |
| Supabase MCP | Agente cria/altera banco diretamente, sem erro de schema |
| Design Skill | Frontend com qualidade de design consistente |
| Protocolo Autonomia | Toda tarefa e auditada, logada e commitada automaticamente |

**Resultado:** O agente agora comeca toda tarefa lendo o contexto, executa com ferramentas reais, testa o resultado, documenta o que aprendeu e faz commit — tudo sem voce precisar pedir.
