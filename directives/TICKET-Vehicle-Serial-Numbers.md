# TICKET: Número de Série do Pneu e Bateria — Check-in de Entrega e Devolução

> **Prioridade:** 🔴 CRÍTICO — Proteção jurídica do frotista contra furto de peças
> **Estimativa:** 2-3 horas (migration + formulário)
> **Dependências:** Nenhuma — pode ser feito agora

---

## Quando registrar

- **Check-in de ENTREGA do carro ao motorista:** registrar DOT dos pneus e número de série da bateria + foto de cada um. Este é o momento de "estado de saída" — baseline que será comparado na devolução.
- **Check-in de DEVOLUÇÃO:** comparar DOT e série registrados na entrega com o que está no carro. Qualquer divergência = evidência.
- **Check-in semanal de vídeo:** NÃO inclui série/DOT. O vídeo semanal é só KM + nível de óleo + estado visual geral do carro.

---

## Problema

Furtaram um pneu do carro. O motorista diz que não foi ele. O frotista não tem prova — sem o número de série registrado, não tem como provar que aquele pneu era seu nem que a bateria foi trocada. Sem esse dado, o motorista sai impune e o frotista paga.

Com o número de série registrado na entrega + foto, qualquer adulteração na devolução vira prova documental.

---

## O que registrar

### Pneus (4 pneus + 1 step)
- **Número de série (DOT):** código gravado na lateral do pneu (ex: `DOT U2LL LMLR 0823`)
- **Marca e modelo:** ex: "Pirelli P400 185/65 R15"
- **Data de fabricação:** últimos 4 dígitos do DOT (semana + ano)
- **Condição na entrada:** nova / boa / regular / ruim

### Bateria
- **Número de série:** gravado na etiqueta lateral da bateria
- **Marca:** ex: "Moura", "Heliar", "Bosch"
- **Amperagem (Ah):** ex: 60Ah, 70Ah
- **Data de instalação:** quando foi colocada no carro
- **Garantia até:** data de vencimento da garantia

---

## Implementação

### 1. Migration Supabase

```sql
-- Tabela de pneus por veículo
CREATE TABLE IF NOT EXISTS vehicle_tires (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  vehicle_id uuid REFERENCES vehicles(id) ON DELETE CASCADE NOT NULL,
  tenant_id uuid REFERENCES tenants(id) NOT NULL,
  position TEXT NOT NULL CHECK (position IN ('dianteiro_esq', 'dianteiro_dir', 'traseiro_esq', 'traseiro_dir', 'step')),
  dot_serial TEXT,                          -- ex: "DOT U2LL LMLR 0823"
  brand TEXT,                               -- ex: "Pirelli"
  model TEXT,                               -- ex: "P400 185/65 R15"
  fabrication_week INTEGER,                 -- ex: 8 (semana do ano)
  fabrication_year INTEGER,                 -- ex: 2023
  condition TEXT CHECK (condition IN ('nova', 'boa', 'regular', 'ruim')) DEFAULT 'boa',
  photo_url TEXT,                           -- foto do pneu + DOT legível
  registered_at TIMESTAMPTZ DEFAULT now(),
  registered_by uuid REFERENCES auth.users(id),
  UNIQUE(vehicle_id, position)
);

-- Bateria
ALTER TABLE vehicles
ADD COLUMN IF NOT EXISTS battery_serial TEXT,
ADD COLUMN IF NOT EXISTS battery_brand TEXT,
ADD COLUMN IF NOT EXISTS battery_ah INTEGER,
ADD COLUMN IF NOT EXISTS battery_installed_at DATE,
ADD COLUMN IF NOT EXISTS battery_warranty_until DATE,
ADD COLUMN IF NOT EXISTS battery_photo_url TEXT;

-- RLS (mesmas políticas dos vehicles)
ALTER TABLE vehicle_tires ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Dono vê seus pneus" ON vehicle_tires
  FOR ALL USING (
    tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid())
    OR tenant_id = auth.uid()
  );
```

### 2. Onde registrar — Check-in de Entrega (Vehicles.jsx ou Portal.jsx)

**NÃO** é no cadastro do veículo em si — é no momento do **check-in de entrega** do carro ao motorista. Este é o contexto correto porque o motorista ainda está presente e é possível fotografar cada peça junto com ele.

O fluxo correto:
1. Frotista vai entregar o carro → abre modal de check-in de entrega
2. Modal exige: fotos obrigatórias (TICKET-Checkin-Photo-Required) + DOT dos pneus + série da bateria
3. Motorista confirma no Portal que os dados estão corretos (assinatura digital do estado de entrega)
4. Na **devolução**: sistema mostra lado a lado o DOT/série registrado na entrega vs. o que está agora

Adicionar seção "Peças & Segurança" no modal de check-in de entrega:

```jsx
// Tab: Peças & Segurança
<div style={{ borderTop: '1px solid #eee', marginTop: 16, paddingTop: 16 }}>
  <h4 style={{ color: NAVY, marginBottom: 12 }}>🔧 Bateria</h4>
  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
    <Input label="Número de Série" value={batterySerial} onChange={setBatterySerial} placeholder="ex: 202408-MR60" />
    <Input label="Marca" value={batteryBrand} onChange={setBatteryBrand} placeholder="ex: Moura" />
    <Input label="Amperagem (Ah)" type="number" value={batteryAh} onChange={setBatteryAh} placeholder="ex: 60" />
    <Input label="Data de Instalação" type="date" value={batteryInstalledAt} onChange={setBatteryInstalledAt} />
    <Input label="Garantia até" type="date" value={batteryWarrantyUntil} onChange={setBatteryWarrantyUntil} />
  </div>
  <PhotoUpload label="📸 Foto da bateria (etiqueta legível)" onUpload={setBatteryPhotoUrl} />
</div>

<div style={{ borderTop: '1px solid #eee', marginTop: 16, paddingTop: 16 }}>
  <h4 style={{ color: NAVY, marginBottom: 12 }}>🔴 Pneus</h4>
  {['dianteiro_esq', 'dianteiro_dir', 'traseiro_esq', 'traseiro_dir', 'step'].map(pos => (
    <TireForm key={pos} position={pos} vehicleId={vehicleId} tenantId={tenantId} />
  ))}
</div>
```

### 3. Componente TireForm

```jsx
function TireForm({ position, vehicleId, tenantId }) {
  const labels = {
    dianteiro_esq: '↖ Dianteiro Esquerdo',
    dianteiro_dir: '↗ Dianteiro Direito',
    traseiro_esq:  '↙ Traseiro Esquerdo',
    traseiro_dir:  '↘ Traseiro Direito',
    step:          '🔧 Step (Estepe)'
  };
  const [dot, setDot] = useState('');
  const [brand, setBrand] = useState('');
  const [condition, setCondition] = useState('boa');
  const [photo, setPhoto] = useState(null);

  return (
    <div style={{ background: '#F8FAFF', borderRadius: 8, padding: 12, marginBottom: 8 }}>
      <strong>{labels[position]}</strong>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 8 }}>
        <Input label="DOT / Série" value={dot} onChange={setDot} placeholder="U2LL LMLR 0823" />
        <Input label="Marca/Modelo" value={brand} onChange={setBrand} placeholder="Pirelli P400" />
        <Select label="Condição" value={condition} onChange={setCondition}
          options={[
            { value: 'nova', label: 'Nova' },
            { value: 'boa', label: 'Boa' },
            { value: 'regular', label: 'Regular' },
            { value: 'ruim', label: 'Ruim — trocar em breve' }
          ]}
        />
      </div>
      <PhotoUpload label="📸 Foto do DOT legível" onUpload={setPhoto} />
    </div>
  );
}
```

### 4. Alertas de Garantia da Bateria

Na mesma Edge Function `daily-expiry-check` (TICKET-Proactive-Expiry-Alerts):

```typescript
// Adicionar verificação de garantia da bateria
const { data: batteries } = await supabase
  .from('vehicles')
  .select('plate, model, battery_brand, battery_warranty_until')
  .not('battery_warranty_until', 'is', null)
  .lte('battery_warranty_until', thirtyDaysFromNow);

for (const v of batteries ?? []) {
  await sendTelegram(chatId,
    `🔋 GARANTIA DA BATERIA VENCENDO\n` +
    `Veículo: ${v.model} — ${v.plate}\n` +
    `Bateria: ${v.battery_brand}\n` +
    `Vencimento: ${formatDate(v.battery_warranty_until)}\n\n` +
    `Se a bateria falhar agora, você perde a garantia.`
  );
}
```

### 5. Relatório de Peças (página Vehicles ou nova aba)

```jsx
// Resumo visual dos ativos físicos por veículo
// Útil para seguro e para passagem de propriedade

<PecasReport vehicle={selectedVehicle} tires={tires} />
// Mostra: lista de pneus com DOT, bateria com série, fotos de cada um
// Botão: "Exportar relatório de peças (PDF)"
```

---

## Por que isso é inteligente

1. **Furto de pneu:** motorista troca um pneu bom por um ruim. Com DOT registrado + foto, você detecta na hora do check-out.
2. **Bateria:** motorista tira a bateria nova e bota uma velha. Com número de série, impossível negar.
3. **Seguro:** em caso de sinistro, o seguro pergunta as peças do carro. Quem tem o DOT registrado resolve em minutos.
4. **Venda do carro:** histórico completo de peças aumenta o valor de revenda.

---

## Critério de Aprovação

- [ ] Check-in de **entrega** exige DOT dos 5 pneus + série da bateria + foto de cada um
- [ ] Sem esses dados, o check-in de entrega não pode ser finalizado
- [ ] Check-in de **devolução** mostra comparativo: série/DOT registrado na entrega vs. estado atual
- [ ] Divergência de série/DOT na devolução gera alerta vermelho para o frotista
- [ ] Bateria tem: série, marca, Ah, instalação, garantia, foto
- [ ] Dados salvos no banco com RLS correta
- [ ] Alerta de garantia da bateria integrado ao `daily-expiry-check`
- [ ] Check-in semanal de vídeo **não** exige série/DOT — é separado e independente
