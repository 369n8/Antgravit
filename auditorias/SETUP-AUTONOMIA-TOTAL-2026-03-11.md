# SETUP AUTONOMIA TOTAL — Execute no terminal do Claude Code

---

## NIVEL 1 — HOOKS DO CLAUDE CODE (Imediato, apos cada edicao)
## Toda vez que o agente editar um arquivo, o build roda automatico e erros aparecem na hora

Cole no terminal:

```bash
cat > .claude/settings.json << 'EOF'
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write|MultiEdit",
        "hooks": [
          {
            "type": "command",
            "command": "cd /Users/goat/Desktop/Projects/execution/frontend && npm run build 2>&1 | tail -10 | grep -E 'error|warning|built|Error' || echo 'Build OK'"
          }
        ]
      },
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "echo '[AUDITORIA] Comando executado em: '$(date '+%Y-%m-%d %H:%M:%S') >> /Users/goat/Desktop/Projects/auditorias/log-comandos.txt 2>/dev/null || true"
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "cd /Users/goat/Desktop/Projects && git status --short | head -10"
          }
        ]
      }
    ]
  }
}
EOF
echo "Hooks configurados com sucesso"
```

---

## NIVEL 2 — GIT HOOK (Automatico apos cada commit)
## Apos cada git commit, Claude Code roda automaticamente verificando se o deploy vai funcionar

```bash
mkdir -p .git/hooks && cat > .git/hooks/post-commit << 'HOOK'
#!/bin/bash
echo ""
echo "=== AUTO-REVIEW POS-COMMIT ==="
echo "Rodando build de verificacao..."
cd /Users/goat/Desktop/Projects/execution/frontend && npm run build 2>&1 | tail -5
if [ $? -eq 0 ]; then
  echo "Build OK - commit seguro para deploy"
else
  echo "ATENCAO: Build falhou - verifique antes de fazer push"
fi
echo "================================"
HOOK
chmod +x .git/hooks/post-commit
echo "Git hook post-commit configurado"
```

---

## NIVEL 3 — MODO PROATIVO NO CLAUDE.MD
## Claude Code vai automaticamente buscar melhorias sem voce pedir

```bash
cat >> CLAUDE.md << 'EOF'

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

EOF
echo "Modo proativo adicionado ao CLAUDE.md"
```

---

## NIVEL 4 — TAREFA AGENDADA DE MELHORIA AUTONOMA
## Todo dia de manha, o sistema detecta e aplica melhorias sozinho

Cole no Claude Code:

```
Crie uma tarefa agendada chamada "melhoria-autonoma-diaria" que roda toda segunda, quarta e sexta as 10h.

A tarefa deve:
1. Acessar a pasta /Users/goat/Desktop/Projects
2. Ler o ROADMAP em directives/ROADMAP.md
3. Identificar o proximo ticket de FASE 1 nao concluido
4. Ler o ticket completo
5. Se o ticket for de correcao de bug (fix): aplicar a correcao automaticamente, buildar, commitar e fazer push
6. Se o ticket for de nova feature: criar um rascunho do que seria necessario e salvar em auditorias/rascunho-[ticket].md para aprovacao do Chefinho
7. Atualizar o log-trabalho.md com o que foi feito
8. Se nao houver tickets de FASE 1 pendentes: mover para FASE 2 e repetir
```

---

## VERIFICAR SE TUDO ESTA ATIVO

```bash
echo "=== STATUS DOS HOOKS ===" && \
echo -n "Claude Hooks: " && cat .claude/settings.json | grep -c "matcher" && \
echo -n "Git Hook: " && ls -la .git/hooks/post-commit 2>/dev/null | awk '{print $1, $9}' && \
echo -n "CLAUDE.md proativo: " && grep -c "MODO PROATIVO" CLAUDE.md && \
echo "========================"
```

---

## RESUMO: O QUE CADA NIVEL FAZ

| Nivel | Quando dispara | O que faz | Precisa pedir? |
|---|---|---|---|
| Hooks | Apos cada edicao | Build automatico, log de comandos | NAO |
| Git Hook | Apos cada commit | Verifica se deploy vai funcionar | NAO |
| Modo Proativo | Toda sessao | Busca bugs similares, sugere proximos passos | NAO |
| Tarefa Agendada | Seg/Qua/Sex 10h | Aplica fixes, cria rascunhos de features | NAO |
