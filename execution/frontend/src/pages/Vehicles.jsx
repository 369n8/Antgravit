import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Camera, ClipboardList, Trash2, ChevronLeft, ChevronRight, X, Plus, Car, LogOut } from 'lucide-react';

const STATUS_COLOR = {
  locado:      '#22c55e',
  disponível:  '#3b82f6',
  disponivel:  '#3b82f6',
  manutenção:  '#f59e0b',
  manutencao:  '#f59e0b',
  inadimplente:'#ef4444',
};

const TIRES = {
  'novo':             { d: '●●●●', c: '#4A5441' },
  'bom':              { d: '●●●○', c: '#4A5441' },
  'meia vida':        { d: '●●○○', c: '#7A5800' },
  'troca necessária': { d: '●○○○', c: '#7A3B3B' },
};

const BLANK = {
  type: 'car', brand: '', model: '', year: 2025,
  plate: '', color: '', km: 0, fuel_level: 100,
  tire_condition: 'novo', rent_weekly: 400, notes: '',
  docs_ipva: '', docs_seguro: '', docs_revisao: '',
};

const PASTEL = {
  '#22c55e': ['rgba(143,156,130,0.18)', '#4A5441'],
  '#ef4444': ['#E6C6C6',               '#7A3B3B'],
  '#f59e0b': ['#FFF0C2',               '#7A5800'],
  '#3b82f6': ['#DDEAF3',               '#2D5085'],
  '#6366f1': ['#ECEEFF',               '#3B3E9A'],
  '#64748b': ['#EBEBEB',               '#4B5563'],
};

const S = {
  card: { background: '#fff', borderRadius: 24, padding: 20, boxShadow: 'none', border: '1px solid #EBEBEB' },
  bdg:  c => {
    const [bg, text] = PASTEL[c] ?? ['#EBEBEB', '#4B5563'];
    return { display:'inline-flex', alignItems:'center', padding:'3px 10px', borderRadius:999, fontSize:11, fontWeight:600, background:bg, color:text, whiteSpace:'nowrap' };
  },
  btn:  (v = 'p') => ({
    padding: '10px 22px', borderRadius: 999, border: 'none',
    background: v==='p' ? '#FFC524' : v==='s' ? 'rgba(143,156,130,0.18)' : v==='d' ? '#E6C6C6' : '#F6F6F4',
    color: v==='p' ? '#111827' : v==='s' ? '#4A5441' : v==='d' ? '#7A3B3B' : '#374151',
    fontFamily: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
  }),
  inp:  { background: '#F6F6F4', border: 'none', borderRadius: 12, padding: '10px 14px', color: '#111827', fontFamily: 'inherit', fontSize: 13, width: '100%', outline: 'none', boxSizing: 'border-box' },
  lbl:  { fontSize: 11, color: '#9CA3AF', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 6, display: 'block', fontWeight: 600 },
  ovl:  { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.12)', backdropFilter: 'blur(20px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 16 },
  mbox: { background: '#fff', borderRadius: 28, padding: 32, width: '100%', maxWidth: 660, maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.08)', border: '1px solid #EBEBEB' },
};

const fuelBar = p => {
  const c = p > 60 ? '#8F9C82' : p > 30 ? '#C8A44A' : '#C07070';
  return (
    <div style={{ background: '#EBEBEB', borderRadius: 4, height: 6, overflow: 'hidden' }}>
      <div style={{ width: `${p}%`, height: '100%', background: c, transition: 'width .5s' }} />
    </div>
  );
};

const BUCKET         = 'vehicle-photos';
const CHECKIN_BUCKET = 'checkin-photos';

const FUEL_OPTS = [
  { l: 'Cheio',   v: 100 },
  { l: '3/4',     v: 75  },
  { l: 'Meio',    v: 50  },
  { l: '1/4',     v: 25  },
  { l: 'Reserva', v: 10  },
];

const CK_BLANK = { checkin_type: 'entrega', mileage: '', fuel_level: 100, notes: '' };
const CO_BLANK = { km_return: '', fuel_level: 100, notes: '' };

export default function Vehicles() {
  const [rows, setRows]           = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showAdd, setShowAdd]     = useState(false);
  const [nv, setNv]               = useState(BLANK);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState(null);
  const [photoVeh, setPhotoVeh]   = useState(null);
  const [uploading, setUploading] = useState(false);
  const [lightbox, setLightbox]   = useState(null);
  const [ckVeh, setCkVeh]         = useState(null);
  const [ck, setCk]               = useState(CK_BLANK);
  const [ckPhotos, setCkPhotos]   = useState([]);
  const [ckUploading, setCkUploading] = useState(false);
  const [ckSaving, setCkSaving]   = useState(false);
  const [ckMap, setCkMap]         = useState({});
  // Checkout state
  const [coVeh, setCoVeh]         = useState(null);
  const [co, setCo]               = useState(CO_BLANK);
  const [coPhotos, setCoPhotos]   = useState([]);
  const [coUploading, setCoUploading] = useState(false);
  const [coSaving, setCoSaving]   = useState(false);
  const [coSummary, setCoSummary] = useState(null); // { kmDriven, kmReturn }
  const fileRef                   = useRef();
  const ckFileRef                 = useRef();
  const coFileRef                 = useRef();

  const load = async () => {
    setLoading(true);
    const { data: vehs } = await supabase.from('vehicles').select('*').order('created_at', { ascending: false });
    setRows(vehs ?? []);
    if (vehs?.length) {
      const ids = vehs.map(v => v.id);
      const { data: cks } = await supabase
        .from('checkins')
        .select('vehicle_id, mileage, created_at')
        .in('vehicle_id', ids)
        .not('mileage', 'is', null)
        .order('created_at', { ascending: false })
        .limit(120);
      const map = {};
      for (const c of (cks ?? [])) {
        if (!map[c.vehicle_id]) map[c.vehicle_id] = [];
        if (map[c.vehicle_id].length < 3) map[c.vehicle_id].push(c);
      }
      setCkMap(map);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id, label) => {
    if (!window.confirm(`Excluir ${label}? Esta ação não pode ser desfeita.`)) return;
    await supabase.from('vehicles').delete().eq('id', id);
    setRows(r => r.filter(v => v.id !== id));
  };

  const handleAdd = async () => {
    setSaving(true); setError(null);
    const { data: { user } } = await supabase.auth.getUser();
    const { error: err } = await supabase.from('vehicles').insert({
      client_id:      user.id,
      type:           nv.type,
      brand:          nv.brand,
      model:          nv.model,
      year:           nv.year,
      plate:          nv.plate.toUpperCase(),
      color:          nv.color,
      km:             nv.km,
      fuel_level:     nv.fuel_level,
      tire_condition: nv.tire_condition,
      rent_weekly:    nv.rent_weekly,
      notes:          nv.notes,
      docs_ipva:      nv.docs_ipva || null,
      docs_seguro:    nv.docs_seguro || null,
      docs_revisao:   nv.docs_revisao || null,
      status:         'disponivel',
      photos:         [],
    });
    setSaving(false);
    if (err) { setError(err.message); return; }
    setShowAdd(false); setNv(BLANK); load();
  };

  const handleUpload = async (files) => {
    if (!photoVeh || !files.length) return;
    setUploading(true);
    const { data: { user } } = await supabase.auth.getUser();
    const currentPhotos = photoVeh.photos ?? [];
    const newPhotos = [...currentPhotos];
    for (const file of Array.from(files)) {
      const ext  = file.name.split('.').pop();
      const path = `${user.id}/${photoVeh.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false });
      if (upErr) { setError(upErr.message); continue; }
      const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path);
      newPhotos.push({ url: publicUrl, path, name: file.name });
    }
    await supabase.from('vehicles').update({ photos: newPhotos }).eq('id', photoVeh.id);
    const updated = { ...photoVeh, photos: newPhotos };
    setPhotoVeh(updated);
    setRows(r => r.map(v => v.id === photoVeh.id ? updated : v));
    setUploading(false);
  };

  const handleDeletePhoto = async (idx) => {
    const photos = [...(photoVeh.photos ?? [])];
    const [removed] = photos.splice(idx, 1);
    if (removed?.path) await supabase.storage.from(BUCKET).remove([removed.path]);
    await supabase.from('vehicles').update({ photos }).eq('id', photoVeh.id);
    const updated = { ...photoVeh, photos };
    setPhotoVeh(updated);
    setRows(r => r.map(v => v.id === photoVeh.id ? updated : v));
  };

  const handleCkUpload = async (files) => {
    if (!files?.length) return;
    setCkUploading(true);
    const { data: { user } } = await supabase.auth.getUser();
    const newPhotos = [...ckPhotos];
    for (const file of Array.from(files)) {
      const ext  = file.name.split('.').pop();
      const path = `${user.id}/checkins/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: upErr } = await supabase.storage.from(CHECKIN_BUCKET).upload(path, file);
      if (upErr) { setError(upErr.message); continue; }
      const { data: { publicUrl } } = supabase.storage.from(CHECKIN_BUCKET).getPublicUrl(path);
      newPhotos.push({ url: publicUrl, path });
    }
    setCkPhotos(newPhotos);
    setCkUploading(false);
  };

  const handleCoUpload = async (files) => {
    if (!files?.length) return;
    setCoUploading(true);
    const { data: { user } } = await supabase.auth.getUser();
    const newPhotos = [...coPhotos];
    for (const file of Array.from(files)) {
      const ext  = file.name.split('.').pop();
      const path = `${user.id}/checkins/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: upErr } = await supabase.storage.from(CHECKIN_BUCKET).upload(path, file);
      if (upErr) { setError(upErr.message); continue; }
      const { data: { publicUrl } } = supabase.storage.from(CHECKIN_BUCKET).getPublicUrl(path);
      newPhotos.push({ url: publicUrl, path });
    }
    setCoPhotos(newPhotos);
    setCoUploading(false);
  };

  const handleCheckin = async () => {
    if (!ckVeh) return;
    setCkSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error: err } = await supabase.from('checkins').insert({
      client_id:    user.id,
      vehicle_id:   ckVeh.id,
      checkin_type: ck.checkin_type,
      mileage:      ck.mileage ? Number(ck.mileage) : null,
      fuel_level:   ck.fuel_level,
      photos:       ckPhotos,
      notes:        ck.notes || null,
    });
    if (!err && ck.mileage) {
      await supabase.from('vehicles').update({
        km:         Number(ck.mileage),
        fuel_level: ck.fuel_level,
      }).eq('id', ckVeh.id);
      setRows(r => r.map(v => v.id === ckVeh.id ? { ...v, km: Number(ck.mileage), fuel_level: ck.fuel_level } : v));
    }
    setCkSaving(false);
    if (err) { setError(err.message); return; }
    setCkVeh(null); setCk(CK_BLANK); setCkPhotos([]); setError(null);
  };

  const handleCheckout = async () => {
    if (!coVeh) return;
    setCoSaving(true); setError(null);
    const { data: { user } } = await supabase.auth.getUser();
    const kmReturn = co.km_return ? Number(co.km_return) : null;
    const kmDriven = (kmReturn && coVeh.km != null && kmReturn > coVeh.km)
      ? kmReturn - coVeh.km
      : null;

    const { error: ckErr } = await supabase.from('checkins').insert({
      client_id:    user.id,
      vehicle_id:   coVeh.id,
      checkin_type: 'exit',
      mileage:      kmReturn,
      fuel_level:   co.fuel_level,
      photos:       coPhotos,
      notes:        co.notes || null,
    });

    if (ckErr) { setError(ckErr.message); setCoSaving(false); return; }

    await supabase.from('vehicles').update({
      status:    'disponivel',
      tenant_id: null,
      km:        kmReturn ?? coVeh.km,
      fuel_level: co.fuel_level,
    }).eq('id', coVeh.id);

    setRows(r => r.map(v => v.id === coVeh.id ? {
      ...v,
      status:    'disponivel',
      tenant_id: null,
      km:        kmReturn ?? v.km,
      fuel_level: co.fuel_level,
    } : v));

    setCoSaving(false);
    setCoSummary({ kmDriven, kmReturn });
    load();
  };

  if (loading) return <div className="loading"><div className="spinner" /> Carregando...</div>;

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
        <button style={S.btn()} onClick={() => setShowAdd(true)}>
          <Plus size={14} /> Novo Veículo
        </button>
      </div>

      {rows.length === 0 ? (
        <div style={{ ...S.card, textAlign: 'center', padding: '60px 20px', color: '#9CA3AF' }}>
          <Car size={40} style={{ margin: '0 auto 12px', color: '#D1D5DB' }} />
          <strong style={{ color: '#374151' }}>Nenhum veículo cadastrado</strong>
          <p style={{ marginTop: 8, fontSize: 13 }}>Clique em "Novo Veículo" para adicionar.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 15 }}>
          {rows.map(v => {
            const statusColor = STATUS_COLOR[v.status] ?? '#64748b';
            const tire  = TIRES[v.tire_condition] ?? TIRES['troca necessária'];
            const fuel  = v.fuel_level ?? 0;
            const photos = v.photos ?? [];
            const isAvailable = v.status === 'disponível' || v.status === 'disponivel';
            const isRented    = v.status === 'locado';
            return (
              <div key={v.id} style={{ ...S.card, overflow: 'hidden', padding: 0 }}>
                {photos.length > 0 ? (
                  <div onClick={() => setLightbox({ photos, idx: 0 })}
                    style={{ height: 130, overflow: 'hidden', position: 'relative', cursor: 'pointer' }}>
                    <img src={photos[0].url} alt="capa" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom,transparent 50%,rgba(0,0,0,0.2) 100%)' }} />
                    {photos.length > 1 && (
                      <div style={{ position: 'absolute', bottom: 8, right: 10, ...S.bdg('#6366f1') }}>{photos.length} fotos</div>
                    )}
                  </div>
                ) : (
                  <div style={{ height: 6, background: '#F6F6F4' }} />
                )}

                <div style={{ padding: '16px 20px 20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 9 }}>
                    <Car size={20} style={{ color: '#9CA3AF' }} />
                    <div style={S.bdg(statusColor)}>{v.status}</div>
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>{[v.brand, v.model].filter(Boolean).join(' ') || '—'}</div>
                  <div style={{ color: '#9CA3AF', fontSize: 12, marginBottom: 12 }}>
                    {v.year ?? '—'} · {v.plate ?? '—'} · {v.color ?? '—'}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7, marginBottom: 11 }}>
                    {[
                      [v.km != null ? `${(v.km / 1000).toFixed(0)}k` : '—', 'KM'],
                      [v.rent_weekly != null ? `R$${v.rent_weekly}` : '—', '/Sem'],
                    ].map(([val, lbl], i) => (
                      <div key={i} style={{ background: '#F6F6F4', borderRadius: 10, padding: '7px 5px', textAlign: 'center' }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{val}</div>
                        <div style={{ fontSize: 10, color: '#9CA3AF' }}>{lbl}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginBottom: 9 }}>
                    <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 4 }}>Combustível {fuel}%</div>
                    {fuelBar(fuel)}
                  </div>
                  <div style={{ fontSize: 12, color: tire.c, marginBottom: 12, fontWeight: 500 }}>
                    {tire.d} {v.tire_condition}
                  </div>

                  {ckMap[v.id]?.length > 0 && (
                    <div style={{ background: '#F6F6F4', borderRadius: 10, padding: '7px 10px', marginBottom: 12 }}>
                      <div style={{ fontSize: 10, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 5 }}>Histórico KM</div>
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                        {ckMap[v.id].map((c, i) => (
                          <span key={i} style={{ fontSize: 11, fontWeight: 700, color: i === 0 ? '#111827' : '#6B7280', background: i === 0 ? '#FFC524' : '#E8E8E6', borderRadius: 8, padding: '2px 8px' }}>
                            {c.mileage >= 1000 ? `${(c.mileage / 1000).toFixed(0)}k` : c.mileage} km
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 7, borderTop: '1px solid #F6F6F4', paddingTop: 12 }}>
                    {isAvailable && (
                      <button
                        style={{ ...S.btn('s'), flex: 1, justifyContent: 'center', padding: '7px 10px', fontSize: 12 }}
                        onClick={() => { setCkVeh(v); setCk(CK_BLANK); setCkPhotos([]); setError(null); }}
                      >
                        <ClipboardList size={13} /> Check-in
                      </button>
                    )}
                    {isRented && (
                      <button
                        style={{ ...S.btn('p'), flex: 1, justifyContent: 'center', padding: '7px 10px', fontSize: 12 }}
                        onClick={() => { setCoVeh(v); setCo(CO_BLANK); setCoPhotos([]); setCoSummary(null); setError(null); }}
                      >
                        <LogOut size={13} /> Check-out
                      </button>
                    )}
                    <button
                      style={{ ...S.btn('g'), padding: '7px 10px', fontSize: 12 }}
                      onClick={() => { setPhotoVeh(v); setError(null); }}
                    >
                      <Camera size={13} /> {photos.length > 0 ? photos.length : ''}
                    </button>
                    <button
                      style={{ ...S.btn('d'), padding: '7px 12px', fontSize: 12 }}
                      onClick={() => handleDelete(v.id, `${v.brand} ${v.model} ${v.plate}`)}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Check-in */}
      {ckVeh && (
        <div style={S.ovl} onClick={e => { if (e.target === e.currentTarget) { setCkVeh(null); setError(null); } }}>
          <div style={{ ...S.mbox, maxWidth: 500 }}>
            <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 4, color: '#111827' }}>Check-in — {ckVeh.brand} {ckVeh.model}</div>
            <div style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 18 }}>{ckVeh.plate}</div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              {[['entrega','Entrega'],['devolucao','Devolução']].map(([v,l]) => (
                <button key={v} style={{ ...S.btn(ck.checkin_type === v ? 'p' : 'g'), flex: 1, justifyContent: 'center' }}
                  onClick={() => setCk(p => ({ ...p, checkin_type: v }))}>{l}</button>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
              <div>
                <label style={S.lbl}>KM Atual</label>
                <input style={S.inp} type="number" placeholder={ckVeh.km ?? 0} value={ck.mileage}
                  onChange={e => setCk(p => ({ ...p, mileage: e.target.value }))} />
              </div>
              <div>
                <label style={S.lbl}>Combustível</label>
                <select style={S.inp} value={ck.fuel_level} onChange={e => setCk(p => ({ ...p, fuel_level: Number(e.target.value) }))}>
                  {FUEL_OPTS.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={S.lbl}>Obs</label>
                <input style={S.inp} placeholder="Riscos, amassados, ocorrências..." value={ck.notes}
                  onChange={e => setCk(p => ({ ...p, notes: e.target.value }))} />
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <label style={S.lbl}>Fotos do Check-in</label>
                <button style={{ ...S.btn('p'), padding: '5px 12px', fontSize: 11 }}
                  onClick={() => ckFileRef.current.click()} disabled={ckUploading}>
                  {ckUploading ? 'Enviando...' : '+ Fotos'}
                </button>
              </div>
              <input ref={ckFileRef} type="file" accept="image/*" multiple hidden
                onChange={e => handleCkUpload(e.target.files)} />
              {ckPhotos.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(90px,1fr))', gap: 7 }}>
                  {ckPhotos.map((p, i) => (
                    <div key={i} style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', aspectRatio: '4/3', background: '#F6F6F4' }}>
                      <img src={p.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <button onClick={() => setCkPhotos(ph => ph.filter((_,j) => j !== i))}
                        style={{ position: 'absolute', top: 3, right: 3, background: 'rgba(0,0,0,.5)', border: 'none', color: '#fff', borderRadius: 5, width: 22, height: 22, cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div onClick={() => ckFileRef.current.click()}
                  style={{ border: '1.5px dashed #E8E8E6', borderRadius: 12, padding: '20px', textAlign: 'center', color: '#9CA3AF', cursor: 'pointer', fontSize: 12, background: '#F6F6F4' }}>
                  Clique para adicionar fotos
                </div>
              )}
            </div>

            {error && <div style={{ color: '#7A3B3B', fontSize: 13, marginBottom: 10 }}>{error}</div>}
            <div style={{ display: 'flex', gap: 9 }}>
              <button style={S.btn('s')} onClick={handleCheckin} disabled={ckSaving}>
                {ckSaving ? 'Salvando...' : 'Registrar Check-in'}
              </button>
              <button style={S.btn('g')} onClick={() => { setCkVeh(null); setError(null); }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Check-out */}
      {coVeh && (
        <div style={S.ovl} onClick={e => { if (e.target === e.currentTarget && !coSummary) { setCoVeh(null); setError(null); } }}>
          <div style={{ ...S.mbox, maxWidth: 500 }}>
            {coSummary ? (
              /* Resumo pós-devolução */
              <div style={{ textAlign: 'center', padding: '8px 0 4px' }}>
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(143,156,130,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                  <LogOut size={24} style={{ color: '#4A5441' }} />
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#111827', marginBottom: 6 }}>Devolução registrada!</div>
                <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 24 }}>
                  {coVeh.brand} {coVeh.model} · {coVeh.plate}
                </div>
                {coSummary.kmDriven != null && (
                  <div style={{ background: '#F6F6F4', borderRadius: 16, padding: '16px 20px', marginBottom: 16 }}>
                    <div style={{ fontSize: 11, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6 }}>
                      Total de KM nesta locação
                    </div>
                    <div style={{ fontSize: 36, fontWeight: 700, color: '#111827', letterSpacing: '-2px' }}>
                      {coSummary.kmDriven.toLocaleString('pt-BR')}
                    </div>
                    <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>km rodados</div>
                  </div>
                )}
                {coSummary.kmReturn != null && (
                  <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 20 }}>
                    KM final: <strong style={{ color: '#111827' }}>{coSummary.kmReturn.toLocaleString('pt-BR')} km</strong>
                  </div>
                )}
                <div style={{ background: 'rgba(143,156,130,0.12)', borderRadius: 12, padding: '10px 14px', fontSize: 12, color: '#4A5441', marginBottom: 20, textAlign: 'left' }}>
                  Veículo marcado como <strong>disponível</strong> e locatário desvinculado automaticamente.
                </div>
                <button style={{ ...S.btn('p'), justifyContent: 'center', width: '100%' }}
                  onClick={() => { setCoVeh(null); setCoSummary(null); }}>
                  Fechar
                </button>
              </div>
            ) : (
              /* Formulário de devolução */
              <>
                <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 4, color: '#111827' }}>Check-out — {coVeh.brand} {coVeh.model}</div>
                <div style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 18 }}>{coVeh.plate}</div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                  <div>
                    <label style={S.lbl}>KM de Devolução</label>
                    <input style={S.inp} type="number" placeholder={coVeh.km ?? 0} value={co.km_return}
                      onChange={e => setCo(p => ({ ...p, km_return: e.target.value }))} />
                    {coVeh.km != null && (
                      <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>Atual: {coVeh.km.toLocaleString('pt-BR')} km</div>
                    )}
                  </div>
                  <div>
                    <label style={S.lbl}>Combustível</label>
                    <select style={S.inp} value={co.fuel_level} onChange={e => setCo(p => ({ ...p, fuel_level: Number(e.target.value) }))}>
                      {FUEL_OPTS.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                    </select>
                  </div>
                  <div style={{ gridColumn: '1/-1' }}>
                    <label style={S.lbl}>Obs</label>
                    <input style={S.inp} placeholder="Avarias, ocorrências na devolução..." value={co.notes}
                      onChange={e => setCo(p => ({ ...p, notes: e.target.value }))} />
                  </div>
                </div>

                <div style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <label style={S.lbl}>Fotos da Devolução</label>
                    <button style={{ ...S.btn('p'), padding: '5px 12px', fontSize: 11 }}
                      onClick={() => coFileRef.current.click()} disabled={coUploading}>
                      {coUploading ? 'Enviando...' : '+ Fotos'}
                    </button>
                  </div>
                  <input ref={coFileRef} type="file" accept="image/*" multiple hidden
                    onChange={e => handleCoUpload(e.target.files)} />
                  {coPhotos.length > 0 ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(90px,1fr))', gap: 7 }}>
                      {coPhotos.map((p, i) => (
                        <div key={i} style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', aspectRatio: '4/3', background: '#F6F6F4' }}>
                          <img src={p.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          <button onClick={() => setCoPhotos(ph => ph.filter((_,j) => j !== i))}
                            style={{ position: 'absolute', top: 3, right: 3, background: 'rgba(0,0,0,.5)', border: 'none', color: '#fff', borderRadius: 5, width: 22, height: 22, cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <X size={10} />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div onClick={() => coFileRef.current.click()}
                      style={{ border: '1.5px dashed #E8E8E6', borderRadius: 12, padding: '20px', textAlign: 'center', color: '#9CA3AF', cursor: 'pointer', fontSize: 12, background: '#F6F6F4' }}>
                      Clique para adicionar fotos da devolução
                    </div>
                  )}
                </div>

                {error && <div style={{ color: '#7A3B3B', fontSize: 13, marginBottom: 10 }}>{error}</div>}
                <div style={{ display: 'flex', gap: 9 }}>
                  <button style={S.btn('p')} onClick={handleCheckout} disabled={coSaving}>
                    <LogOut size={14} /> {coSaving ? 'Registrando...' : 'Confirmar Devolução'}
                  </button>
                  <button style={S.btn('g')} onClick={() => { setCoVeh(null); setError(null); }}>Cancelar</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Modal Fotos */}
      {photoVeh && (
        <div style={S.ovl} onClick={e => { if (e.target === e.currentTarget) { setPhotoVeh(null); setError(null); } }}>
          <div style={S.mbox}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 17, fontWeight: 700, color: '#111827' }}>Fotos — {photoVeh.brand} {photoVeh.model}</div>
                <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>{photoVeh.plate}</div>
              </div>
              <button style={{ ...S.btn('p'), padding: '8px 14px', fontSize: 12 }}
                onClick={() => fileRef.current.click()} disabled={uploading}>
                {uploading ? 'Enviando...' : '+ Adicionar'}
              </button>
            </div>

            <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={e => handleUpload(e.target.files)} />

            {error && <div style={{ color: '#7A3B3B', fontSize: 13, marginBottom: 10 }}>{error}</div>}

            {(photoVeh.photos ?? []).length === 0 ? (
              <div style={{ border: '1.5px dashed #E8E8E6', borderRadius: 16, padding: '40px 20px', textAlign: 'center', color: '#9CA3AF', cursor: 'pointer', background: '#F6F6F4' }}
                onClick={() => fileRef.current.click()}>
                <Camera size={36} style={{ margin: '0 auto 8px', color: '#D1D5DB' }} />
                <div>Nenhuma foto ainda</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>Clique para adicionar fotos do veículo</div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: 10 }}>
                {(photoVeh.photos ?? []).map((p, i) => (
                  <div key={i} style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', aspectRatio: '4/3', background: '#F6F6F4' }}>
                    <img src={p.url} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }}
                      onClick={() => setLightbox({ photos: photoVeh.photos, idx: i })} />
                    <button onClick={() => handleDeletePhoto(i)}
                      style={{ position: 'absolute', top: 5, right: 5, background: 'rgba(0,0,0,.55)', border: 'none', color: '#fff', borderRadius: 6, width: 26, height: 26, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <X size={12} />
                    </button>
                  </div>
                ))}
                <div onClick={() => fileRef.current.click()}
                  style={{ borderRadius: 12, border: '1.5px dashed #E8E8E6', aspectRatio: '4/3', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#9CA3AF', fontSize: 24, background: '#F6F6F4' }}>
                  <Plus size={20} />
                </div>
              </div>
            )}

            <div style={{ marginTop: 16, textAlign: 'right' }}>
              <button style={{ ...S.btn('g'), display: 'inline-flex' }} onClick={() => { setPhotoVeh(null); setError(null); }}>Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.95)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setLightbox(null)}>
          <button onClick={e => { e.stopPropagation(); setLightbox(l => ({ ...l, idx: Math.max(0, l.idx - 1) })); }}
            style={{ position: 'absolute', left: 20, background: 'rgba(255,255,255,.15)', border: 'none', color: '#fff', width: 44, height: 44, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ChevronLeft size={22} />
          </button>
          <img src={lightbox.photos[lightbox.idx]?.url} alt="" onClick={e => e.stopPropagation()}
            style={{ maxWidth: '90vw', maxHeight: '88vh', objectFit: 'contain', borderRadius: 10 }} />
          <button onClick={e => { e.stopPropagation(); setLightbox(l => ({ ...l, idx: Math.min(l.photos.length - 1, l.idx + 1) })); }}
            style={{ position: 'absolute', right: 20, background: 'rgba(255,255,255,.15)', border: 'none', color: '#fff', width: 44, height: 44, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ChevronRight size={22} />
          </button>
          <button onClick={() => setLightbox(null)}
            style={{ position: 'absolute', top: 18, right: 18, background: 'rgba(255,255,255,.15)', border: 'none', color: '#fff', width: 38, height: 38, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={16} />
          </button>
          {lightbox.photos.length > 1 && (
            <div style={{ position: 'absolute', bottom: 18, color: 'rgba(255,255,255,.6)', fontSize: 13 }}>
              {lightbox.idx + 1} / {lightbox.photos.length}
            </div>
          )}
        </div>
      )}

      {/* Modal Novo Veículo */}
      {showAdd && (
        <div style={S.ovl} onClick={e => { if (e.target === e.currentTarget) setShowAdd(false); }}>
          <div style={S.mbox}>
            <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 16, color: '#111827' }}>Novo Veículo</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={S.lbl}>Tipo</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {['car', 'moto'].map(t => (
                    <button key={t} style={{ ...S.btn(nv.type === t ? 'p' : 'g'), flex: 1, justifyContent: 'center' }}
                      onClick={() => setNv(v => ({ ...v, type: t }))}>
                      {t === 'car' ? 'Carro' : 'Moto'}
                    </button>
                  ))}
                </div>
              </div>
              {[['brand','Marca','Volkswagen'],['model','Modelo','Voyage'],['plate','Placa','BRA2E25'],['color','Cor','Branco']].map(([k,l,p]) => (
                <div key={k}>
                  <label style={S.lbl}>{l}</label>
                  <input style={S.inp} placeholder={p} value={nv[k]} onChange={e => setNv(v => ({ ...v, [k]: e.target.value }))} />
                </div>
              ))}
              <div><label style={S.lbl}>Ano</label><input style={S.inp} type="number" value={nv.year} onChange={e => setNv(v => ({ ...v, year: Number(e.target.value) }))} /></div>
              <div><label style={S.lbl}>KM</label><input style={S.inp} type="number" value={nv.km} onChange={e => setNv(v => ({ ...v, km: Number(e.target.value) }))} /></div>
              <div><label style={S.lbl}>Aluguel/Semana R$</label><input style={S.inp} type="number" value={nv.rent_weekly} onChange={e => setNv(v => ({ ...v, rent_weekly: Number(e.target.value) }))} /></div>
              <div>
                <label style={S.lbl}>Pneus</label>
                <select style={S.inp} value={nv.tire_condition} onChange={e => setNv(v => ({ ...v, tire_condition: e.target.value }))}>
                  {['novo','bom','meia vida','troca necessária'].map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
              <div><label style={S.lbl}>IPVA vence</label><input style={S.inp} type="date" value={nv.docs_ipva} onChange={e => setNv(v => ({ ...v, docs_ipva: e.target.value }))} /></div>
              <div><label style={S.lbl}>Seguro vence</label><input style={S.inp} type="date" value={nv.docs_seguro} onChange={e => setNv(v => ({ ...v, docs_seguro: e.target.value }))} /></div>
              <div><label style={S.lbl}>Revisão</label><input style={S.inp} type="date" value={nv.docs_revisao} onChange={e => setNv(v => ({ ...v, docs_revisao: e.target.value }))} /></div>
              <div style={{ gridColumn: '1/-1' }}><label style={S.lbl}>Obs</label><textarea style={{ ...S.inp, minHeight: 50, resize: 'vertical' }} value={nv.notes} onChange={e => setNv(v => ({ ...v, notes: e.target.value }))} /></div>
            </div>
            {error && <div style={{ color: '#7A3B3B', fontSize: 13, marginBottom: 10 }}>{error}</div>}
            <div style={{ display: 'flex', gap: 9 }}>
              <button style={S.btn('s')} onClick={handleAdd} disabled={saving}>{saving ? 'Salvando...' : 'Cadastrar'}</button>
              <button style={S.btn('g')} onClick={() => { setShowAdd(false); setError(null); }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
