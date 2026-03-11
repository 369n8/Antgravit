# QA Fixes Executados — 11/03/2026

| # | Bug | Severidade | Status | Arquivo(s) |
|---|---|---|---|---|
| 1 | Coluna `current_km` ausente no Supabase | CRITICO | ✅ FEITO | `supabase/migrations/20260311000002_vehicles_missing_columns.sql` |
| 2 | Portal do Motorista retorna 404 no Netlify | CRITICO | ✅ FEITO | `execution/frontend/public/_redirects` + `netlify.toml` |
| 3 | Valor decimal de multa truncado (parseInt vs parseFloat) | ALTO | ✅ FEITO | `Maintenance.jsx` — amount usa `parseFloat()` + `step="0.01"` |
| 4 | Formulário de Veículo sem campos de IPVA, Seguro, Pneus e Combustível | ALTO | ✅ FEITO | `Vehicles.jsx` — VEH_BLANK + form inputs adicionados |
| 5 | Check-in sem campos de KM e Combustível | ALTO | ✅ FEITO | `Vehicles.jsx` — modal check-in com inputs + handleIO atualizado |
| 6 | Formulário de Multa sem campos de Descrição e Código | ALTO | ✅ FEITO | `Maintenance.jsx` — inputs description + infraction_code adicionados ao modal |
| 7 | Avaliação do motorista exibida como "4." em vez de "4.8" | MEDIO | ✅ FEITO | `Tenants.jsx` — 3 locais com `parseFloat().toFixed(1)` |
| 8 | Dashboard "Ações Pendentes" mostra badge 2 mas R$0 | BAIXO | ✅ FEITO | `DashboardV2.jsx` — soma overdueInvoices + fines amounts |

## Detalhes por Fix

### FIX 1 — Migration SQL
- Colunas adicionadas: `current_km`, `fuel_level`, `tire_condition`, `docs_ipva`, `docs_seguro`, `docs_revisao`
- Arquivo: `supabase/migrations/20260311000002_vehicles_missing_columns.sql`
- Executar: `supabase db push`

### FIX 2 — SPA Routing Netlify
- `execution/frontend/public/_redirects`: `/* /index.html 200`
- `netlify.toml` criado na raiz com redirect rule

### FIX 3 — Decimal Multa
- `parseFloat(e.target.value) || 0` substituindo `Number()`
- `step="0.01"` adicionado ao input de valor

### FIX 4 — Campos Veículo
- VEH_BLANK agora inclui: `fuel_level: 0`, `tire_condition: 'bom'`, `docs_ipva: ''`, `docs_seguro: ''`, `docs_revisao: ''`
- Form modal: 4 novos campos (combustível %, pneus select, IPVA date, seguro date)

### FIX 5 — Check-in KM/Combustível
- Estado `checkinData` adicionado (`{ km, fuel }`)
- Modal check-in tem inputs KM e combustível quando `showIn=true`
- `handleIO` atualiza `current_km` e `fuel_level` na tabela `vehicles`

### FIX 6 — Multa Descrição/Código
- Inputs `description` e `infraction_code` adicionados ao modal "Registrar Multa"
- FINE_BLANK já os tinha; `handleAddF` já os enviava — só faltavam os inputs visuais

### FIX 7 — Rating "4." → "4.8"
- Todas as 3 ocorrências em `Tenants.jsx` corrigidas com `parseFloat(t.app_rating).toFixed(1)`

### FIX 8 — Dashboard Badge vs R$
- `totalPendingFines` calculado de `fleetAlerts.fines`
- Display: `R$ ${(totalOverdue + totalPendingFines).toLocaleString('pt-BR')}`
