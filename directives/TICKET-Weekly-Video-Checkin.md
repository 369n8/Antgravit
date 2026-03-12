# TICKET: Vídeo Semanal Obrigatório do Motorista (KM + Óleo + Estado Geral)

> **Prioridade:** 🔴 CRÍTICO — Obrigatório para testes reais. Sem isso o frotista não tem prova do estado do carro.
> **Estimativa:** 4-5 horas (Portal + backend + validação)
> **Dependências:** TICKET-Checkin-Photo-Required (foto obrigatória no check-in)

---

## Problema

Hoje o motorista pode enviar o check-in semanal sem evidências de vídeo. O frotista não tem como saber remotamente:
- Quantos km o carro rodou na semana
- Se o óleo está em nível correto
- Se o carro tem algum dano novo ou barulho suspeito

Sem esse controle, o frotista descobre problemas tarde demais — troca de motor, pneus destruídos, bateria morta — quando o conserto custa 10x mais.

---

## Escopo — O que é e o que NÃO é este check-in

| Momento | O que registra |
|---------|---------------|
| **Check-in de ENTREGA** | DOT dos pneus + série da bateria + fotos obrigatórias (ver TICKET-Vehicle-Serial-Numbers + TICKET-Checkin-Photo-Required) |
| **Check-in SEMANAL** ← este ticket | Vídeo com KM + óleo + estado visual geral. Nada de série ou DOT. |
| **Check-in de DEVOLUÇÃO** | Comparação com o estado de entrega (série, DOT, fotos) |

---

## Solução

O motorista **obrigatoriamente** envia todo fim de semana um vídeo curto (máximo 3 minutos) mostrando:

1. **KM atual** — câmera focada no painel, odômetro visível
2. **Nível do óleo** — vareta de óleo fora, câmera mostrando o nível
3. **Estado geral do carro** — volta completa pelo veículo (frente, lateral, traseira, rodas)

O envio é feito pelo **Portal do Motorista** (Portal.jsx). Sem o vídeo, o check-in semanal não é concluído.

---

## Regras de Negócio

- **Prazo:** Domingo até 23:59 de cada semana
- **Se não enviar até segunda 09:00:** Alerta automático via Telegram para o dono
- **Se não enviar até terça 09:00:** Notificação de atraso mais urgente no Telegram do dono com nome do motorista
- **Formato aceito:** MP4, MOV, AVI — máximo 200MB
- **Armazenamento:** Supabase Storage, bucket `weekly-videos`, path `/{tenant_id}/{vehicle_id}/{week_date}.mp4`

---

## Implementação

### 1. Portal.jsx — Seção de Check-in Semanal

```jsx
// Adicionar ao check-in semanal do Portal

const [weeklyVideo, setWeeklyVideo] = useState(null);
const [videoUploading, setVideoUploading] = useState(false);
const [videoProgress, setVideoProgress] = useState(0);

// Campos obrigatórios do check-in
const [kmAtual, setKmAtual] = useState('');
const [nivelOleo, setNivelOleo] = useState(''); // 'ok' | 'baixo' | 'trocar'
const [observacoes, setObservacoes] = useState('');

const checkInCompleto = weeklyVideo && kmAtual && nivelOleo;

// Upload do vídeo para Supabase Storage
async function handleVideoUpload(file) {
  if (file.size > 200 * 1024 * 1024) {
    alert('Vídeo muito grande. Máximo: 200MB');
    return;
  }
  setVideoUploading(true);
  const weekDate = getWeekStartISO(); // ex: '2026-03-09'
  const path = `${tenantId}/${vehicleId}/${weekDate}.mp4`;

  const { error } = await supabase.storage
    .from('weekly-videos')
    .upload(path, file, {
      upsert: true,
      onUploadProgress: (progress) => {
        setVideoProgress(Math.round((progress.loaded / progress.totalSize) * 100));
      }
    });

  if (!error) {
    setWeeklyVideo(path);
  }
  setVideoUploading(false);
}
```

**UI no Portal:**
```
📹 Revisão Semanal do Veículo
Envie até domingo 23:59 para não ter desconto na próxima semana.

[📹 Gravar/Enviar vídeo]
  ✅ Mostrar o painel com KM atual
  ✅ Mostrar a vareta de óleo
  ✅ Dar uma volta completa pelo carro

KM Atual: [____] km    Nível do Óleo: [OK ▼]

Observações: [campo livre]

[Enviar Check-in] ← bloqueado sem vídeo + KM + Óleo
```

### 2. Migration Supabase — Tabela `weekly_checkins`

```sql
-- Adicionar campo de vídeo se não existir
ALTER TABLE weekly_checkins
ADD COLUMN IF NOT EXISTS video_path TEXT,
ADD COLUMN IF NOT EXISTS video_submitted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS km_atual INTEGER,
ADD COLUMN IF NOT EXISTS nivel_oleo TEXT CHECK (nivel_oleo IN ('ok', 'baixo', 'trocar')),
ADD COLUMN IF NOT EXISTS video_approved BOOLEAN DEFAULT NULL, -- null=pendente, true=ok, false=problema
ADD COLUMN IF NOT EXISTS aprovado_por UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS aprovado_em TIMESTAMPTZ;

-- Criar bucket se não existir (fazer via painel Supabase Storage)
-- Bucket: weekly-videos, acesso: authenticated only
```

### 3. Edge Function `check-weekly-video-deadline`

```typescript
// Roda segunda-feira às 09:00
// Para cada vehicle_allocation ativa:
//   1. Verificar se weekly_checkin desta semana tem video_path preenchido
//   2. Se não: enviar alerta para ADMIN_TELEGRAM_ID

const msg = `⚠️ CHECK-IN PENDENTE
Motorista: ${tenant.name}
Veículo: ${vehicle.plate} — ${vehicle.model}
Sem vídeo desta semana!

Use /vistorias para ver detalhes.`;
```

### 4. Painel do Frotista — Visualização e Aprovação

Na página `Vehicles.jsx` ou nova aba em `AutomacaoIA.jsx`:

```jsx
// Card de check-in semanal com vídeo
{checkin.video_path && (
  <div>
    <video
      src={supabase.storage.from('weekly-videos').getPublicUrl(checkin.video_path).data.publicUrl}
      controls
      style={{ width: '100%', borderRadius: 8 }}
    />
    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
      <button onClick={() => approveCheckin(checkin.id)}>✅ Aprovado — sem problemas</button>
      <button onClick={() => flagCheckin(checkin.id)}>⚠️ Tem algo a verificar</button>
    </div>
  </div>
)}
```

---

## Fluxo Completo

```
Domingo até 23:59
  Motorista → Portal → Grava vídeo → Preenche KM + Óleo → Envia
                                                              ↓
                                          weekly_checkins registrado
                                                              ↓
Segunda 07:00 → Briefing inclui: "2 de 3 check-ins recebidos"
                                                              ↓
  Frotista → AutomacaoIA → Vê vídeos → Aprova ou sinaliza problema
                                                              ↓
  Se problema: frotista entra em contato com motorista via telefone
```

---

## Critério de Aprovação

- [ ] Portal bloqueia envio sem vídeo + KM + Óleo preenchidos
- [ ] Vídeo sobe para Supabase Storage corretamente
- [ ] Segunda 09:00: alerta no Telegram para motoristas sem check-in
- [ ] Frotista consegue assistir o vídeo direto no app
- [ ] Briefing de segunda lista quem enviou e quem não enviou
- [ ] KM registrado no histórico do veículo (para calcular km/semana)
