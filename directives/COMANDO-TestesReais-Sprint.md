# COMANDO — Sprint de Pré-Lançamento (Testes Reais)

> **Cole este bloco inteiro no Antigravity.**
> Ele vai executar os tickets em ordem de prioridade.
> Não interrompa — deixe ele completar cada etapa antes da próxima.

---

```
Você é o engenheiro principal do MyFrot.ai. Leia os arquivos listados abaixo na pasta directives/ e execute todos em ordem, do mais crítico para o menos crítico. Confirme ao final de cada ticket antes de seguir para o próximo.

CONTEXTO DO PROJETO:
- Stack: React 19 + Vite, Supabase (Postgres + Auth + Storage + Edge Functions Deno/TS), Telegram Bot
- Pasta frontend: execution/frontend/src/
- Pasta edge functions: supabase/functions/
- Design System: Navy #102A57, Amber #FFC524, fundo #F6F6F4
- Sempre usar RLS nas migrações de banco
- Nunca remover features existentes — apenas adicionar
- Commit a cada ticket concluído com mensagem descritiva

ORDEM DE EXECUÇÃO:

IMPORTANTE — 3 momentos distintos no ciclo do carro. Não misturar:
   - CHECK-IN DE ENTREGA: fotos obrigatórias (4) + DOT dos 5 pneus + série da bateria + foto de cada peça
   - CHECK-IN SEMANAL DE VÍDEO: apenas vídeo com KM + nível de óleo + volta no carro. Sem série/DOT.
   - CHECK-IN DE DEVOLUÇÃO: comparativo entre o que foi registrado na entrega vs. estado atual

1. TICKET-Vehicle-Serial-Numbers.md
   - Migration: tabela vehicle_tires + campos bateria em vehicles
   - Frontend: seção "Pneus & Bateria" no modal de CHECK-IN DE ENTREGA (não no cadastro do veículo)
   - Check-in de entrega bloqueia sem DOT dos 5 pneus + série da bateria + fotos
   - Check-in de devolução mostra comparativo lado a lado
   - Alerta de garantia da bateria integrado ao daily-expiry-check existente

2. TICKET-Checkin-Photo-Required.md
   - Frontend (Portal.jsx): bloquear check-in DE ENTREGA sem 4 fotos obrigatórias
   - Validação de KM: não aceitar KM menor que o anterior
   - Migration: campo position em inspection_photos se não existir

3. TICKET-Weekly-Video-Checkin.md
   - Frontend (Portal.jsx): upload de vídeo obrigatório no check-in SEMANAL (separado do check-in de entrega)
   - Campos obrigatórios do check-in semanal: km_atual + nivel_oleo + video_path APENAS
   - Sem série de pneu ou bateria neste fluxo — é exclusivo do check-in de entrega/devolução
   - Bucket Supabase Storage: weekly-videos (criar se não existir)
   - Edge Function: check-weekly-video-deadline (segunda 09:00, alerta motoristas sem check-in)
   - Frotista consegue assistir e aprovar o vídeo dentro do app

4. TICKET-Proactive-Expiry-Alerts.md
   - Edge Function: daily-expiry-check (07:30 todos os dias)
   - Verificar: seguro_fim (30 dias), ipva_vencimento (mês seguinte), cnh_validade (15 dias), battery_warranty_until (30 dias)
   - Criar tabela alert_sent_log para evitar duplicatas
   - Dashboard: banner vermelho quando há vencimentos < 7 dias

5. TICKET-Monday-Briefing.md
   - Modificar daily-ai-report: detectar segunda-feira e enviar relatório semanal estratégico às 07:00
   - Incluir: receita semana, check-ins recebidos vs esperados, top 3 prioridades, meta da semana
   - Dias normais (ter-sáb): manter briefing diário às 08:00

AO TERMINAR TODOS OS TICKETS:
- Rodar npm run build em execution/frontend e confirmar que não há erros
- Fazer commit final com mensagem: "feat: sprint pre-launch - video checkin, series numbers, expiry alerts, monday briefing"
- Confirmar que o build passou e listar quais arquivos foram criados/modificados
```

---

## Checklist de conferência após execução

Teste cada item manualmente depois que o Antigravity terminar:

- [ ] Cadastrar um veículo e preencher pneus + bateria com número de série e foto
- [ ] Fazer check-in no Portal sem foto — deve bloquear
- [ ] Fazer check-in com 4 fotos — deve liberar
- [ ] Enviar check-in semanal sem vídeo — deve bloquear
- [ ] Enviar check-in semanal com vídeo — deve aparecer na fila de aprovação
- [ ] Frotista assiste vídeo e aprova no app
- [ ] Verificar no Telegram: alerta de segunda para check-ins em aberto
- [ ] Verificar no Dashboard: banner aparece quando seguro está vencendo em < 7 dias
