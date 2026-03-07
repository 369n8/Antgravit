import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, X } from 'lucide-react';

const CATEGORIES = ['Revisão', 'Pneu', 'Freios', 'Óleo', 'Elétrica', 'Funilaria', 'IPVA', 'Outro'];
const FINE_BUCKET = 'fine-photos';

const PASTEL = {
  '#22c55e': ['rgba(143,156,130,0.18)', '#4A5441'],
  '#ef4444': ['#E6C6C6',               '#7A3B3B'],
  '#f59e0b': ['#FFF0C2',               '#7A5800'],
  '#3b82f6': ['#DDEAF3',               '#2D5085'],
  '#6366f1': ['#ECEEFF',               '#3B3E9A'],
  '#64748b': ['#EBEBEB',               '#4B5563'],
};

const S = {
  card: { background: '#fff', borderRadius: 24, padding: 22, boxShadow: 'none', border: '1px solid #EBEBEB' },
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
  mbox: { background: '#fff', borderRadius: 28, padding: 32, width: '100%', maxWidth: 520, maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.08)', border: '1px solid #EBEBEB' },
  alr:  d => ({
    background: d < 0 || d < 7 ? '#E6C6C630' : d < 30 ? '#FFF0C2' : '#EEF4FB',
    border: `1px solid ${d < 0 || d < 7 ? '#E6C6C6' : d < 30 ? '#F5D98B' : '#C3D9EC'}`,
    borderRadius: 14, padding: '13px 16px', display: 'flex', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 9,
  }),
};

function daysUntil(d) { return Math.ceil((new Date(d) - new Date()) / 86400000); }
function ptDate(d) { if (!d) return '—'; const [y,m,dd] = d.split('-'); return `${dd}/${m}/${y}`; }

const MAINT_BLANK = { vehicle_id: '', event_type: 'expense', category: 'Revisão', date: '', description: '', value_amount: 0 };
const INS_BLANK   = { vehicle_id: '', insurer: '', policy_number: '', pay_date: '', expiry_date: '', amount: 0, notes: '' };
const FINE_BLANK  = { vehicle_id: '', tenant_id: '', amount: 0, date: '', due_date: '', description: '', infraction_code: '', status: 'pendente' };

const PillTabs = ({ tabs, active, onChange, style }) => (
  <div style={{ background: '#F6F6F4', borderRadius: 999, padding: 4, display: 'inline-flex', gap: 2, ...style }}>
    {tabs.map(([id, l]) => (
      <button key={id} onClick={() => onChange(id)} style={{
        padding: '7px 20px', borderRadius: 999, border: 'none',
        background: active === id ? '#fff' : 'transparent',
        color: active === id ? '#111827' : '#9CA3AF',
        boxShadow: active === id ? '0 1px 3px rgba(0,0,0,0.10)' : 'none',
        cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 600,
        transition: 'all .15s',
      }}>{l}</button>
    ))}
  </div>
);

export default function Maintenance() {
  const [tab, setTab]           = useState('manutencao');

  const [rows, setRows]         = useState([]);
  const [filter, setFilter]     = useState('all');
  const [showAddM, setShowAddM] = useState(false);
  const [nm, setNm]             = useState(MAINT_BLANK);

  const [insurance, setInsurance] = useState([]);
  const [showAddI, setShowAddI]   = useState(false);
  const [ni, setNi]               = useState(INS_BLANK);

  const [fines, setFines]       = useState([]);
  const [showAddF, setShowAddF] = useState(false);
  const [nf, setNf]             = useState(FINE_BLANK);
  const [finePhoto, setFinePhoto] = useState(null);
  const [fineUploading, setFineUploading] = useState(false);
  const fineFileRef             = useRef();

  const [vehicles, setVehicles] = useState([]);
  const [tenants, setTenants]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState(null);

  const load = () => {
    setLoading(true);
    Promise.all([
      supabase.from('maintenance').select('*, vehicles(plate, brand, model, type)').order('date', { ascending: false }),
      supabase.from('insurance').select('*, vehicles(plate, brand, model, type)').order('expiry_date', { ascending: true }),
      supabase.from('fines').select('*, vehicles(plate, brand, model, type), tenants(name)').order('date', { ascending: false }),
      supabase.from('vehicles').select('id, brand, model, plate, type'),
      supabase.from('tenants').select('id, name').eq('status', 'ativo'),
    ]).then(([{ data: maints }, { data: ins }, { data: fi }, { data: vehs }, { data: tens }]) => {
      setRows(maints ?? []);
      setInsurance(ins ?? []);
      setFines(fi ?? []);
      setVehicles(vehs ?? []);
      setTenants(tens ?? []);
      setLoading(false);
    });
  };

  useEffect(() => { load(); }, []);

  const toggleDone = async (id, current) => {
    await supabase.from('maintenance').update({ done: !current }).eq('id', id);
    setRows(r => r.map(m => m.id === id ? { ...m, done: !current } : m));
  };

  const handleAddM = async () => {
    if (!nm.vehicle_id) { setError('Selecione um veículo.'); return; }
    setSaving(true); setError(null);
    const { data: { user } } = await supabase.auth.getUser();
    const { error: err } = await supabase.from('maintenance').insert({
      client_id: user.id, vehicle_id: nm.vehicle_id, event_type: nm.event_type,
      category: nm.category, date: nm.date || null, description: nm.description || null,
      value_amount: nm.value_amount || 0, done: false,
    });
    setSaving(false);
    if (err) { setError(err.message); return; }
    setShowAddM(false); setNm(MAINT_BLANK); load();
  };

  const handleAddI = async () => {
    if (!ni.vehicle_id) { setError('Selecione um veículo.'); return; }
    setSaving(true); setError(null);
    const { data: { user } } = await supabase.auth.getUser();
    const { error: err } = await supabase.from('insurance').insert({
      client_id: user.id, vehicle_id: ni.vehicle_id, insurer: ni.insurer || null,
      policy_number: ni.policy_number || null, pay_date: ni.pay_date || null,
      expiry_date: ni.expiry_date || null, amount: ni.amount || 0, notes: ni.notes || null,
    });
    setSaving(false);
    if (err) { setError(err.message); return; }
    setShowAddI(false); setNi(INS_BLANK); load();
  };

  const handleFinePhotoUpload = async (files) => {
    if (!files?.length) return;
    setFineUploading(true);
    const { data: { user } } = await supabase.auth.getUser();
    const file = files[0];
    const ext  = file.name.split('.').pop();
    const path = `${user.id}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from(FINE_BUCKET).upload(path, file);
    if (!upErr) {
      const { data: { publicUrl } } = supabase.storage.from(FINE_BUCKET).getPublicUrl(path);
      setFinePhoto({ url: publicUrl, path });
    } else setError(upErr.message);
    setFineUploading(false);
  };

  const handleAddF = async () => {
    if (!nf.vehicle_id) { setError('Selecione um veículo.'); return; }
    setSaving(true); setError(null);
    const { data: { user } } = await supabase.auth.getUser();
    const { error: err } = await supabase.from('fines').insert({
      client_id: user.id, vehicle_id: nf.vehicle_id, tenant_id: nf.tenant_id || null,
      photo_url: finePhoto?.url || null, photo_path: finePhoto?.path || null,
      amount: nf.amount || 0, date: nf.date || null, due_date: nf.due_date || null,
      description: nf.description || null, infraction_code: nf.infraction_code || null, status: nf.status,
    });
    setSaving(false);
    if (err) { setError(err.message); return; }
    setShowAddF(false); setNf(FINE_BLANK); setFinePhoto(null); load();
  };

  const toggleFineStatus = async (id, current) => {
    const next = current === 'pendente' ? 'pago' : 'pendente';
    await supabase.from('fines').update({ status: next }).eq('id', id);
    setFines(f => f.map(x => x.id === id ? { ...x, status: next } : x));
  };

  if (loading) return <div className="loading"><div className="spinner" /> Carregando...</div>;

  const totalExpenses = rows.filter(r => r.event_type === 'expense').reduce((s, r) => s + (r.value_amount || 0), 0);
  const pendSchedule  = rows.filter(r => r.event_type === 'schedule' && !r.done).length;
  const insExpiring   = insurance.filter(i => i.expiry_date && daysUntil(i.expiry_date) <= 30).length;
  const finesPending  = fines.filter(f => f.status === 'pendente').reduce((s, f) => s + (f.amount || 0), 0);
  const filtered      = rows.filter(r => filter === 'all' || r.event_type === filter);

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
        <button style={{ ...S.btn(), gap: 6 }} onClick={() => {
          if (tab === 'manutencao') setShowAddM(true);
          else if (tab === 'seguro') setShowAddI(true);
          else setShowAddF(true);
        }}><Plus size={14} /> Registrar</button>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(165px,1fr))', gap: 12, marginBottom: 24 }}>
        {[
          { l: 'Despesas Manutenção', v: `R$ ${totalExpenses.toLocaleString('pt-BR',{minimumFractionDigits:2})}`, ac: '#ef4444' },
          { l: 'Agendamentos Pend.',  v: pendSchedule,   ac: '#f59e0b' },
          { l: 'Seguros Vencendo',    v: insExpiring,    ac: '#3b82f6' },
          { l: 'Multas Pendentes',    v: `R$ ${finesPending.toLocaleString('pt-BR',{minimumFractionDigits:2})}`, ac: '#ef4444' },
        ].map((s, i) => (
          <div key={i} style={{ background: '#fff', borderRadius: 24, padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ fontSize: 36, fontWeight: 700, color: s.ac, letterSpacing: '-2px', lineHeight: 1, marginBottom: 6 }}>{s.v}</div>
            <div style={{ fontSize: 10, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '.1em', fontWeight: 600 }}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* Tabs — Pill */}
      <div style={{ marginBottom: 18 }}>
        <PillTabs
          tabs={[['multas','Multas'],['manutencao','Manutenção'],['seguro','Seguros']]}
          active={tab}
          onChange={setTab}
        />
      </div>

      {/* ── TAB MANUTENÇÃO ── */}
      {tab === 'manutencao' && (
        <>
          <div style={{ marginBottom: 14 }}>
            <PillTabs
              tabs={[['all','Todos'],['expense','Despesas'],['schedule','Agendamentos']]}
              active={filter}
              onChange={setFilter}
            />
          </div>
          {filtered.length === 0 ? (
            <div style={{ ...S.card, textAlign: 'center', padding: 50, color: '#9CA3AF' }}>
              Nenhum evento registrado.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {filtered.map(m => {
                const days = m.date ? daysUntil(m.date) : null;
                const isSchedule = m.event_type === 'schedule';
                const color = isSchedule ? (days === null ? '#6366f1' : days < 0 ? '#ef4444' : days < 7 ? '#ef4444' : days < 30 ? '#f59e0b' : '#3b82f6') : '#ef4444';
                const veh = m.vehicles;
                return (
                  <div key={m.id} style={isSchedule && !m.done ? S.alr(days ?? 999) : { ...S.card, marginBottom: 0, opacity: m.done ? 0.6 : 1 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, fontSize: 14, color: '#111827' }}>{veh ? `${veh.brand} ${veh.model}` : '—'}</span>
                        {veh && <span style={S.bdg('#6366f1')}>{veh.plate}</span>}
                        <span style={S.bdg(isSchedule ? '#3b82f6' : '#ef4444')}>{isSchedule ? 'Agendamento' : 'Despesa'}</span>
                        {m.category && <span style={S.bdg('#f59e0b')}>{m.category}</span>}
                      </div>
                      <div style={{ fontSize: 13, color: '#9CA3AF' }}>{m.description ?? '—'}</div>
                      {m.date && <div style={{ fontSize: 12, color, marginTop: 3, fontWeight: 600 }}>
                        {isSchedule && days !== null ? days < 0 ? `Vencido há ${Math.abs(days)}d` : days === 0 ? 'Hoje!' : `${ptDate(m.date)} — em ${days}d` : ptDate(m.date)}
                      </div>}
                      {m.value_amount > 0 && <div style={{ fontSize: 13, color: '#7A3B3B', fontWeight: 700, marginTop: 2 }}>R$ {Number(m.value_amount).toLocaleString('pt-BR',{minimumFractionDigits:2})}</div>}
                    </div>
                    {isSchedule && (
                      <button style={{ ...S.btn(m.done ? 'g' : 's'), padding: '6px 16px', fontSize: 12, flexShrink: 0 }}
                        onClick={() => toggleDone(m.id, m.done)}>{m.done ? 'Reabrir' : 'Concluir'}</button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── TAB SEGURO ── */}
      {tab === 'seguro' && (
        <>
          {insurance.length === 0 ? (
            <div style={{ ...S.card, textAlign: 'center', padding: 50, color: '#9CA3AF' }}>
              Nenhum seguro cadastrado.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {insurance.map(ins => {
                const days = ins.expiry_date ? daysUntil(ins.expiry_date) : null;
                const ac = days === null ? '#6366f1' : days < 0 ? '#ef4444' : days < 7 ? '#ef4444' : days < 30 ? '#f59e0b' : '#22c55e';
                const veh = ins.vehicles;
                return (
                  <div key={ins.id} style={S.alr(days ?? 999)}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, fontSize: 14, color: '#111827' }}>{veh ? `${veh.brand} ${veh.model}` : '—'}</span>
                        {veh && <span style={S.bdg('#6366f1')}>{veh.plate}</span>}
                        {ins.insurer && <span style={S.bdg('#64748b')}>{ins.insurer}</span>}
                        <span style={S.bdg(ins.pay_date ? '#22c55e' : '#f59e0b')}>{ins.pay_date ? '✓ Pago' : 'Pendente'}</span>
                      </div>
                      {ins.policy_number && <div style={{ fontSize: 12, color: '#9CA3AF' }}>Apólice: {ins.policy_number}</div>}
                      <div style={{ display: 'flex', gap: 14, marginTop: 4, flexWrap: 'wrap' }}>
                        {ins.pay_date    && <div style={{ fontSize: 12, color: '#9CA3AF' }}>Pago em: {ptDate(ins.pay_date)}</div>}
                        {ins.expiry_date && <div style={{ fontSize: 12, color: ac, fontWeight: 600 }}>Vence: {ptDate(ins.expiry_date)}{days !== null && ` (${days < 0 ? `vencido há ${Math.abs(days)}d` : `em ${days}d`})`}</div>}
                        {ins.amount > 0  && <div style={{ fontSize: 12, color: '#111827', fontWeight: 600 }}>R$ {Number(ins.amount).toLocaleString('pt-BR',{minimumFractionDigits:2})}</div>}
                      </div>
                      {ins.notes && <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 3 }}>{ins.notes}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── TAB MULTAS ── */}
      {tab === 'multas' && (
        <>
          {fines.length === 0 ? (
            <div style={{ ...S.card, textAlign: 'center', padding: 50, color: '#9CA3AF' }}>
              Nenhuma multa registrada.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {fines.map(f => {
                const veh = f.vehicles;
                const statusColor = f.status === 'pago' ? '#22c55e' : f.status === 'contestado' ? '#f59e0b' : '#ef4444';
                return (
                  <div key={f.id} style={{ ...S.card, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    {f.photo_url && (
                      <img src={f.photo_url} alt="multa" style={{ width: 70, height: 70, objectFit: 'cover', borderRadius: 14, flexShrink: 0, cursor: 'pointer' }}
                        onClick={() => window.open(f.photo_url, '_blank')} />
                    )}
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, fontSize: 14, color: '#111827' }}>{veh ? `${veh.brand} ${veh.model}` : '—'}</span>
                        {veh && <span style={S.bdg('#6366f1')}>{veh.plate}</span>}
                        <span style={S.bdg(statusColor)}>{f.status}</span>
                        {f.tenants && <span style={S.bdg('#64748b')}>{f.tenants.name}</span>}
                      </div>
                      {f.description && <div style={{ fontSize: 13, color: '#9CA3AF' }}>{f.description}</div>}
                      <div style={{ display: 'flex', gap: 14, marginTop: 4, flexWrap: 'wrap' }}>
                        {f.date && <div style={{ fontSize: 12, color: '#9CA3AF' }}>Infração: {ptDate(f.date)}</div>}
                        {f.due_date && (() => { const d = daysUntil(f.due_date); const c = d < 0 ? '#7A3B3B' : d < 7 ? '#7A5800' : '#9CA3AF'; return <div style={{ fontSize: 12, color: c, fontWeight: d < 7 ? 700 : 400 }}>Vence: {ptDate(f.due_date)}{d < 0 ? ' (vencida)' : d < 7 ? ` (${d}d)` : ''}</div>; })()}
                        {f.infraction_code && <div style={{ fontSize: 12, color: '#9CA3AF' }}>Cód: {f.infraction_code}</div>}
                        {f.amount > 0 && <div style={{ fontSize: 13, color: '#7A3B3B', fontWeight: 700 }}>R$ {Number(f.amount).toLocaleString('pt-BR',{minimumFractionDigits:2})}</div>}
                      </div>
                    </div>
                    <button style={{ ...S.btn(f.status === 'pago' ? 'g' : 's'), padding: '6px 14px', fontSize: 11, flexShrink: 0 }}
                      onClick={() => toggleFineStatus(f.id, f.status)}>{f.status === 'pago' ? 'Reabrir' : 'Pago'}</button>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── Modal Manutenção ── */}
      {showAddM && (
        <div style={S.ovl} onClick={e => { if (e.target === e.currentTarget) { setShowAddM(false); setError(null); } }}>
          <div style={S.mbox}>
            <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 20, color: '#111827', letterSpacing: '-0.3px' }}>Registrar Evento</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={S.lbl}>Tipo</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[['expense','Despesa'],['schedule','Agendamento']].map(([v,l]) => (
                    <button key={v} style={{ ...S.btn(nm.event_type === v ? 'p' : 'g'), flex: 1, justifyContent: 'center' }}
                      onClick={() => setNm(p => ({ ...p, event_type: v }))}>{l}</button>
                  ))}
                </div>
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={S.lbl}>Veículo *</label>
                <select style={S.inp} value={nm.vehicle_id} onChange={e => setNm(p => ({ ...p, vehicle_id: e.target.value }))}>
                  <option value="">Selecione</option>
                  {vehicles.map(v => <option key={v.id} value={v.id}>{v.brand} {v.model} — {v.plate}</option>)}
                </select>
              </div>
              <div><label style={S.lbl}>Categoria</label><select style={S.inp} value={nm.category} onChange={e => setNm(p => ({ ...p, category: e.target.value }))}>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></div>
              <div><label style={S.lbl}>Data</label><input style={S.inp} type="date" value={nm.date} onChange={e => setNm(p => ({ ...p, date: e.target.value }))} /></div>
              <div style={{ gridColumn: '1/-1' }}><label style={S.lbl}>Descrição</label><input style={S.inp} placeholder="Troca de óleo, revisão dos 30k..." value={nm.description} onChange={e => setNm(p => ({ ...p, description: e.target.value }))} /></div>
              {nm.event_type === 'expense' && (
                <div><label style={S.lbl}>Valor R$</label><input style={S.inp} type="number" value={nm.value_amount} onChange={e => setNm(p => ({ ...p, value_amount: Number(e.target.value) }))} /></div>
              )}
            </div>
            {error && <div style={{ color: '#7A3B3B', fontSize: 13, marginBottom: 12 }}>⚠ {error}</div>}
            <div style={{ display: 'flex', gap: 9 }}>
              <button style={S.btn('s')} onClick={handleAddM} disabled={saving}>{saving ? 'Salvando...' : 'Cadastrar'}</button>
              <button style={S.btn('g')} onClick={() => { setShowAddM(false); setError(null); }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Seguro ── */}
      {showAddI && (
        <div style={S.ovl} onClick={e => { if (e.target === e.currentTarget) { setShowAddI(false); setError(null); } }}>
          <div style={S.mbox}>
            <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 20, color: '#111827', letterSpacing: '-0.3px' }}>Cadastrar Seguro</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={S.lbl}>Veículo *</label>
                <select style={S.inp} value={ni.vehicle_id} onChange={e => setNi(p => ({ ...p, vehicle_id: e.target.value }))}>
                  <option value="">Selecione</option>
                  {vehicles.map(v => <option key={v.id} value={v.id}>{v.brand} {v.model} — {v.plate}</option>)}
                </select>
              </div>
              <div><label style={S.lbl}>Seguradora</label><input style={S.inp} placeholder="Porto Seguro" value={ni.insurer} onChange={e => setNi(p => ({ ...p, insurer: e.target.value }))} /></div>
              <div><label style={S.lbl}>Nº Apólice</label><input style={S.inp} placeholder="0000000" value={ni.policy_number} onChange={e => setNi(p => ({ ...p, policy_number: e.target.value }))} /></div>
              <div><label style={S.lbl}>Data Pagamento</label><input style={S.inp} type="date" value={ni.pay_date} onChange={e => setNi(p => ({ ...p, pay_date: e.target.value }))} /></div>
              <div><label style={S.lbl}>Vencimento</label><input style={S.inp} type="date" value={ni.expiry_date} onChange={e => setNi(p => ({ ...p, expiry_date: e.target.value }))} /></div>
              <div><label style={S.lbl}>Valor R$</label><input style={S.inp} type="number" value={ni.amount} onChange={e => setNi(p => ({ ...p, amount: Number(e.target.value) }))} /></div>
              <div style={{ gridColumn: '1/-1' }}><label style={S.lbl}>Obs</label><input style={S.inp} placeholder="Observações adicionais" value={ni.notes} onChange={e => setNi(p => ({ ...p, notes: e.target.value }))} /></div>
            </div>
            {error && <div style={{ color: '#7A3B3B', fontSize: 13, marginBottom: 12 }}>⚠ {error}</div>}
            <div style={{ display: 'flex', gap: 9 }}>
              <button style={S.btn('s')} onClick={handleAddI} disabled={saving}>{saving ? 'Salvando...' : 'Cadastrar'}</button>
              <button style={S.btn('g')} onClick={() => { setShowAddI(false); setError(null); }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Multa ── */}
      {showAddF && (
        <div style={S.ovl} onClick={e => { if (e.target === e.currentTarget) { setShowAddF(false); setFinePhoto(null); setError(null); } }}>
          <div style={S.mbox}>
            <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 20, color: '#111827', letterSpacing: '-0.3px' }}>Registrar Multa</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div style={{ gridColumn: '1/-1' }}><label style={S.lbl}>Veículo *</label><select style={S.inp} value={nf.vehicle_id} onChange={e => setNf(p => ({ ...p, vehicle_id: e.target.value }))}><option value="">Selecione</option>{vehicles.map(v => <option key={v.id} value={v.id}>{v.brand} {v.model} — {v.plate}</option>)}</select></div>
              <div style={{ gridColumn: '1/-1' }}><label style={S.lbl}>Locatário (responsável)</label><select style={S.inp} value={nf.tenant_id} onChange={e => setNf(p => ({ ...p, tenant_id: e.target.value }))}><option value="">Nenhum / Proprietário</option>{tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
              <div><label style={S.lbl}>Valor R$</label><input style={S.inp} type="number" value={nf.amount} onChange={e => setNf(p => ({ ...p, amount: Number(e.target.value) }))} /></div>
              <div><label style={S.lbl}>Data da Infração</label><input style={S.inp} type="date" value={nf.date} onChange={e => setNf(p => ({ ...p, date: e.target.value }))} /></div>
              <div><label style={S.lbl}>Código da Infração</label><input style={S.inp} placeholder="55412" value={nf.infraction_code} onChange={e => setNf(p => ({ ...p, infraction_code: e.target.value }))} /></div>
              <div><label style={S.lbl}>Vencimento da Multa</label><input style={S.inp} type="date" value={nf.due_date} onChange={e => setNf(p => ({ ...p, due_date: e.target.value }))} /></div>
              <div><label style={S.lbl}>Status</label><select style={S.inp} value={nf.status} onChange={e => setNf(p => ({ ...p, status: e.target.value }))}>{['pendente','pago','contestado'].map(s => <option key={s}>{s}</option>)}</select></div>
              <div style={{ gridColumn: '1/-1' }}><label style={S.lbl}>Descrição</label><input style={S.inp} placeholder="Ex: Excesso de velocidade 20km/h" value={nf.description} onChange={e => setNf(p => ({ ...p, description: e.target.value }))} /></div>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={S.lbl}>Foto da Notificação</label>
                <input ref={fineFileRef} type="file" accept="image/*" hidden onChange={e => handleFinePhotoUpload(e.target.files)} />
                {finePhoto ? (
                  <div style={{ position: 'relative', display: 'inline-block' }}>
                    <img src={finePhoto.url} alt="multa" style={{ height: 90, borderRadius: 14, objectFit: 'cover' }} />
                    <button onClick={() => setFinePhoto(null)} style={{ position: 'absolute', top: 3, right: 3, background: 'rgba(0,0,0,.5)', border: 'none', color: '#fff', borderRadius: 999, width: 22, height: 22, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={10} /></button>
                  </div>
                ) : (
                  <button style={{ ...S.btn('g'), width: '100%', justifyContent: 'center' }} onClick={() => fineFileRef.current.click()} disabled={fineUploading}>
                    {fineUploading ? 'Enviando...' : 'Anexar Foto'}
                  </button>
                )}
              </div>
            </div>
            {error && <div style={{ color: '#7A3B3B', fontSize: 13, marginBottom: 12 }}>⚠ {error}</div>}
            <div style={{ display: 'flex', gap: 9 }}>
              <button style={S.btn('d')} onClick={handleAddF} disabled={saving}>{saving ? 'Salvando...' : 'Registrar Multa'}</button>
              <button style={S.btn('g')} onClick={() => { setShowAddF(false); setFinePhoto(null); setError(null); }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
