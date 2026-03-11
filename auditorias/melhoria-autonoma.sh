#!/bin/bash
# melhoria-autonoma-diaria — Roda Seg/Qua/Sex às 10h via launchd
# Lê o ROADMAP, identifica próximo ticket FASE 1 pendente e cria rascunho
set -e

PROJECT="/Users/goat/Desktop/Projects"
LOG="$PROJECT/auditorias/log-trabalho.md"
ROADMAP="$PROJECT/directives/ROADMAP.md"
DATE=$(date '+%Y-%m-%d %H:%M:%S')

cd "$PROJECT"

echo "=== melhoria-autonoma [$DATE] ==="

# Verifica build atual
echo "[1/4] Verificando build..."
BUILD_OK=true
cd execution/frontend && npm run build 2>&1 | tail -3 || BUILD_OK=false
cd "$PROJECT"

if [ "$BUILD_OK" = false ]; then
  echo "[ERRO] Build falhou — abortando melhoria autônoma"
  echo "### $DATE — melhoria-autonoma: BUILD FALHOU" >> "$LOG"
  exit 1
fi
echo "Build: OK"

# Lê ROADMAP e identifica próximo ticket FASE 1
echo "[2/4] Lendo ROADMAP..."
FASE1_TICKETS=$(grep -A50 "FASE 1" "$ROADMAP" | grep "TICKET-" | grep -v "RESOLVIDO" | head -3)

if [ -z "$FASE1_TICKETS" ]; then
  echo "Nenhum ticket FASE 1 pendente — verificando FASE 2..."
  FASE1_TICKETS=$(grep -A50 "FASE 2" "$ROADMAP" | grep "TICKET-" | head -1)
fi

PROXIMO=$(echo "$FASE1_TICKETS" | head -1 | sed 's/.*\*\*//;s/\*\*.*//')
echo "Próximo ticket identificado: $PROXIMO"

# Lê o ticket
TICKET_FILE="$PROJECT/directives/${PROXIMO}.md"
if [ ! -f "$TICKET_FILE" ]; then
  echo "[INFO] Arquivo $TICKET_FILE não encontrado — pulando"
  echo "### $DATE — melhoria-autonoma: ticket $PROXIMO não encontrado" >> "$LOG"
  exit 0
fi

# Cria rascunho para aprovação do Chefinho
echo "[3/4] Criando rascunho para aprovação..."
RASCUNHO="$PROJECT/auditorias/rascunho-${PROXIMO}-$(date '+%Y%m%d').md"
cat > "$RASCUNHO" << RASCUNHO_EOF
# Rascunho — ${PROXIMO}
> Gerado automaticamente em $DATE pela tarefa melhoria-autonoma-diaria

## Ticket Original
$(cat "$TICKET_FILE" | head -30)

---

## Análise de Impacto
- **Arquivos que seriam alterados:** (a determinar na execução)
- **Risco:** baixo / médio / alto
- **Dependências:** verificar ROADMAP para dependências

## Ação Recomendada
Este rascunho aguarda aprovação do fundador.
Para executar: leia o ticket completo em directives/${PROXIMO}.md e instrua o Claude Code.

## Status
⏳ AGUARDANDO APROVAÇÃO
RASCUNHO_EOF

echo "Rascunho criado: $RASCUNHO"

# Atualiza log
echo "[4/4] Atualizando log..."
cat >> "$LOG" << LOG_EOF

### $DATE — melhoria-autonoma-diaria
- **Ticket identificado:** $PROXIMO
- **Build:** OK
- **Ação:** Rascunho criado em auditorias/rascunho-${PROXIMO}-$(date '+%Y%m%d').md
- **Resultado:** aguardando aprovação do fundador
LOG_EOF

# Git commit do rascunho
git add auditorias/ && git commit -m "auto: rascunho $PROXIMO gerado pela tarefa agendada" 2>/dev/null || true

echo "=== melhoria-autonoma concluída ==="
