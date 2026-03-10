# TICKET: Restauração do Gerente IA Telegram (Urgente)

## 1. O Erro Ético/Técnico
Durante a refatoração visual, o motor de inteligência proativa (Push Matinal) foi negligenciado. O dono da frota NÃO deve ter que abrir o sistema nem pedir o relatório; o sistema deve entregar.

## 2. Requisitos de Back-end (Lead Engineer: Claude)
1. **Auditar Edge Functions**: Verifique se a função `daily-ai-report` existe e se está devidamente conectada à tabela `clients` para ler o `telegram_chat_id`.
2. **Setup de Cron**: Se o `pg_cron` no Supabase não estiver disparando o relatório às 08:00 (BRT), restaure o agendamento.
3. **Lógica de Briefing**: O briefing deve conter:
   - Saldo de caixa de ontem.
   - Faturas que vencem hoje (com nome do locatário).
   - Novas multas capturadas nas últimas 24h.
   - Veículos que entram em manutenção hoje.
4. **Verificação de Logs**: O comando `/resumo` e o push matinal DEVEM registrar no log de automações (visto em `AutomacaoIA.jsx`).

## 3. Instrução de Execução
Claude, ignore o design agora. Foque na **Lógica de Negócio e ROI**. O sistema deve ser um "Diretor Operacional" autêntico.
- Use `supabase functions deploy daily-ai-report` se houver mudanças.
- Teste o disparo manual chamando a função com um `curl` se necessário para validar o envio pro Telegram.
