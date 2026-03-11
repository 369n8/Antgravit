# COMANDO DE CORRECOES — QA Report 11/03/2026
## Cole este bloco inteiro no Claude Code ou Antigravity

---

Voce e um agente de desenvolvimento senior. O app MyFrot.ai passou por testes de QA e foram encontrados 9 bugs. Execute as correcoes abaixo em ordem de prioridade. Leia cada arquivo antes de editar. Nao pergunte — execute e confirme.

## CONTEXTO
- App: https://myfrot-ai.netlify.app
- Stack: React + Vite (execution/frontend/), Supabase (supabase/migrations/ e supabase/functions/)
- O frontend usa coluna `current_km` na tabela `vehicles` mas ela nao existe no Supabase

---

## FIX 1 — CRITICO | Coluna `current_km` ausente no Supabase

**Problema:** Frontend envia `current_km` no INSERT de veiculos, mas a coluna nao existe no schema. Erro: `"Could not find the 'current_km' column of 'vehicles' in the schema cache"`. Nenhum veiculo pode ser cadastrado.

**Acao:**
1. Crie o arquivo `supabase/migrations/20260311000002_vehicles_missing_columns.sql` com:

```sql
-- Adiciona colunas faltantes na tabela vehicles
ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS current_km INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fuel_level INTEGER DEFAULT 0 CHECK (fuel_level >= 0 AND fuel_level <= 100),
  ADD COLUMN IF NOT EXISTS tire_condition TEXT DEFAULT 'bom' CHECK (tire_condition IN ('novo', 'bom', 'meia vida', 'troca necessaria')),
  ADD COLUMN IF NOT EXISTS docs_ipva DATE,
  ADD COLUMN IF NOT EXISTS docs_seguro DATE,
  ADD COLUMN IF NOT EXISTS docs_revisao DATE;

-- Atualiza registros existentes com valores padrao
UPDATE public.vehicles SET current_km = COALESCE(km, 0) WHERE current_km IS NULL;
```

2. Execute: `supabase db push`
3. Confirme que a coluna foi criada: `supabase db diff`

---

## FIX 2 — CRITICO | Portal do Motorista retorna 404 no Netlify

**Problema:** O Netlify nao sabe que e um SPA (Single Page Application). Qualquer rota direta como `/portal/uuid` retorna 404 em vez de carregar o index.html e deixar o React Router resolver.

**Acao:**
1. Crie o arquivo `execution/frontend/public/_redirects` com o conteudo:

```
/* /index.html 200
```

2. Verifique se ja existe `netlify.toml` na raiz do projeto. Se nao existir, crie na raiz:

```toml
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

3. Faca build: `cd execution/frontend && npm run build`
4. Confirme que `dist/_redirects` existe apos o build

---

## FIX 3 — ALTO | Valor decimal de multa truncado (parseInt vs parseFloat)

**Problema:** Ao salvar multa de R$130,16, apenas R$16 e salvo. O handler do campo valor usa parseInt ou conversao incorreta.

**Acao:**
1. Leia os arquivos onde o formulario de multa e renderizado. Procure em:
   - `execution/frontend/src/pages/Maintenance.jsx`
   - `execution/frontend/src/pages/Fines.jsx`
   - Qualquer componente com modal de "Registrar Multa"
2. Encontre o handler do campo `amount` ou `valor` da multa
3. Substitua qualquer `parseInt(e.target.value)` ou `Math.floor()` por `parseFloat(e.target.value) || 0`
4. Garanta que o campo input tem `type="number" step="0.01"` e NAO tem `step="1"`
5. Teste logicamente: se o usuario digitar "130.16", o valor salvo deve ser 130.16

---

## FIX 4 — ALTO | Formulario de Veiculo sem campos de IPVA, Seguro, Pneus e Combustivel

**Problema:** O formulario de adicionar/editar veiculo nao tem campos para docs_ipva, docs_seguro, tire_condition e fuel_level.

**Acao:**
1. Leia `execution/frontend/src/pages/Vehicles.jsx`
2. Encontre o estado inicial do formulario (VEH_BLANK ou similar)
3. Adicione os campos faltantes ao estado inicial:
   - `fuel_level: 0`
   - `tire_condition: 'bom'`
   - `docs_ipva: ''`
   - `docs_seguro: ''`
   - `docs_revisao: ''`
4. No formulario (modal ou pagina), adicione os inputs correspondentes:
   - Combustivel: `<input type="number" min="0" max="100" />` (percentual 0-100)
   - Pneus: `<select>` com opcoes: novo / bom / meia vida / troca necessaria
   - IPVA vencimento: `<input type="date" />`
   - Seguro vencimento: `<input type="date" />`
5. Inclua esses campos no objeto enviado ao Supabase no INSERT/UPDATE

---

## FIX 5 — ALTO | Check-in sem campos de KM e Combustivel

**Problema:** O fluxo de Check-in nao tem campos para registrar KM atual e nivel de combustivel. So existe "Check-out de Saida".

**Acao:**
1. Leia `execution/frontend/src/pages/Vehicles.jsx` — procure pelo modal/fluxo de check-in
2. No modal de check-in (checkin_type = 'entrega'), adicione os campos:
   - KM atual: `<input type="number" />` → salvo em `mileage`
   - Combustivel (%): `<input type="number" min="0" max="100" />` → salvo em `fuel_level`
   - Condicao dos pneus: `<select>` → salvo em `tire_condition` (opcional)
3. Ao salvar o check-in, atualize tambem `vehicles.current_km` e `vehicles.fuel_level` com os valores informados

---

## FIX 6 — ALTO | Formulario de Multa sem campos de Descricao e Codigo

**Problema:** O modal "Registrar Multa" nao tem campo para Descricao da infracao nem Codigo (ex: 55412).

**Acao:**
1. Encontre o modal de registro de multa (provavelmente em Maintenance.jsx ou Fines.jsx)
2. Adicione ao estado do formulario: `description: ''` e `infraction_code: ''`
3. No formulario, adicione:
   - Descricao: `<input type="text" placeholder="Ex: Excesso de velocidade 15-20km/h" />`
   - Codigo da infracao: `<input type="text" placeholder="Ex: 55412" />`
4. Inclua esses campos no objeto enviado ao Supabase

---

## FIX 7 — MEDIO | Avaliacao do motorista exibida como "4." em vez de "4.8"

**Problema:** O campo `app_rating` e truncado na exibicao.

**Acao:**
1. Procure onde `app_rating` e exibido nos cards de locatarios
2. Verifique se ha algum `parseInt()`, `Math.floor()` ou slice incorreto sendo aplicado
3. Garanta que o campo e exibido como string diretamente ou com `parseFloat().toFixed(1)`
4. No input do formulario, garanta `type="text"` ou `type="number" step="0.1"` para aceitar decimais

---

## FIX 8 — BAIXO | Dashboard "Acoes Pendentes" mostra badge 2 mas R$0

**Problema:** O KPI "Acoes Pendentes" mostra count 2 mas valor R$0, inconsistente.

**Acao:**
1. Leia o componente Dashboard (DashboardV2.jsx ou components/Dashboard.jsx)
2. Encontre o calculo de "Acoes Pendentes"
3. Verifique se o valor R$ esta sendo calculado de uma query diferente do badge count
4. Se o badge conta itens (ex: multas pendentes + seguros vencendo) mas o valor nao soma os valores desses itens, corrija o calculo do valor para somar os montantes correspondentes

---

## APOS TODAS AS CORRECOES

1. Execute `cd execution/frontend && npm run build` para gerar o build atualizado
2. Confirme que `dist/_redirects` existe
3. Faca commit:
   ```
   git add -A
   git commit -m "fix: QA bugs - current_km migration, Netlify SPA redirect, decimal fines, vehicle form fields, checkin fields, fine form fields, rating display"
   git push origin main
   ```
4. Aguarde o Netlify fazer o deploy automatico (geralmente 1-2 minutos)
5. Crie o arquivo `auditorias/fixes-qa-executados-2026-03-11.md` com status de cada fix

---

## RESUMO DOS 8 FIXES
| # | Bug | Severidade | Arquivo Principal |
|---|---|---|---|
| 1 | Coluna current_km ausente | CRITICO | supabase/migrations/ |
| 2 | Portal 404 no Netlify | CRITICO | execution/frontend/public/_redirects |
| 3 | Decimal multa truncado | ALTO | Maintenance.jsx ou Fines.jsx |
| 4 | Campos veiculo faltando | ALTO | Vehicles.jsx |
| 5 | Check-in sem KM/combustivel | ALTO | Vehicles.jsx |
| 6 | Multa sem descricao/codigo | ALTO | Maintenance.jsx |
| 7 | Avaliacao "4." em vez "4.8" | MEDIO | Tenants.jsx |
| 8 | Dashboard badge vs valor | BAIXO | DashboardV2.jsx |
