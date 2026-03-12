# TICKET: Alertas Proativos de Vencimento (Seguro, IPVA, CNH)

> **Prioridade:** 🟠 ALTA — Protege o patrimônio do frotista sem ele precisar lembrar
> **Estimativa:** 3-4 horas
> **Dependências:** Telegram configurado (ver TICKET-PreLaunch-RealTests)

---

## Problema

Hoje o sistema mostra seguros vencendo no Dashboard, mas o frotista só descobre se entrar no app. Se ele esquecer de olhar, o seguro vence → carro não coberto → acidente = prejuízo total.

O produto elite não deixa o dono ser surpreendido. **O sistema avisa primeiro.**

---

## Solução

Adicionar 3 novos alertas automáticos via Telegram para o dono da frota:

### Alerta 1 — Seguro vencendo em 30 dias
```
🛡️ ATENÇÃO: Seguro vencendo em breve
Veículo: Honda Civic — ABC-1234
Vencimento: 15/04/2026 (em 30 dias)
Seguradora: Porto Seguro
Apólice: 123456789

👉 Acesse o app para renovar antes de vencer.
```

### Alerta 2 — IPVA vencendo (mês seguinte)
```
📋 IPVA próximo
Veículo: Toyota Corolla — XYZ-5678
Vencimento: 30/04/2026
Valor estimado: consulte seu DETRAN

💡 Pague com desconto antes do vencimento.
```

### Alerta 3 — CNH do motorista vencendo
```
🪪 CNH VENCENDO
Motorista: João da Silva
Vencimento: 20/04/2026 (em 15 dias)
Veículo atual: Fiat Pulse — DEF-9012

⚠️ Sem CNH válida, o seguro pode ser invalidado em caso de acidente.
Notifique o motorista imediatamente.
```

---

## Implementação

### Backend — Edge Function `daily-expiry-check`

Criar nova Edge Function (Deno/TypeScript) que roda diariamente às 07:30:

```typescript
// supabase/functions/daily-expiry-check/index.ts

// 1. Consultar veículos com data_seguro_fim entre hoje e +30 dias
// 2. Consultar veículos com ipva_vencimento no mês seguinte
// 3. Consultar locatários com cnh_validade entre hoje e +15 dias
// 4. Para cada item encontrado, montar mensagem e enviar via Telegram Bot API
// 5. Evitar duplicatas: usar tabela `alert_sent_log` ou campo `last_alert_sent`

const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
const ADMIN_TELEGRAM_ID = Deno.env.get('ADMIN_TELEGRAM_ID');
```

### Banco de Dados — Migration necessária

```sql
-- Verificar se os campos já existem nas tabelas
-- vehicles: seguro_fim DATE, ipva_vencimento DATE
-- tenants: cnh_validade DATE

-- Adicionar log de alertas enviados para não spam
CREATE TABLE IF NOT EXISTS alert_sent_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid REFERENCES tenants(id),
  vehicle_id uuid REFERENCES vehicles(id),
  alert_type TEXT NOT NULL, -- 'seguro', 'ipva', 'cnh'
  sent_at TIMESTAMPTZ DEFAULT now(),
  reference_date DATE
);

-- Índice para busca rápida de alertas já enviados hoje
CREATE INDEX IF NOT EXISTS idx_alert_log_date ON alert_sent_log(sent_at::date, alert_type);
```

### Cron Schedule

```sql
-- Em supabase/migrations/ adicionar ao pg_cron
SELECT cron.schedule(
  'daily-expiry-check',
  '30 7 * * *',  -- 07:30 todos os dias
  $$SELECT net.http_post(
    url := current_setting('app.edge_function_url') || '/daily-expiry-check',
    headers := '{"Authorization": "Bearer ' || current_setting('app.service_role_key') || '"}',
    body := '{}'::jsonb
  )$$
);
```

### Frontend — Indicador no Dashboard

No `DashboardV2.jsx`, adicionar um banner vermelho discreto quando há vencimentos críticos (< 7 dias):

```jsx
{criticalExpiries.length > 0 && (
  <div style={{ background: '#FEE2E2', border: '1px solid #FCA5A5', borderRadius: 8, padding: '10px 14px', marginBottom: 12 }}>
    <span style={{ color: '#DC2626', fontWeight: 600 }}>⚠️ {criticalExpiries.length} vencimento(s) crítico(s)</span>
    <span style={{ color: '#7F1D1D', fontSize: 13, marginLeft: 8 }}>Verifique seguros e CNHs urgentes</span>
  </div>
)}
```

---

## Critério de Aprovação

- [ ] Edge Function `daily-expiry-check` criada e deployada
- [ ] Cron configurado para 07:30 diário
- [ ] Mensagem de teste recebida no Telegram do Willy
- [ ] Sem alertas duplicados (mesmo veículo não recebe 2x no mesmo dia)
- [ ] Dashboard mostra banner quando há vencimentos < 7 dias

---

## Campos necessários nas tabelas (verificar se já existem)

| Tabela | Campo | Tipo | Observação |
|--------|-------|------|-----------|
| vehicles | seguro_fim | DATE | Data de vencimento do seguro |
| vehicles | ipva_vencimento | DATE | Mês/ano do IPVA |
| tenants | cnh_validade | DATE | Vencimento da CNH do motorista |
