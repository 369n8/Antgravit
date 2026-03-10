# TICKET: Fluxo de Pagamento de Multas pelo Dono da Frota

Este documento descreve como o dono da frota interage com o sistema para liquidar multas, garantindo descontos e automatizando o reaturamento (chargeback) para o motorista.

## 🚀 O Fluxo de Negócio

1. **Detecção**: O "Motor de Multas" identifica uma nova infração.
2. **Notificação**: O gestor recebe um alerta no Telegram e vê a multa no painel "Automação IA".
3. **Decisão do Gestor**:
   - **Opção A (Pagamento com Desconto)**: O gestor decide pagar a multa agora para garantir os 20% ou 40% de desconto (SNE).
   - **Opção B (Indicação de Condutor)**: O gestor apenas indica o condutor e deixa que ele se vire com o boleto.
4. **Execução da Opção A**:
   - O gestor clica em **"Pagar com Desconto"** no App.
   - O sistema gera o boleto/PIX de liquidação via API (Celcoin/Zapay).
   - Após a confirmação, o status da multa muda para `pago_pela_frota`.
5. **Automação Monopoly**:
   - O sistema gera automaticamente um novo lançamento em `payments` para o **Motorista** no valor **Integral** da multa.
   - O lucro do "spread" (diferença entre o valor com desconto pago pela frota e o valor integral cobrado do motorista) fica para o dono da frota como taxa de gestão.

## 🛠️ Alterações de Esquema (Supabase)

### Tabela `fines` (Novas Colunas)
- `fleet_paid_at`: Timestamp de quando a frota liquidou a multa.
- `fleet_paid_amount`: Valor real pago pela frota (com desconto).
- `chargeback_payment_id`: UUID do registro em `payments` gerado para cobrar o motorista.
- `status`: Adicionar `pago_pela_frota`.

## 💻 Implementação no `api.js`

Novos métodos necessários:
- `api.getFinePaymentData(fineId)`: Busca código de barras/PIX para liquidação real.
- `api.payFine(fineId)`: Executa a liquidação e dispara o chargeback.

## 💎 Benefícios Estratégicos
- **Fluxo de Caixa**: O dono da frota economiza no desconto e recebe o valor cheio do motorista.
- **Segurança**: Garante que o licenciamento do veículo não será bloqueado por multas vencidas.
- **Autonomia**: A IA cuida de toda a burocracia de cobrança após o pagamento.
