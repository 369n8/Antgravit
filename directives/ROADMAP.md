# ROADMAP MyFrot.ai
> Última atualização: 2026-03-11
> Critério de priorização: impacto no lock-in do cliente × custo de implementação

---

## FASE 1 — ESTABILIDADE (Esta semana)
> Tickets que corrigem bugs, completam funcionalidades em produção ou desbloqueiam receita imediata.

| Ticket | Justificativa |
|--------|--------------|
| **TICKET-Fix-Dashboard-RefError** | RESOLVIDO — `fineProfit` já foi removido do DashboardV2.jsx |
| **TICKET-ROI-Segregation** | Bug de UX ativo: métricas do Super Admin aparecendo para o frotista, confunde e deseduca o usuário |
| **TICKET-RESTORE-IA-MANAGER** | Push matinal diário é o maior diferencial de lock-in — cron do daily-ai-report estava faltando (corrigido nesta auditoria) |
| **TICKET-Weekly-Ops-Fines** | Check-ins semanais (km + óleo + vídeo) já implementados mas precisam ser validados end-to-end com um locatário real |

---

## FASE 2 — MULTAS & IA (Próxima semana)
> Tickets que ativam o motor autônomo de multas e consolidam o Gerente IA como produto principal.

| Ticket | Justificativa |
|--------|--------------|
| **TICKET-Automated-Fines** | Core do produto: varredura autônoma Detran/Senatran sem intervenção humana. Depende de credenciais gov.br do frotista |
| **TICKET-Fines-History-Attribution** | Crítico para cobrar multas corretamente — sem histórico de alocação, multa antiga vai para o locatário errado |
| **TICKET-Fleet-Fine-Payment-Flow** | Fecha o ciclo: multa capturada → atribuída → cobrada → paga. Sem este ticket o frotista ainda cobra na mão |
| **TICKET-LLM-Cost-Optimization** | ⚠️ CONFLITO com TICKET-LLM-Telegram-Upgrade — deve ser resolvido ANTES do upgrade do LLM. Protege margem |
| **TICKET-LLM-Telegram-Upgrade** | ⚠️ CONFLITO com TICKET-LLM-Cost-Optimization — só fazer upgrade de modelo após otimizar custo por query |
| **TICKET-Telegram-AI-Manager** | Consolidação do gerente IA — integra os 2 tickets de LLM acima em UX coerente |
| **TICKET-Proactive-Telegram-Report** | Aprimora o daily-ai-report com dados mais ricos e formato executivo (complementa TICKET-RESTORE-IA-MANAGER) |

---

## FASE 3 — MONETIZAÇÃO (Próximo mês)
> Tickets que fazem o dinheiro do frotista passar pelo sistema (lock-in financeiro = churn zero).

| Ticket | Justificativa |
|--------|--------------|
| **TICKET-Monopoly-Payments** | Stripe Connect + PIX automático — quando o recebível passa pelo sistema, o frotista não pode mais cancelar |
| **TICKET-ROI-Provedores-Multas** | Modelo de faturamento: definir as 3 camadas de lucro (frotista + plataforma + SNE) antes de cobrar |
| **TICKET-CRM-Tenant-Portal** | Portal do locatário com assinatura digital acelera conversão de leads e reduz ciclo de vendas |

---

## FASE 4 — ESCALA (Futuro)
> Tickets de features novas para crescimento após product-market fit confirmado.

| Ticket | Justificativa |
|--------|--------------|
| **TICKET-Dashboard-Premium** | Glassmorphism + dark mode — estética premium aumenta percepção de valor mas não gera ROI direto agora |
| **TICKET-Weekly-Calendar-Dashboard** | Calendário interativo de operações — feature nova que requer Fase 1+2 funcionando bem primeiro |
| **TICKET-UX-Cleanup-AI-Core** | Remover abas de CRM e simplificar navegação — refatoração de UX, menor risco se feita depois |

---

## ⚠️ CONFLITOS EXPLÍCITOS

### LLM-Cost-Optimization vs LLM-Telegram-Upgrade
- **TICKET-LLM-Cost-Optimization** propõe reduzir chamadas ao LLM (cache, classificador de intenção, evitar LLM para queries simples)
- **TICKET-LLM-Telegram-Upgrade** propõe migrar para GPT-4o (mais caro) para melhorar qualidade das respostas
- **Resolução recomendada:** Implementar Cost-Optimization PRIMEIRO (garante que o custo por usuário seja ≤ R$ 0,02/dia), DEPOIS considerar upgrade de modelo apenas para os prompts que realmente exigem qualidade superior

### TICKET-Fines-History-Attribution vs TICKET-Automated-Fines
- Automated-Fines captura multas novas. History-Attribution atribui multas de datas passadas.
- **Resolução:** Implementar em paralelo pois usam tabelas diferentes, mas o History precisa do dado de `vehicle_allocations` que o Automated cria.

---

## DECISÕES QUE PRECISAM DO FUNDADOR

1. **Provedor de multas:** Infosimples, Zapay ou API Brasil? Cada um tem custo e cobertura diferente. Ticket-Automated-Fines está bloqueado sem esta decisão.
2. **Modelo LLM final:** Gemini 2.0 Flash (atual, barato) vs GPT-4o-mini (melhor, 5x mais caro) vs manter os dois por tier de plano?
3. **ADMIN_TELEGRAM_ID no .env** está vazio — preencher imediatamente para receber alertas do sistema.
4. **Stripe Connect:** As credenciais de sandbox estão configuradas mas nenhum frotista completou o onboarding. Definir se Fase 3 é prioridade antes ou depois de validar o produto com os primeiros 10 clientes.
