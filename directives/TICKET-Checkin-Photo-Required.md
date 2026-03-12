# TICKET: Foto Obrigatória no Check-in + Validação de KM

> **Prioridade:** 🟡 MÉDIA-ALTA — Protege o frotista de disputas com o motorista sobre danos
> **Estimativa:** 2-3 horas (frontend only)
> **Dependências:** Nenhuma

---

## Problema

Hoje o check-in aceita envio sem foto. Se um motorista devolver um carro danificado e não tiver foto do estado na saída, o frotista não tem prova. Isso é um buraco financeiro e jurídico.

Além disso, o campo de KM na saída não valida contra o KM atual do veículo — um motorista pode preencher qualquer número.

---

## Solução

### 1. Foto obrigatória no check-in (mínimo 4 fotos)

Bloquear o botão "Confirmar Check-in" se o motorista não enviar pelo menos **4 fotos**:
- Frente do veículo
- Traseira do veículo
- Lateral esquerda
- Lateral direita

Fotos adicionais (danos, interior) são opcionais.

**UX esperada:**
```
📸 Fotos obrigatórias (4/4 ✅)
[Frente ✅] [Traseira ✅] [Lateral E ✅] [Lateral D ✅]

[+ Adicionar foto de dano (opcional)]

[Confirmar Check-in] ← habilitado só quando 4/4 concluídas
```

### 2. Validação de KM

Ao registrar KM na saída:
- Buscar KM atual do veículo no banco
- Se KM informado < KM atual: mostrar erro "KM não pode ser menor que o registrado anteriormente (X km)"
- Se KM informado > KM atual + 500 em um único check-in: pedir confirmação (pode ser correto para veículos parados há tempo)

### 3. Comparação visual no check-out

Quando o motorista fizer check-out, mostrar **lado a lado**:
- Foto do check-in (estado de saída)
- Foto atual enviada (estado de devolução)

Isso permite ao frotista aprovar a devolução com evidência visual clara.

---

## Arquivos a modificar

### `execution/frontend/src/pages/Vehicles.jsx` (modal de check-in)

```jsx
// Estado de controle das fotos obrigatórias
const [requiredPhotos, setRequiredPhotos] = useState({
  frente: null,
  traseira: null,
  lateral_esq: null,
  lateral_dir: null
});

const allPhotosUploaded = Object.values(requiredPhotos).every(p => p !== null);

// Validação de KM
const validateKm = (newKm, currentKm) => {
  if (newKm < currentKm) {
    return `KM inválido: não pode ser menor que ${currentKm.toLocaleString()} km`;
  }
  if (newKm > currentKm + 500) {
    return `Confirme: KM muito alto (${newKm.toLocaleString()} km). Veículo ficou parado?`;
  }
  return null;
};

// Botão bloqueado
<button
  disabled={!allPhotosUploaded || kmError !== null}
  onClick={handleCheckin}
  style={{ opacity: allPhotosUploaded ? 1 : 0.4 }}
>
  Confirmar Check-in
</button>
```

### Banco de Dados — Estrutura das fotos

```sql
-- Garantir que inspection_photos tem campos de posição
ALTER TABLE inspection_photos
ADD COLUMN IF NOT EXISTS position TEXT CHECK (position IN ('frente', 'traseira', 'lateral_esq', 'lateral_dir', 'dano', 'interior', 'outro'));

ALTER TABLE inspection_photos
ADD COLUMN IF NOT EXISTS is_required BOOLEAN DEFAULT false;
```

---

## Mensagem para o motorista no Portal

Quando o motorista acessar o Portal e for fazer check-in, mostrar aviso claro:

```
📸 Para confirmar a saída do veículo, envie 4 fotos obrigatórias.
Isso protege você de disputas sobre danos que não foram causados por você.
```

---

## Critério de Aprovação

- [ ] Não é possível confirmar check-in sem 4 fotos
- [ ] KM inválido mostra mensagem de erro clara
- [ ] Fotos de check-in ficam salvas e visíveis no check-out para comparação
- [ ] Portal do motorista mostra instruções sobre as fotos obrigatórias
