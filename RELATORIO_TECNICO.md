# myfrot.ai — Relatório Técnico v1.0

> Sistema de gestão de frota por aplicativo (Uber/99/iFood).
> Stack: React + Vite · Supabase (Postgres + Auth + Storage + Edge Functions) · Telegram Bot + IA Agêntica.

---

## Arquitetura Geral

```
┌─────────────────────────────────────────────┐
│  Frontend (React/Vite)                      │
│  /execution/frontend/src/                   │
│  • Dashboard · Vehicles · Tenants           │
│  • Payments · Maintenance                   │
│  • Sidebar (Telegram connect)               │
└────────────────────┬────────────────────────┘
                     │ Supabase JS SDK
┌────────────────────▼────────────────────────┐
│  Supabase (bmwvigbktrypgkcbxlxi)            │
│  • Postgres (RLS em todas as tabelas)       │
│  • Auth (email/password)                    │
│  • Storage (4 buckets públicos)             │
│  • Edge Functions (Deno/TypeScript)         │
└────────────────────┬────────────────────────┘
                     │
       ┌─────────────┴─────────────┐
       │                           │
┌──────▼──────┐           ┌────────▼────────┐
│ telegram-   │           │ telegram-       │
│ billing     │           │ webhook (IA)    │
│ Cobrança    │           │ Agente com 12   │
│ manual via  │           │ ferramentas +   │
│ Telegram    │           │ OCR de multas   │
└─────────────┘           └─────────────────┘
```

---

## Tabelas do Banco de Dados

### `public.clients`
Donos de frota (1 por conta Supabase Auth).

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | UUID PK | Igual ao `auth.uid()` |
| `name` | TEXT | Nome do gestor |
| `email` | TEXT UNIQUE | Email de login |
| `telegram_username` | TEXT | Username do Telegram do gestor |
| `created_at` | TIMESTAMPTZ | — |

---

### `public.vehicles`
Veículos da frota.

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | UUID PK | — |
| `client_id` | UUID FK → clients | Dono da frota |
| `type` | TEXT | `'car'` ou `'moto'` |
| `brand` | TEXT | Ex: Toyota |
| `model` | TEXT | Ex: Corolla |
| `year` | INT | Ano do veículo |
| `plate` | TEXT | Placa (ex: BRA2E25) |
| `color` | TEXT | Cor |
| `km` | NUMERIC | KM atual |
| `fuel_level` | INT (0–100) | Nível de combustível em % |
| `tire_condition` | TEXT | novo / bom / meia vida / troca necessária |
| `status` | TEXT | `'disponivel'` / `'locado'` / `'manutencao'` |
| `rent_weekly` | NUMERIC | Valor semanal R$ |
| `docs_ipva` | DATE | Vencimento IPVA |
| `docs_seguro` | DATE | Vencimento seguro |
| `docs_revisao` | DATE | Data da revisão |
| `photos` | JSONB `[]` | Array de `{url, path, name}` |
| `checklist_history` | JSONB `[]` | Histórico de checklists |
| `current_tenant_id` | UUID FK → tenants | Locatário atual (set pelo contrato) |
| `notes` | TEXT | Observações |

**RLS:** acesso total apenas ao `client_id = auth.uid()`.

---

### `public.tenants`
Motoristas / locatários vinculados a um gestor.

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | UUID PK | — |
| `client_id` | UUID FK → clients | Dono da frota |
| `vehicle_id` | UUID FK → vehicles | Veículo vinculado |
| `name` | TEXT | Nome completo |
| `cpf` | TEXT | CPF |
| `phone` | TEXT | Celular principal |
| `phone2` | TEXT | Celular alternativo |
| `email` | TEXT | — |
| `cnh` | TEXT | Número CNH |
| `cnh_expiry` | DATE | Vencimento CNH |
| `cnh_category` | TEXT | Categoria CNH |
| `app_used` | TEXT | App (Uber/99/iFood) |
| `app_rating` | TEXT | Avaliação no app |
| `status` | TEXT | `'ativo'` / `'encerrado'` |
| `blacklisted` | BOOLEAN | Na lista negra |
| `rent_weekly` | NUMERIC | Aluguel semanal R$ |
| `telegram_username` | TEXT | @username no Telegram |
| `telegram_chat_id` | BIGINT | Chat ID numérico (via /start) |
| `doc_photos` | JSONB `{}` | Fotos de documentos |
| `notes` | TEXT | Observações |

---

### `public.payments`
Cobranças semanais de aluguel.

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | UUID PK | — |
| `client_id` | UUID FK → clients | — |
| `tenant_id` | UUID FK → tenants | Locatário cobrado |
| `week_label` | TEXT | Ex: "Semana 01/03" |
| `due_date` | DATE | Data de vencimento |
| `paid_date` | DATE | Data do pagamento |
| `value_amount` | NUMERIC | Valor R$ |
| `paid_status` | BOOLEAN | `true` = pago |
| `payment_method` | TEXT | Pix / Dinheiro / Transferência |
| `receipt_url` | TEXT | URL do comprovante no Storage |

---

### `public.checkins`
Registros de entrega, devolução e check-out de veículos.

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | UUID PK | — |
| `client_id` | UUID FK → clients | — |
| `vehicle_id` | UUID FK → vehicles | — |
| `tenant_id` | UUID FK → tenants | Motorista (opcional) |
| `checkin_type` | TEXT | `'entrega'` / `'devolucao'` / `'exit'` |
| `mileage` | NUMERIC | KM registrada |
| `fuel_level` | INT (0–100) | Combustível em % |
| `photos` | JSONB `[]` | Fotos do check-in/out |
| `notes` | TEXT | Observações |
| `created_at` | TIMESTAMPTZ | — |

> `checkin_type='exit'` é o check-out de devolução — libera o veículo e calcula KM rodados.

---

### `public.maintenance`
Despesas e agendamentos de manutenção.

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | UUID PK | — |
| `client_id` | UUID FK → clients | — |
| `vehicle_id` | UUID FK → vehicles | — |
| `event_type` | TEXT | `'expense'` / `'schedule'` |
| `category` | TEXT | Revisão / Pneu / Freios / Óleo / Elétrica / Funilaria / IPVA / Outro |
| `date` | DATE | Data da despesa ou agendamento |
| `description` | TEXT | Descrição |
| `value_amount` | NUMERIC | Custo R$ |
| `done` | BOOLEAN | Agendamento concluído |

---

### `public.insurance`
Apólices de seguro por veículo.

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | UUID PK | — |
| `client_id` | UUID FK → clients | — |
| `vehicle_id` | UUID FK → vehicles | — |
| `insurer` | TEXT | Nome da seguradora |
| `policy_number` | TEXT | Número da apólice |
| `pay_date` | DATE | Data de pagamento |
| `expiry_date` | DATE | Vencimento da apólice |
| `amount` | NUMERIC | Prêmio R$ |
| `notes` | TEXT | — |

---

### `public.fines`
Multas de trânsito.

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | UUID PK | — |
| `client_id` | UUID FK → clients | — |
| `vehicle_id` | UUID FK → vehicles | Nullable (OCR preenche depois) |
| `tenant_id` | UUID FK → tenants | Motorista infrator (opcional) |
| `photo_url` | TEXT | URL da foto da multa |
| `photo_path` | TEXT | Path no Storage |
| `amount` | NUMERIC | Valor R$ |
| `date` | DATE | Data da infração |
| `due_date` | DATE | Vencimento da multa |
| `description` | TEXT | Descrição |
| `infraction_code` | TEXT | Código (ex: 55412) |
| `status` | TEXT | `'pendente'` / `'pago'` / `'contestado'` |

---

## Storage Buckets

| Bucket | Acesso | Uso |
|---|---|---|
| `vehicle-photos` | Público | Fotos do cadastro do veículo |
| `checkin-photos` | Público | Fotos de check-in e check-out |
| `fine-photos` | Público | Fotos de multas enviadas pelo Telegram |
| `payment-receipts` | Público | Comprovantes de pagamento (PDF ou imagem) |

**Política padrão de todos os buckets:**
- `INSERT` → apenas usuários autenticados
- `SELECT` → público (URLs diretas funcionam sem auth)
- `DELETE` → apenas usuários autenticados

---

## Edge Functions

### `telegram-billing`
Envia cobrança manual de aluguel via Telegram.

**Endpoint:** `POST /functions/v1/telegram-billing`

**Payload:**
```json
{
  "client_name": "João Silva",
  "amount_due": 400.00,
  "telegram_chat_id": 123456789,
  "telegram_username": "joaosilva"
}
```

> Preferência: `telegram_chat_id` numérico (vinculado via `/start`). Fallback: `@username`.

---

### `telegram-webhook`
Webhook do bot Telegram com agente IA agêntico. Recebe todas as mensagens do admin e dos locatários.

**Modelo IA:** `google/gemini-2.0-flash-001` via OpenRouter (configurável via `AI_MODEL` env var).

#### Fluxo Admin
1. Admin envia mensagem de texto → agente IA interpreta e chama ferramentas
2. Admin envia foto → OCR automático extrai placa + valor + infração → registra multa

#### Fluxo Locatário
- `/start` ou `/start <UUID>` → vincula `telegram_chat_id` ao perfil do locatário
- Mensagens avulsas → resposta genérica pedindo contato com o gestor

---

## Ferramentas da IA (12 no total)

### Consultas

| Ferramenta | Quando usar | Retorna |
|---|---|---|
| `listar_locatarios` | Perguntas sobre motoristas, quem está locando, inadimplentes | tenants + vehicles + payments |
| `listar_pagamentos` | Dívidas, atrasos, valores pendentes | payments + tenants |
| `listar_checkins` | KM atual, histórico de entregas/devoluções | checkins + vehicles + tenants |
| `listar_seguros` | Apólices, vencimentos de seguro | insurance + vehicles |
| `listar_multas` | Infrações, penalidades por veículo | fines + vehicles + tenants |
| `listar_manutencao` | Gastos por categoria, histórico, agendamentos | maintenance + vehicles |
| `verificar_vencimentos` | "Como está a frota?", resumo geral, o que vence | seguros + manutenções + multas + KM alta |
| `buscar_veiculo_por_nome` | Encontrar veículo por marca/modelo quando sem placa | vehicles (ilike em brand, model, color) |

### Ações

| Ferramenta | O que faz |
|---|---|
| `atualizar_locatario` | Edita campos do locatário (status, blacklist, rating, telegram, notes) |
| `atualizar_pagamento` | Marca como pago, altera valor, método, vencimento |
| `registrar_multa` | Registra infração com dados do OCR ou do admin; busca veículo por placa |
| `criar_contrato_locacao` | Vincula locatário ao veículo: status→locado, current_tenant_id preenchido |
| `gerar_comprovante` | Gera texto de comprovante (entrega) ou resumo de devolução (exit) pronto para WhatsApp |

---

## Normalização de Placas

Todas as buscas por placa usam a função `normalizePlate`:

```typescript
const normalizePlate = (p: string) => p.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
```

Exemplos que encontram o mesmo veículo:
- `"abc 1234"` → `"ABC1234"`
- `"ABC-1234"` → `"ABC1234"`
- `"abc1234"` → `"ABC1234"`
- `"BRA-2E25"` → `"BRA2E25"`

---

## OCR de Multas via Telegram

1. Admin envia foto de multa no Telegram
2. Imagem é salva no bucket `fine-photos`
3. IA visão (Gemini) extrai `{plate, amount, description}` da imagem
4. Uma linha em `fines` é criada com `vehicle_id=null` (pendente)
5. IA chama `registrar_multa` com os dados extraídos — busca o veículo pela placa e preenche `vehicle_id`
6. Se a placa não for identificada, admin informa no chat e IA completa o registro

---

## Gerador de Comprovante / Resumo de Devolução

**Gatilho:** admin digita "gerar comprovante \<placa\>" ou "resumo de devolução \<placa\>"

**Comportamento:**
- Busca o checkin mais recente do veículo
- Se `checkin_type='exit'` → gera **Resumo de Devolução** (inclui KM rodados na locação)
- Caso contrário → gera **Comprovante de Check-in** (entrega ou devolução padrão)
- Texto retornado verbatim, pronto para copiar e enviar ao motorista via WhatsApp

**Exemplo de saída (devolução):**
```
RESUMO DE DEVOLUCAO - MYFROTA

Veiculo: BRA2E25 — Toyota Corolla
Data: 06/03/2026 às 14:32
KM na devolucao: 48.250 km
Total rodado: 3.420 km rodados nesta locacao
Tanque: 3/4
Fotos: 4 foto(s) documentadas no servidor seguro.
Motorista: João Silva
---------------------------
Veiculo devolvido com sucesso. Obrigado pela preferencia!
```

---

## Comandos de Deploy

```bash
# Edge Functions
supabase functions deploy telegram-webhook
supabase functions deploy telegram-billing

# Frontend (build local)
cd execution/frontend
npm run build

# Migrations (aplicar no Supabase)
supabase db push
```

---

## Variáveis de Ambiente (Supabase Secrets)

| Variável | Obrigatória | Descrição |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | Sim | Token do BotFather |
| `ADMIN_TELEGRAM_ID` | Sim | Chat ID numérico do gestor (admin do bot) |
| `SUPABASE_URL` | Sim | URL do projeto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Sim | Service role key (acesso total ao DB) |
| `OPENROUTER_API_KEY` | Sim | Chave OpenRouter para IA + OCR |
| `AI_MODEL` | Não | Modelo IA (padrão: `google/gemini-2.0-flash-001`) |

**Frontend** (arquivo `.env` em `execution/frontend/`):
```
VITE_SUPABASE_URL=https://<projeto>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon_key>
```

---

## Páginas do Frontend

| Página | Arquivo | Funcionalidades |
|---|---|---|
| Dashboard | `src/components/Dashboard.jsx` | Métricas da semana, alertas de vencimento, ranking de locatários |
| Veículos | `src/pages/Vehicles.jsx` | CRUD, fotos, check-in, check-out com resumo de KM |
| Locatários | `src/pages/Tenants.jsx` | CRUD, extrato, blacklist, deep link Telegram |
| Pagamentos | `src/pages/Payments.jsx` | Cobranças, extrato clicável, upload de comprovantes, cobrança via Telegram |
| Manutenção / Frota | `src/pages/Maintenance.jsx` | Despesas, agendamentos, seguros, IPVA, multas |
| Sidebar | `src/components/Sidebar.jsx` | Navegação, modal de vinculação do Telegram do gestor |

---

## Design System

- **Fonte:** Helvetica Neue (fallback: Helvetica, Arial, sans-serif)
- **Paleta principal:**
  - Background: `#F6F6F4`
  - Surface (cards): `#FFFFFF`
  - Border: `#EBEBEB` / `#E8E8E6`
  - Text: `#111827` (charcoal)
  - Muted: `#6B7280` / `#9CA3AF`
  - Accent: `#FFC524` (amarelo)
  - Sage (sucesso): `rgba(143,156,130,0.18)` / `#4A5441`
  - Dusty Rose (erro): `#E6C6C6` / `#7A3B3B`
  - Amber (aviso): `#FFF0C2` / `#7A5800`
- **Ícones:** Lucide React (zero emojis)
- **Cards:** `border-radius: 24–28px`, `border: 1px solid #EBEBEB`, sem sombra
- **Stat values:** `font-size: 36px`, `font-weight: 700`, `letter-spacing: -2px`

---

*Gerado em 06/03/2026 — myfrot.ai v1.0*
