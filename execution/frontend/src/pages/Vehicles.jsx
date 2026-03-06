import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const STATUS_COLOR = {
  locado:      "#22c55e",
  disponível:  "#3b82f6",
  disponivel:  "#3b82f6",
  manutenção:  "#f59e0b",
  manutencao:  "#f59e0b",
  inadimplente:"#ef4444",
};

const TIRES = {
  "novo":             { d: "●●●●", c: "#22c55e" },
  "bom":              { d: "●●●○", c: "#22c55e" },
  "meia vida":        { d: "●●○○", c: "#f59e0b" },
  "troca necessária": { d: "●○○○", c: "#ef4444" },
};

const BLANK = {
  type: "car", brand: "", model: "", year: 2025,
  plate: "", color: "", km: 0, fuel_level: 100,
  tire_condition: "novo", rent_weekly: 400, notes: "",
  docs_ipva: "", docs_seguro: "", docs_revisao: "",
};

const S = {
  card: { background: "linear-gradient(135deg,#0f172a,#1e293b)", border: "1px solid #334155", borderRadius: 16, padding: 20 },
  bdg:  c => ({ display: "inline-flex", alignItems: "center", padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: `${c}20`, color: c, border: `1px solid ${c}40`, letterSpacing: ".05em", textTransform: "uppercase", whiteSpace: "nowrap" }),
  btn:  (v = "p") => ({ padding: "9px 17px", borderRadius: 10, border: "none", background: v === "p" ? "linear-gradient(135deg,#6366f1,#8b5cf6)" : v === "s" ? "linear-gradient(135deg,#22c55e,#16a34a)" : v === "d" ? "linear-gradient(135deg,#ef4444,#dc2626)" : "#1e293b", color: "#fff", fontFamily: "inherit", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }),
  inp:  { background: "#0a0f1e", border: "1px solid #334155", borderRadius: 8, padding: "9px 12px", color: "#e2e8f0", fontFamily: "inherit", fontSize: 13, width: "100%", outline: "none", boxSizing: "border-box" },
  lbl:  { fontSize: 11, color: "#64748b", letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 5, display: "block" },
  ovl:  { position: "fixed", inset: 0, background: "rgba(0,0,0,.92)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 16 },
  mbox: { background: "#0f172a", border: "1px solid #334155", borderRadius: 20, padding: 24, width: "100%", maxWidth: 660, maxHeight: "92vh", overflowY: "auto" },
};

const fuelBar = p => {
  const c = p > 60 ? "#22c55e" : p > 30 ? "#f59e0b" : "#ef4444";
  return (
    <div style={{ background: "#1e293b", borderRadius: 4, height: 8, overflow: "hidden" }}>
      <div style={{ width: `${p}%`, height: "100%", background: c, transition: "width .5s" }} />
    </div>
  );
};

const BUCKET         = 'vehicle-photos';
const CHECKIN_BUCKET = 'checkin-photos';

const CK_BLANK = { checkin_type: 'entrega', mileage: '', fuel_level: 100, notes: '' };

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
  const [ckVeh, setCkVeh]         = useState(null);  // veículo em check-in
  const [ck, setCk]               = useState(CK_BLANK);
  const [ckPhotos, setCkPhotos]   = useState([]);    // fotos do checkin
  const [ckUploading, setCkUploading] = useState(false);
  const [ckSaving, setCkSaving]   = useState(false);
  const fileRef                   = useRef();
  const ckFileRef                 = useRef();

  const load = () => {
    setLoading(true);
    supabase.from('vehicles').select('*').order('created_at', { ascending: false })
      .then(({ data }) => { setRows(data ?? []); setLoading(false); });
  };

  useEffect(() => { load(); }, []);

  /* ── DELETE ── */
  const handleDelete = async (id, label) => {
    if (!window.confirm(`Excluir ${label}? Esta ação não pode ser desfeita.`)) return;
    await supabase.from('vehicles').delete().eq('id', id);
    setRows(r => r.filter(v => v.id !== id));
  };

  /* ── ADD ── */
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

  /* ── UPLOAD FOTO ── */
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

  /* ── DELETE FOTO ── */
  const handleDeletePhoto = async (idx) => {
    const photos = [...(photoVeh.photos ?? [])];
    const [removed] = photos.splice(idx, 1);
    if (removed?.path) await supabase.storage.from(BUCKET).remove([removed.path]);
    await supabase.from('vehicles').update({ photos }).eq('id', photoVeh.id);
    const updated = { ...photoVeh, photos };
    setPhotoVeh(updated);
    setRows(r => r.map(v => v.id === photoVeh.id ? updated : v));
  };

  /* ── UPLOAD FOTO CHECK-IN ── */
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

  /* ── SALVAR CHECK-IN ── */
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

  if (loading) return <div className="loading"><div className="spinner" /> Carregando...</div>;

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>🚗 Frota</div>
        <button style={S.btn()} onClick={() => setShowAdd(true)}>+ Novo Veículo</button>
      </div>

      {/* Cards */}
      {rows.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", color: "#64748b" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🚗</div>
          <strong>Nenhum veículo cadastrado</strong>
          <p style={{ marginTop: 8, fontSize: 13 }}>Clique em "+ Novo Veículo" para adicionar.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 15 }}>
          {rows.map(v => {
            const statusColor = STATUS_COLOR[v.status] ?? "#64748b";
            const tire  = TIRES[v.tire_condition] ?? TIRES["troca necessária"];
            const fuel  = v.fuel_level ?? 0;
            const photos = v.photos ?? [];
            return (
              <div key={v.id} style={{ ...S.card, border: `1px solid #334155`, overflow: "hidden" }}>
                {/* Capa de foto */}
                {photos.length > 0 && (
                  <div
                    onClick={() => setLightbox({ photos, idx: 0 })}
                    style={{ margin: "-20px -20px 14px -20px", height: 130, overflow: "hidden", position: "relative", cursor: "pointer" }}
                  >
                    <img src={photos[0].url} alt="capa" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom,transparent 40%,#0f172a 100%)" }} />
                    {photos.length > 1 && (
                      <div style={{ position: "absolute", bottom: 8, right: 10, ...S.bdg("#6366f1") }}>📷 {photos.length}</div>
                    )}
                  </div>
                )}

                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 9 }}>
                  <span style={{ fontSize: 24 }}>{v.type === "moto" ? "🏍️" : "🚗"}</span>
                  <div style={S.bdg(statusColor)}>{v.status}</div>
                </div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{[v.brand, v.model].filter(Boolean).join(' ') || '—'}</div>
                <div style={{ color: "#64748b", fontSize: 12, marginBottom: 12 }}>
                  {v.year ?? '—'} • {v.plate ?? '—'} • {v.color ?? '—'}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7, marginBottom: 11 }}>
                  {[
                    [v.km != null ? `${(v.km / 1000).toFixed(0)}k` : "—", "KM", "#e2e8f0"],
                    [v.rent_weekly != null ? `R$${v.rent_weekly}` : "—", "/Sem", "#6366f1"],
                  ].map(([val, lbl, color], i) => (
                    <div key={i} style={{ background: "#080d1a", borderRadius: 8, padding: "7px 5px", textAlign: "center" }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color }}>{val}</div>
                      <div style={{ fontSize: 10, color: "#64748b" }}>{lbl}</div>
                    </div>
                  ))}
                </div>
                <div style={{ marginBottom: 9 }}>
                  <div style={{ fontSize: 11, color: "#64748b", marginBottom: 3 }}>Combustível {fuel}%</div>
                  {fuelBar(fuel)}
                </div>
                <div style={{ fontSize: 13, color: TIRES[v.tire_condition]?.c ?? "#64748b", marginBottom: 12 }}>
                  {tire.d} {v.tire_condition}
                </div>

                {/* Ações */}
                <div style={{ display: "flex", gap: 7, borderTop: "1px solid #1e293b", paddingTop: 12 }}>
                  <button
                    style={{ ...S.btn("s"), flex: 1, justifyContent: "center", padding: "7px 10px", fontSize: 12 }}
                    onClick={() => { setCkVeh(v); setCk(CK_BLANK); setCkPhotos([]); setError(null); }}
                  >
                    📋 Check-in
                  </button>
                  <button
                    style={{ ...S.btn("p"), padding: "7px 10px", fontSize: 12 }}
                    onClick={() => { setPhotoVeh(v); setError(null); }}
                  >
                    📷 {photos.length > 0 ? photos.length : ''}
                  </button>
                  <button
                    style={{ ...S.btn("d"), padding: "7px 12px", fontSize: 12 }}
                    onClick={() => handleDelete(v.id, `${v.brand} ${v.model} ${v.plate}`)}
                  >
                    🗑
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Modal Check-in ── */}
      {ckVeh && (
        <div style={S.ovl} onClick={e => { if (e.target === e.currentTarget) { setCkVeh(null); setError(null); } }}>
          <div style={{ ...S.mbox, maxWidth: 500 }}>
            <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>📋 Check-in — {ckVeh.brand} {ckVeh.model}</div>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 18 }}>{ckVeh.plate}</div>

            {/* Tipo */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              {[['entrega','🚗 Entrega'],['devolucao','🔑 Devolução']].map(([v,l]) => (
                <button key={v} style={{ ...S.btn(ck.checkin_type === v ? 's' : 'g'), flex: 1, justifyContent: 'center' }}
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
                <label style={S.lbl}>Combustível {ck.fuel_level}%</label>
                <input style={{ ...S.inp, padding: '11px 12px', cursor: 'pointer' }} type="range" min={0} max={100} step={5}
                  value={ck.fuel_level} onChange={e => setCk(p => ({ ...p, fuel_level: Number(e.target.value) }))} />
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={S.lbl}>Obs</label>
                <input style={S.inp} placeholder="Riscos, amassados, ocorrências..." value={ck.notes}
                  onChange={e => setCk(p => ({ ...p, notes: e.target.value }))} />
              </div>
            </div>

            {/* Fotos do check-in */}
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
                    <div key={i} style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', aspectRatio: '4/3', background: '#080d1a' }}>
                      <img src={p.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <button onClick={() => setCkPhotos(ph => ph.filter((_,j) => j !== i))}
                        style={{ position: 'absolute', top: 3, right: 3, background: 'rgba(0,0,0,.7)', border: 'none', color: '#ef4444', borderRadius: 5, width: 22, height: 22, cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                    </div>
                  ))}
                </div>
              ) : (
                <div onClick={() => ckFileRef.current.click()}
                  style={{ border: '2px dashed #334155', borderRadius: 10, padding: '20px', textAlign: 'center', color: '#64748b', cursor: 'pointer', fontSize: 12 }}>
                  📷 Clique para adicionar fotos
                </div>
              )}
            </div>

            {error && <div style={{ color: '#ef4444', fontSize: 13, marginBottom: 10 }}>⚠ {error}</div>}
            <div style={{ display: 'flex', gap: 9 }}>
              <button style={S.btn('s')} onClick={handleCheckin} disabled={ckSaving}>
                {ckSaving ? 'Salvando...' : '✅ Registrar Check-in'}
              </button>
              <button style={S.btn('g')} onClick={() => { setCkVeh(null); setError(null); }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Fotos ── */}
      {photoVeh && (
        <div style={S.ovl} onClick={e => { if (e.target === e.currentTarget) { setPhotoVeh(null); setError(null); } }}>
          <div style={S.mbox}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 17, fontWeight: 700 }}>📷 Fotos — {photoVeh.brand} {photoVeh.model}</div>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{photoVeh.plate} • Entrega / Devolução</div>
              </div>
              <button style={{ ...S.btn("p"), padding: "8px 14px", fontSize: 12 }}
                onClick={() => fileRef.current.click()} disabled={uploading}>
                {uploading ? "Enviando..." : "+ Adicionar"}
              </button>
            </div>

            <input
              ref={fileRef} type="file" accept="image/*" multiple hidden
              onChange={e => handleUpload(e.target.files)}
            />

            {error && <div style={{ color: "#ef4444", fontSize: 13, marginBottom: 10 }}>⚠ {error}</div>}

            {(photoVeh.photos ?? []).length === 0 ? (
              <div
                style={{ border: "2px dashed #334155", borderRadius: 12, padding: "40px 20px", textAlign: "center", color: "#64748b", cursor: "pointer" }}
                onClick={() => fileRef.current.click()}
              >
                <div style={{ fontSize: 36, marginBottom: 8 }}>📷</div>
                <div>Nenhuma foto ainda</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>Clique para adicionar fotos do veículo</div>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(140px,1fr))", gap: 10 }}>
                {(photoVeh.photos ?? []).map((p, i) => (
                  <div key={i} style={{ position: "relative", borderRadius: 10, overflow: "hidden", aspectRatio: "4/3", background: "#080d1a" }}>
                    <img
                      src={p.url} alt={p.name}
                      style={{ width: "100%", height: "100%", objectFit: "cover", cursor: "pointer" }}
                      onClick={() => setLightbox({ photos: photoVeh.photos, idx: i })}
                    />
                    <button
                      onClick={() => handleDeletePhoto(i)}
                      style={{ position: "absolute", top: 5, right: 5, background: "rgba(0,0,0,.7)", border: "none", color: "#ef4444", borderRadius: 6, width: 26, height: 26, cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center" }}
                    >✕</button>
                  </div>
                ))}
                {/* Drop zone adicional */}
                <div
                  onClick={() => fileRef.current.click()}
                  style={{ borderRadius: 10, border: "2px dashed #334155", aspectRatio: "4/3", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#64748b", fontSize: 24, background: "#080d1a" }}
                >+</div>
              </div>
            )}

            <div style={{ marginTop: 16, textAlign: "right" }}>
              <button style={{ ...S.btn("g"), display: "inline-flex" }} onClick={() => { setPhotoVeh(null); setError(null); }}>Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Lightbox ── */}
      {lightbox && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.97)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => setLightbox(null)}
        >
          <button onClick={e => { e.stopPropagation(); setLightbox(l => ({ ...l, idx: Math.max(0, l.idx - 1) })); }}
            style={{ position: "absolute", left: 20, background: "#334155", border: "none", color: "#fff", width: 44, height: 44, borderRadius: "50%", fontSize: 22, cursor: "pointer" }}>‹</button>
          <img
            src={lightbox.photos[lightbox.idx]?.url} alt=""
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: "90vw", maxHeight: "88vh", objectFit: "contain", borderRadius: 10 }}
          />
          <button onClick={e => { e.stopPropagation(); setLightbox(l => ({ ...l, idx: Math.min(l.photos.length - 1, l.idx + 1) })); }}
            style={{ position: "absolute", right: 20, background: "#334155", border: "none", color: "#fff", width: 44, height: 44, borderRadius: "50%", fontSize: 22, cursor: "pointer" }}>›</button>
          <button onClick={() => setLightbox(null)}
            style={{ position: "absolute", top: 18, right: 18, background: "#334155", border: "none", color: "#fff", width: 38, height: 38, borderRadius: "50%", fontSize: 18, cursor: "pointer" }}>✕</button>
          {lightbox.photos.length > 1 && (
            <div style={{ position: "absolute", bottom: 18, color: "#94a3b8", fontSize: 13 }}>
              {lightbox.idx + 1} / {lightbox.photos.length}
            </div>
          )}
        </div>
      )}

      {/* ── Modal Novo Veículo ── */}
      {showAdd && (
        <div style={S.ovl} onClick={e => { if (e.target === e.currentTarget) setShowAdd(false); }}>
          <div style={S.mbox}>
            <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 16 }}>➕ Novo Veículo</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
              <div style={{ gridColumn: "1/-1" }}>
                <label style={S.lbl}>Tipo</label>
                <div style={{ display: "flex", gap: 8 }}>
                  {["car", "moto"].map(t => (
                    <button key={t} style={{ ...S.btn(nv.type === t ? "p" : "g"), flex: 1, justifyContent: "center" }}
                      onClick={() => setNv(v => ({ ...v, type: t }))}>
                      {t === "car" ? "🚗 Carro" : "🏍️ Moto"}
                    </button>
                  ))}
                </div>
              </div>
              {[["brand","Marca","Volkswagen"],["model","Modelo","Voyage"],["plate","Placa","BRA2E25"],["color","Cor","Branco"]].map(([k,l,p]) => (
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
                  {["novo","bom","meia vida","troca necessária"].map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
              <div><label style={S.lbl}>IPVA vence</label><input style={S.inp} type="date" value={nv.docs_ipva} onChange={e => setNv(v => ({ ...v, docs_ipva: e.target.value }))} /></div>
              <div><label style={S.lbl}>Seguro vence</label><input style={S.inp} type="date" value={nv.docs_seguro} onChange={e => setNv(v => ({ ...v, docs_seguro: e.target.value }))} /></div>
              <div><label style={S.lbl}>Revisão</label><input style={S.inp} type="date" value={nv.docs_revisao} onChange={e => setNv(v => ({ ...v, docs_revisao: e.target.value }))} /></div>
              <div style={{ gridColumn: "1/-1" }}><label style={S.lbl}>Obs</label><textarea style={{ ...S.inp, minHeight: 50, resize: "vertical" }} value={nv.notes} onChange={e => setNv(v => ({ ...v, notes: e.target.value }))} /></div>
            </div>
            {error && <div style={{ color: "#ef4444", fontSize: 13, marginBottom: 10 }}>⚠ {error}</div>}
            <div style={{ display: "flex", gap: 9 }}>
              <button style={S.btn("s")} onClick={handleAdd} disabled={saving}>{saving ? "Salvando..." : "✅ Cadastrar"}</button>
              <button style={S.btn("g")} onClick={() => { setShowAdd(false); setError(null); }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
