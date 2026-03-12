# TICKET: Checklist de Pré-Lançamento — Testes Reais

> **Prioridade:** 🔴 CRÍTICO — Bloqueador antes do 1º cliente pago
> **Estimativa:** 1 dia de trabalho
> **Dependências:** Nenhuma — pode começar agora

---

## Contexto

O sistema está funcional em produção (Netlify + Supabase), mas ainda não passou por um teste end-to-end com dados reais. Antes de cobrar o primeiro cliente, é preciso validar o fluxo completo com um motorista real.

---

## Bloqueadores Identificados (em ordem de prioridade)

### 1. Telegram pessoal do Willy ainda null
- **Problema:** `telegram_chat_id` do usuário dtrikerw@gmail.com = null. Sem isso, nenhum alerta ou briefing matinal chega ao dono.
- **Fix:** No app, ir em Motor IA → configurar o Chat ID pessoal do Telegram.
- **Como descobrir o Chat ID:** Mandar mensagem para @userinfobot no Telegram.

### 2. Nenhum teste end-to-end realizado
- **Fluxo completo a testar:**
  1. Cadastrar 1 veículo real com placa, fotos e documentos
  2. Cadastrar 1 motorista real com CPF, CNH e foto
  3. Fazer check-in do veículo (foto + KM + combustível + pneus)
  4. Registrar 1 pagamento semanal
  5. Disparar briefing matinal via Telegram (`/resumo`)
  6. Fazer check-out do veículo (foto + comparação de danos)
  7. Verificar se o relatório semanal foi gerado corretamente

### 3. Stripe Connect ainda em sandbox
- **Status:** Credenciais configuradas, nenhum frotista completou onboarding.
- **Decisão necessária:** Ativar produção agora ou só após validar com 5 clientes?
- **Recomendação:** Manter sandbox nos primeiros 2-3 clientes e cobrar via PIX manual enquanto valida o produto.

### 4. Automação de multas sem provedor real
- **Status:** Modo mock funciona para testes. Produção exige credenciais de Infosimples, Zapay ou API Brasil.
- **Bloqueador:** Decisão do fundador sobre qual provedor contratar.
- **Custo estimado:** Infosimples ~R$0,30/consulta | API Brasil gratuita (cobertura menor)

---

## Critério de Aprovação

- [ ] Telegram do Willy recebendo alertas reais
- [ ] 1 check-in/check-out completo documentado com fotos reais
- [ ] 1 cobrança enviada e confirmada via Telegram
- [ ] Briefing das 08h chegando todos os dias

---

## Notas de Implementação

- Não mexer em código — este ticket é de **operação e configuração**, não de desenvolvimento.
- Usar o `@myfrot_bot` e o usuário teste já existente para validar antes de criar dados reais.
