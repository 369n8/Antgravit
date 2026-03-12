import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { S, PillTabs, ptDate, fmt } from '../lib/shared';
import {
  Plus, X, Search, Car, Calendar, Wrench, Trash2,
  Camera, ChevronRight, AlertCircle, Clock, CheckCircle2,
  ChevronLeft, Upload, Edit, ArrowUpRight, ArrowDownRight,
  Maximize2
} from 'lucide-react';

const VEH_BLANK = { brand: '', model: '', year: '', plate: '', type: 'carro', status: 'disponível', daily_rate: 0, color: '', fuel_type: 'Flex', transmission: 'Automático', current_km: 0, fuel_level: 0, tire_condition: 'bom', docs_ipva: '', docs_seguro: '', docs_revisao: '' };
const BUCKET = 'vehicle-photos';

const G = {
  card: {
    background: '#FFF', borderRadius: 24, padding: '24px', border: '1px solid #F1F5F9',
    boxShadow: '0 4px 20px rgba(0,0,0,0.03)', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    position: 'relative', overflow: 'hidden'
  },
  statLabel: { fontSize: 11, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.1em' },
  statValue: { fontSize: 28, fontWeight: 900, color: '#102A57', letterSpacing: '-1.5px' },
  btn: (primary) => ({
    padding: '12px 24px', borderRadius: '16px', border: primary ? 'none' : '1px solid #E2E8F0',
    background: primary ? '#102A57' : '#FFF', color: primary ? '#FFF' : '#102A57',
    fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, transition: 'all 0.2s',
  }),
  badge: (status) => {
    const map = {
      'disponível': { c: '#10B981', b: '#F0FDF4', l: 'Disponível' },
      'alugado': { c: '#5B58EC', b: '#F3F2FF', l: 'Em Locação' },
      'manutenção': { c: '#EF4444', b: '#FFF1F1', l: 'Manutenção' },
      'indisponível': { c: '#64748B', b: '#F8FAFB', l: 'Indisponível' }
    };
    const s = map[status] || map['indisponível'];
    return {
      padding: '6px 12px', borderRadius: 10, fontSize: 11, fontWeight: 900,
      color: s.c, background: s.b, textTransform: 'uppercase'
    };
  }
};

export default function Vehicles() {
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showFiles, setShowFiles] = useState(false);
  const [showIn, setShowIn] = useState(false);
  const [showOut, setShowOut] = useState(false);
  const [sel, setSel] = useState(null);
  const [nv, setNv] = useState(VEH_BLANK);
  const [photos, setPhotos] = useState([]);
  const [upl, setUpl] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [lightbox, setLightbox] = useState(null);
  const [checkinData, setCheckinData] = useState({ km: '', fuel: '' });
  const TIRE_BLANK = { dot: '', brand: '', condition: 'boa', photoUrl: '' };
  const [tireData, setTireData] = useState({
    dianteiro_esq: { dot: '', brand: '', condition: 'boa', photoUrl: '' },
    dianteiro_dir: { dot: '', brand: '', condition: 'boa', photoUrl: '' },
    traseiro_esq:  { dot: '', brand: '', condition: 'boa', photoUrl: '' },
    traseiro_dir:  { dot: '', brand: '', condition: 'boa', photoUrl: '' },
    step:          { dot: '', brand: '', condition: 'boa', photoUrl: '' },
  });
  const [batteryData, setBatteryData] = useState({ serial: '', brand: '', ah: '', installedAt: '', warrantyUntil: '' });
  const fileRef = useRef();

  const REQUIRED_PHOTO_KEYS = ['frente', 'traseira', 'lateral_esq', 'lateral_dir'];
  const REQUIRED_PHOTO_LABELS = { frente: 'Frente', traseira: 'Traseira', lateral_esq: 'Lateral E', lateral_dir: 'Lateral D' };
  const [requiredPhotos, setRequiredPhotos] = useState({ frente: null, traseira: null, lateral_esq: null, lateral_dir: null });
  const [kmError, setKmError] = useState(null);
  const [photoUploading, setPhotoUploading] = useState(null);
  const [pendingPhotoKey, setPendingPhotoKey] = useState(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('vehicles').select('*').order('created_at', { ascending: false });
    setRows(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    if (!nv.plate || !nv.brand || !nv.model) { setError('Campos obrigatórios: Marca, Modelo e Placa.'); return; }
    setSaving(true); setError(null);
    const { data: { user } } = await supabase.auth.getUser();

    let res;
    if (showEdit) {
      res = await supabase.from('vehicles').update(nv).eq('id', nv.id);
    } else {
      res = await supabase.from('vehicles').insert({ ...nv, client_id: user.id });
    }

    setSaving(false);
    if (res.error) { setError(res.error.message); return; }
    setShowAdd(false); setShowEdit(false); setNv(VEH_BLANK); load();
  };

  const handleEdit = (v) => {
    setNv(v);
    setShowEdit(true);
  };

  const saveTiresAndBattery = async (vehicleId) => {
    const { data: { user } } = await supabase.auth.getUser();
    const { data: veh } = await supabase.from('vehicles').select('client_id').eq('id', vehicleId).single();
    const tenantId = veh?.client_id;

    await supabase.from('vehicles').update({
      battery_serial: batteryData.serial || null,
      battery_brand: batteryData.brand || null,
      battery_ah: batteryData.ah ? Number(batteryData.ah) : null,
      battery_installed_at: batteryData.installedAt || null,
      battery_warranty_until: batteryData.warrantyUntil || null,
    }).eq('id', vehicleId);

    const tireRows = Object.entries(tireData).map(([pos, t]) => ({
      vehicle_id: vehicleId,
      tenant_id: tenantId,
      position: pos,
      dot_serial: t.dot || null,
      brand: t.brand || null,
      condition: t.condition,
      registered_by: user?.id,
    })).filter(r => r.dot_serial || r.brand);

    if (tireRows.length > 0) {
      await supabase.from('vehicle_tires').upsert(tireRows, { onConflict: 'vehicle_id,position' });
    }
  };

  const handleIO = async (type, status) => {
    if (!sel) return;
    setSaving(true);
    if (type === 'out') {
      await saveTiresAndBattery(sel.id);
    }
    const updateData = { status };
    if (type === 'in') {
      if (checkinData.km !== '') updateData.current_km = Number(checkinData.km);
      if (checkinData.fuel !== '') updateData.fuel_level = Number(checkinData.fuel);
    }
    const { error: err } = await supabase.from('vehicles').update(updateData).eq('id', sel.id);
    if (!err) {
      // Registrar log de movimentação (Opcional, mas recomendado para o manual)
      await supabase.from('maintenance').insert({
        vehicle_id: sel.id,
        event_type: 'expense',
        category: type === 'in' ? 'Check-in' : 'Check-out',
        date: new Date().toISOString(),
        description: `${type === 'in' ? 'Retorno' : 'Saída'} de veículo registrado.${checkinData.km ? ` KM: ${checkinData.km}.` : ''}`,
        value_amount: 0
      });
    }
    setSaving(false);
    setShowIn(false); setShowOut(false); setSel(null); setCheckinData({ km: '', fuel: '' });
    setTireData({ dianteiro_esq: { dot: '', brand: '', condition: 'boa', photoUrl: '' }, dianteiro_dir: { dot: '', brand: '', condition: 'boa', photoUrl: '' }, traseiro_esq: { dot: '', brand: '', condition: 'boa', photoUrl: '' }, traseiro_dir: { dot: '', brand: '', condition: 'boa', photoUrl: '' }, step: { dot: '', brand: '', condition: 'boa', photoUrl: '' } });
    setBatteryData({ serial: '', brand: '', ah: '', installedAt: '', warrantyUntil: '' });
    setRequiredPhotos({ frente: null, traseira: null, lateral_esq: null, lateral_dir: null });
    setKmError(null);
    load();
  };

  const loadPhotos = async (vid) => {
    const { data } = await supabase.storage.from(BUCKET).list(vid);
    setPhotos(data || []);
  };

  const handleUpload = async (files) => {
    if (!files?.length || !sel) return;
    setUpl(true);
    const file = files[0];
    const path = `${sel.id}/${Date.now()}_${file.name}`;
    const { error: err } = await supabase.storage.from(BUCKET).upload(path, file);
    if (!err) loadPhotos(sel.id);
    setUpl(false);
  };

  const delPhoto = async (name) => {
    if (!window.confirm('Excluir esta foto?')) return;
    const { error: err } = await supabase.storage.from(BUCKET).remove([`${sel.id}/${name}`]);
    if (!err) loadPhotos(sel.id);
  };

  const handleRequiredPhotoUpload = async (file, key) => {
    if (!file || !sel) return;
    setPhotoUploading(key);
    const path = `${sel.id}/checkin_${key}_${Date.now()}_${file.name}`;
    const { data, error: err } = await supabase.storage.from('inspections').upload(path, file, { upsert: true });
    if (!err) {
      const url = supabase.storage.from('inspections').getPublicUrl(path).data.publicUrl;
      setRequiredPhotos(p => ({ ...p, [key]: url }));
      await supabase.from('inspection_photos').insert({
        vehicle_id: sel.id,
        photo_url: url,
        position: key,
        is_required: true,
        taken_at: new Date().toISOString(),
      }).select().maybeSingle();
    }
    setPhotoUploading(null);
  };

  const filtered = rows.filter(r => (r.brand + r.model + r.plate).toLowerCase().includes(search.toLowerCase()));

  if (loading) return <div className="loading"><div className="spinner" /> Sincronizando frota...</div>;

  return (
    <div className="page" style={{ background: '#F8FAFB', minHeight: '100vh', padding: '24px 0' }}>

      {/* ── HEADER ── */}
      <div style={{ marginBottom: 48, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
        <h2 style={{ fontSize: 32, fontWeight: 900, color: '#102A57', letterSpacing: '-1.5px', margin: 0 }}>Garagem</h2>
        <p style={{ color: '#64748B', fontWeight: 600, marginTop: 4, fontSize: 16 }}>Gestão de ativos e disponibilidade em tempo real</p>

        <div style={{ marginTop: 24, width: '100%', maxWidth: 500, position: 'relative' }}>
          <Search size={18} color="#94A3B8" style={{ position: 'absolute', left: 18, top: '50%', transform: 'translateY(-50%)' }} />
          <input
            placeholder="Pesquisar por placa, marca ou modelo..."
            style={{ ...S.inp, paddingLeft: 52, borderRadius: 20, height: 56, fontSize: 15, background: '#FFF' }}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <button style={{ ...G.btn(true), marginTop: 24, height: 52, padding: '0 32px' }} onClick={() => setShowAdd(true)}>
          <Plus size={20} /> ADICIONAR VEÍCULO
        </button>
      </div>

      {/* ── VEHICLE GRID ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 24 }}>
        {filtered.map(v => (
          <div key={v.id} style={G.card}>
            {/* Tag de Status */}
            <div style={{ position: 'absolute', top: 24, right: 24 }}>
              <span style={G.badge(v.status)}>{v.status}</span>
            </div>

            <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
              <div style={{ width: 80, height: 80, borderRadius: 20, background: '#F8FAFB', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Car size={32} color="#102A57" strokeWidth={1.5} />
              </div>
              <div style={{ flex: 1, paddingTop: 4 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '1px' }}>{v.brand}</div>
                <h3 style={{ fontSize: 20, fontWeight: 900, color: '#102A57', margin: '2px 0 6px' }}>{v.model}</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ padding: '4px 10px', background: '#F1F5F9', borderRadius: 8, fontSize: 12, fontWeight: 800, color: '#102A57' }}>{v.plate}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#64748B' }}>{v.year} · {v.type}</span>
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 24, padding: '16px 0', borderTop: '1px solid #F1F5F9' }}>
              <div>
                <div style={G.statLabel}>Combustível</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#102A57' }}>{v.fuel_type || '—'}</div>
              </div>
              <div>
                <div style={G.statLabel}>Diária</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#102A57' }}>R$ {fmt(v.daily_rate)}</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 12 }}>
              <button style={{ ...G.btn(false), flex: 1, padding: '10px', justifyContent: 'center' }} onClick={() => handleEdit(v)}>
                <Edit size={16} />
              </button>
              <button style={{ ...G.btn(false), flex: 1, padding: '10px', justifyContent: 'center' }} onClick={() => { setSel(v); setShowFiles(true); loadPhotos(v.id); }}>
                <Camera size={16} />
              </button>
              <div style={{ display: 'flex', gap: 8, flex: 1 }}>
                {v.status === 'alugado' ? (
                  <button style={{ ...G.btn(false), flex: 1, padding: '10px', justifyContent: 'center', borderColor: '#10B981', color: '#10B981' }} onClick={() => { setSel(v); setShowIn(true); }}>
                    <ArrowDownRight size={16} />
                  </button>
                ) : (
                  <button style={{ ...G.btn(false), flex: 1, padding: '10px', justifyContent: 'center', borderColor: '#5B58EC', color: '#5B58EC' }} onClick={() => { setSel(v); setShowOut(true); }}>
                    <ArrowUpRight size={16} />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── MODAIS ── */}

      {/* NOVO / EDITAR VEÍCULO */}
      {(showAdd || showEdit) && (
        <div style={{ ...S.ovl, backdropFilter: 'blur(12px)' }} onClick={e => e.target === e.currentTarget && (setShowAdd(false) || setShowEdit(false))}>
          <div style={{ ...G.card, width: '100%', maxWidth: 600, padding: 40, border: 'none' }}>
            <h3 style={{ fontSize: 24, fontWeight: 900, color: '#102A57', marginBottom: 32, letterSpacing: '-1px' }}>
              {showEdit ? 'Editar Veículo' : 'Cadastrar na Frota'}
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={G.statLabel}>Placa (Identificador Único) *</label>
                <input placeholder="BRA2E19" style={{ ...S.inp, height: 48, borderRadius: 14, marginTop: 8 }} value={nv.plate} onChange={e => setNv(p => ({ ...p, plate: e.target.value.toUpperCase() }))} />
              </div>
              <div>
                <label style={G.statLabel}>Marca *</label>
                <input placeholder="Ex: Toyota" style={{ ...S.inp, height: 48, borderRadius: 14, marginTop: 8 }} value={nv.brand} onChange={e => setNv(p => ({ ...p, brand: e.target.value }))} />
              </div>
              <div>
                <label style={G.statLabel}>Modelo *</label>
                <input placeholder="Ex: Corolla" style={{ ...S.inp, height: 48, borderRadius: 14, marginTop: 8 }} value={nv.model} onChange={e => setNv(p => ({ ...p, model: e.target.value }))} />
              </div>
              <div>
                <label style={G.statLabel}>Ano</label>
                <input placeholder="2024" style={{ ...S.inp, height: 48, borderRadius: 14, marginTop: 8 }} value={nv.year} onChange={e => setNv(p => ({ ...p, year: e.target.value }))} />
              </div>
              <div>
                <label style={G.statLabel}>Cor</label>
                <input placeholder="Ex: Prata" style={{ ...S.inp, height: 48, borderRadius: 14, marginTop: 8 }} value={nv.color} onChange={e => setNv(p => ({ ...p, color: e.target.value }))} />
              </div>
              <div>
                <label style={G.statLabel}>KM Inicial</label>
                <input type="number" style={{ ...S.inp, height: 48, borderRadius: 14, marginTop: 8 }} value={nv.current_km} onChange={e => setNv(p => ({ ...p, current_km: Number(e.target.value) }))} />
              </div>
              <div>
                <label style={G.statLabel}>Diária (R$)</label>
                <input type="number" style={{ ...S.inp, height: 48, borderRadius: 14, marginTop: 8 }} value={nv.daily_rate} onChange={e => setNv(p => ({ ...p, daily_rate: Number(e.target.value) }))} />
              </div>
              <div>
                <label style={G.statLabel}>Câmbio</label>
                <select style={{ ...S.inp, height: 48, borderRadius: 14, marginTop: 8 }} value={nv.transmission} onChange={e => setNv(p => ({ ...p, transmission: e.target.value }))}>
                  <option value="Automático">Automático</option>
                  <option value="Manual">Manual</option>
                </select>
              </div>
              <div>
                <label style={G.statLabel}>Combustível</label>
                <select style={{ ...S.inp, height: 48, borderRadius: 14, marginTop: 8 }} value={nv.fuel_type} onChange={e => setNv(p => ({ ...p, fuel_type: e.target.value }))}>
                  <option value="Flex">Flex</option>
                  <option value="Gasolina">Gasolina</option>
                  <option value="Diesel">Diesel</option>
                  <option value="Elétrico">Elétrico</option>
                </select>
              </div>
              <div>
                <label style={G.statLabel}>Tipo</label>
                <select style={{ ...S.inp, height: 48, borderRadius: 14, marginTop: 8 }} value={nv.type} onChange={e => setNv(p => ({ ...p, type: e.target.value }))}>
                  <option value="carro">Carro</option>
                  <option value="moto">Moto</option>
                  <option value="utilitário">Utilitário</option>
                </select>
              </div>
              <div>
                <label style={G.statLabel}>Status Inicial</label>
                <select style={{ ...S.inp, height: 48, borderRadius: 14, marginTop: 8 }} value={nv.status} onChange={e => setNv(p => ({ ...p, status: e.target.value }))}>
                  <option value="disponível">Disponível</option>
                  <option value="manutenção">Manutenção</option>
                  <option value="indisponível">Indisponível</option>
                </select>
              </div>
              <div>
                <label style={G.statLabel}>Nível Combustível (%)</label>
                <input type="number" min="0" max="100" style={{ ...S.inp, height: 48, borderRadius: 14, marginTop: 8 }} value={nv.fuel_level} onChange={e => setNv(p => ({ ...p, fuel_level: Number(e.target.value) }))} />
              </div>
              <div>
                <label style={G.statLabel}>Condição dos Pneus</label>
                <select style={{ ...S.inp, height: 48, borderRadius: 14, marginTop: 8 }} value={nv.tire_condition} onChange={e => setNv(p => ({ ...p, tire_condition: e.target.value }))}>
                  <option value="novo">Novo</option>
                  <option value="bom">Bom</option>
                  <option value="meia vida">Meia vida</option>
                  <option value="troca necessaria">Troca necessária</option>
                </select>
              </div>
              <div>
                <label style={G.statLabel}>IPVA Vencimento</label>
                <input type="date" style={{ ...S.inp, height: 48, borderRadius: 14, marginTop: 8 }} value={nv.docs_ipva} onChange={e => setNv(p => ({ ...p, docs_ipva: e.target.value }))} />
              </div>
              <div>
                <label style={G.statLabel}>Seguro Vencimento</label>
                <input type="date" style={{ ...S.inp, height: 48, borderRadius: 14, marginTop: 8 }} value={nv.docs_seguro} onChange={e => setNv(p => ({ ...p, docs_seguro: e.target.value }))} />
              </div>
            </div>

            {error && <div style={{ color: '#EF4444', fontSize: 13, marginTop: 20, fontWeight: 700 }}>{error}</div>}

            <div style={{ display: 'flex', gap: 12, marginTop: 40 }}>
              <button style={{ ...G.btn(true), flex: 1, height: 52, justifyContent: 'center' }} onClick={handleSave} disabled={saving}>{saving ? 'SALVANDO...' : 'CONFIRMAR CADASTRO'}</button>
              <button style={{ ...G.btn(false), flex: 1, height: 52, justifyContent: 'center' }} onClick={() => { setShowAdd(false); setShowEdit(false); setNv(VEH_BLANK); }}>CANCELAR</button>
            </div>
          </div>
        </div>
      )}

      {/* GALERIA DE FOTOS */}
      {showFiles && (
        <div style={{ ...S.ovl, backdropFilter: 'blur(12px)' }} onClick={e => e.target === e.currentTarget && setShowFiles(false)}>
          <div style={{ ...G.card, width: '100%', maxWidth: 700, border: 'none' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
              <div>
                <h3 style={{ fontSize: 20, fontWeight: 900, color: '#102A57', margin: 0 }}>Docs & Fotos</h3>
                <p style={{ color: '#64748B', fontWeight: 600, fontSize: 14, marginTop: 4 }}>{sel?.brand} {sel?.model} · {sel?.plate}</p>
              </div>
              <button style={G.btn()} onClick={() => fileRef.current.click()} disabled={upl}>
                {upl ? 'ENVIANDO...' : <><Upload size={18} /> SUBIR ARQUIVO</>}
              </button>
              <input ref={fileRef} type="file" hidden onChange={e => handleUpload(e.target.files)} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 16 }}>
              {photos.map(p => {
                const url = supabase.storage.from(BUCKET).getPublicUrl(`${sel.id}/${p.name}`).data.publicUrl;
                return (
                  <div key={p.name} style={{ position: 'relative', borderRadius: 16, overflow: 'hidden', aspectRatio: '1/1', background: '#F8FAFB', border: '1px solid #F1F5F9' }}>
                    <img src={url} style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }} onClick={() => setLightbox(url)} />
                    <button
                      onClick={() => delPhoto(p.name)}
                      style={{ position: 'absolute', top: 8, right: 8, width: 32, height: 32, borderRadius: 10, background: 'rgba(239, 68, 68, 0.9)', color: '#FFF', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                );
              })}
              {photos.length === 0 && (
                <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '60px 0', background: '#F8FAFB', borderRadius: 24, border: '2px dashed #E2E8F0' }}>
                  <Camera size={40} color="#CBD5E1" style={{ marginBottom: 12 }} />
                  <p style={{ color: '#94A3B8', fontWeight: 700, fontSize: 13 }}>Nenhuma foto enviada ainda</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CHECK-IN / CHECK-OUT RAPID */}
      {(showIn || showOut) && (
        <div style={{ ...S.ovl, backdropFilter: 'blur(12px)' }} onClick={e => e.target === e.currentTarget && (setShowIn(false) || setShowOut(false))}>
          <div style={{ ...G.card, width: '100%', maxWidth: 680, padding: 40, textAlign: 'center', border: 'none' }}>
            <div style={{ width: 80, height: 80, borderRadius: 30, background: showIn ? '#F0FDF4' : '#F3F2FF', color: showIn ? '#10B981' : '#5B58EC', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
              {showIn ? <ArrowDownRight size={40} /> : <ArrowUpRight size={40} />}
            </div>
            <h3 style={{ fontSize: 24, fontWeight: 900, color: '#102A57', marginBottom: 12 }}>{showIn ? 'Check-in de Retorno' : 'Check-out de Saída'}</h3>
            <p style={{ color: '#64748B', fontWeight: 600, fontSize: 15, marginBottom: showIn ? 24 : 32 }}>Confirmar mudança de status para o veículo <strong>{sel?.plate}</strong>?</p>

            {showIn && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24, textAlign: 'left' }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 8 }}>KM Atual</label>
                  <input
                    type="number"
                    placeholder="Ex: 45000"
                    style={{ ...S.inp, height: 48, borderRadius: 14 }}
                    value={checkinData.km}
                    onChange={e => {
                      const val = e.target.value;
                      setCheckinData(p => ({ ...p, km: val }));
                      if (val && sel?.current_km) {
                        const novo = Number(val);
                        const atual = Number(sel.current_km);
                        if (novo < atual) setKmError(`KM inválido: não pode ser menor que ${atual.toLocaleString()} km atual`);
                        else setKmError(null);
                      } else {
                        setKmError(null);
                      }
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 8 }}>Combustível (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    placeholder="Ex: 80"
                    style={{ ...S.inp, height: 48, borderRadius: 14 }}
                    value={checkinData.fuel}
                    onChange={e => setCheckinData(p => ({ ...p, fuel: e.target.value }))}
                  />
                </div>
              </div>
            )}

            {showIn && (
              <div>
                {/* Fotos obrigatórias no retorno */}
                <div style={{ textAlign: 'left', marginTop: 20 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#102A57', marginBottom: 4 }}>
                    📸 Fotos obrigatórias ({Object.values(requiredPhotos).filter(Boolean).length}/4)
                  </div>
                  <div style={{ fontSize: 11, color: '#64748B', marginBottom: 12 }}>
                    Frente, Traseira, Lateral E e Lateral D são obrigatórias para confirmar o retorno.
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    {REQUIRED_PHOTO_KEYS.map(key => (
                      <div key={key} style={{ position: 'relative' }}>
                        <label style={{ fontSize: 10, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                          {REQUIRED_PHOTO_LABELS[key]} {requiredPhotos[key] ? '✅' : '*'}
                        </label>
                        {requiredPhotos[key] ? (
                          <div style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', height: 80 }}>
                            <img src={requiredPhotos[key]} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            <button onClick={() => setRequiredPhotos(p => ({ ...p, [key]: null }))}
                              style={{ position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 6, background: 'rgba(239,68,68,0.9)', color: '#FFF', border: 'none', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              ✕
                            </button>
                          </div>
                        ) : (
                          <label style={{ display: 'flex', height: 80, borderRadius: 10, border: '2px dashed #E2E8F0', background: '#F8FAFF', cursor: 'pointer', alignItems: 'center', justifyContent: 'center' }}>
                            {photoUploading === key ? (
                              <span style={{ fontSize: 11, color: '#94A3B8' }}>Enviando...</span>
                            ) : (
                              <span style={{ fontSize: 11, color: '#94A3B8' }}>+ Foto</span>
                            )}
                            <input type="file" accept="image/*" hidden
                              onChange={e => e.target.files?.[0] && handleRequiredPhotoUpload(e.target.files[0], key)} />
                          </label>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                {kmError && <div style={{ color: '#EF4444', fontSize: 12, fontWeight: 700, marginTop: 8, textAlign: 'left' }}>{kmError}</div>}
              </div>
            )}

            {showOut && (
              <div style={{ textAlign: 'left', marginTop: 24 }}>
                {/* Bateria */}
                <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: 16, marginBottom: 16 }}>
                  <h4 style={{ color: '#102A57', fontWeight: 800, fontSize: 14, marginBottom: 12 }}>🔋 Bateria (opcional mas recomendado)</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    {[
                      ['Nº de Série', 'serial', 'text', 'ex: 202408-MR60'],
                      ['Marca', 'brand', 'text', 'ex: Moura'],
                      ['Amperagem (Ah)', 'ah', 'number', 'ex: 60'],
                      ['Instalação', 'installedAt', 'date', ''],
                      ['Garantia até', 'warrantyUntil', 'date', ''],
                    ].map(([lbl, key, type, ph]) => (
                      <div key={key}>
                        <label style={{ fontSize: 10, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>{lbl}</label>
                        <input type={type} placeholder={ph} style={{ ...S.inp, height: 40, borderRadius: 10, fontSize: 13 }}
                          value={batteryData[key]} onChange={e => setBatteryData(p => ({ ...p, [key]: e.target.value }))} />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Pneus */}
                <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: 16 }}>
                  <h4 style={{ color: '#102A57', fontWeight: 800, fontSize: 14, marginBottom: 12 }}>🔴 Pneus — DOT / Série</h4>
                  {[
                    ['dianteiro_esq', '↖ Dianteiro Esq'],
                    ['dianteiro_dir', '↗ Dianteiro Dir'],
                    ['traseiro_esq', '↙ Traseiro Esq'],
                    ['traseiro_dir', '↘ Traseiro Dir'],
                    ['step', '🔧 Step'],
                  ].map(([pos, lbl]) => (
                    <div key={pos} style={{ background: '#F8FAFF', borderRadius: 10, padding: '10px 12px', marginBottom: 8 }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: '#5B58EC', marginBottom: 8 }}>{lbl}</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr', gap: 8 }}>
                        <div>
                          <label style={{ fontSize: 10, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>DOT / Série</label>
                          <input placeholder="U2LL LMLR 0823" style={{ ...S.inp, height: 36, borderRadius: 8, fontSize: 12 }}
                            value={tireData[pos].dot} onChange={e => setTireData(p => ({ ...p, [pos]: { ...p[pos], dot: e.target.value } }))} />
                        </div>
                        <div>
                          <label style={{ fontSize: 10, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Marca/Modelo</label>
                          <input placeholder="Pirelli P400" style={{ ...S.inp, height: 36, borderRadius: 8, fontSize: 12 }}
                            value={tireData[pos].brand} onChange={e => setTireData(p => ({ ...p, [pos]: { ...p[pos], brand: e.target.value } }))} />
                        </div>
                        <div>
                          <label style={{ fontSize: 10, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Estado</label>
                          <select style={{ ...S.inp, height: 36, borderRadius: 8, fontSize: 12 }}
                            value={tireData[pos].condition} onChange={e => setTireData(p => ({ ...p, [pos]: { ...p[pos], condition: e.target.value } }))}>
                            <option value="nova">Nova</option>
                            <option value="boa">Boa</option>
                            <option value="regular">Regular</option>
                            <option value="ruim">Ruim</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
              <button
                style={{ ...G.btn(true), flex: 1, height: 52, justifyContent: 'center', opacity: (saving || (showIn && (!!kmError || Object.values(requiredPhotos).some(p => !p)))) ? 0.5 : 1 }}
                onClick={() => handleIO(showIn ? 'in' : 'out', showIn ? 'disponível' : 'alugado')}
                disabled={saving || (showIn && (!!kmError || Object.values(requiredPhotos).some(p => !p)))}
              >
                {saving ? 'SALVANDO...' : 'CONFIRMAR'}
              </button>
              <button style={{ ...G.btn(false), flex: 1, height: 52, justifyContent: 'center' }} onClick={() => { setShowIn(false); setShowOut(false); setCheckinData({ km: '', fuel: '' }); }}>VOLTAR</button>
            </div>
          </div>
        </div>
      )}

      {/* LIGHTBOX */}
      {lightbox && (
        <div style={{ ...S.ovl, background: 'rgba(10, 42, 87, 0.95)', zIndex: 1000 }} onClick={() => setLightbox(null)}>
          <button style={{ position: 'absolute', top: 40, right: 40, background: 'none', border: 'none', color: '#FFF', cursor: 'pointer' }}>
            <X size={40} />
          </button>
          <img src={lightbox} style={{ maxWidth: '90%', maxHeight: '85vh', borderRadius: 20, boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }} />
        </div>
      )}

    </div>
  );
}
