import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { S, PillTabs, daysUntil, ptDate, fmt, exportCSV } from '../lib/shared';
import {
  Plus, X, Download, Search, Wrench, Shield,
  FileText, Calendar, Car, ChevronRight, AlertCircle,
  Clock, CheckCircle2, DollarSign
} from 'lucide-react';

const CATEGORIES = ['Revisão', 'Pneu', 'Freios', 'Óleo', 'Elétrica', 'Funilaria', 'IPVA', 'Outro'];
const CAT_EMOJIS = { 'Revisão': '🔧', 'Pneu': '🛞', 'Freios': '🛑', 'Óleo': '🛢️', 'Elétrica': '⚡', 'Funilaria': '🔨', 'IPVA': '📄', 'Outro': '📝' };
const FINE_BUCKET = 'fine-photos';

const MAINT_BLANK = { vehicle_id: '', event_type: 'expense', category: 'Revisão', date: '', description: '', value_amount: 0 };
const INS_BLANK = { vehicle_id: '', insurer: '', policy_number: '', pay_date: '', expiry_date: '', amount: 0, notes: '' };
const FINE_BLANK = { vehicle_id: '', tenant_id: '', amount: 0, date: '', due_date: '', description: '', infraction_code: '', status: 'pendente' };

const G = {
  card: {
    background: '#FFF',
    borderRadius: 24,
    padding: '28px',
    border: '1px solid #F1F5F9',
    boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
  },
  statLabel: { fontSize: 11, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.1em' },
  statValue: { fontSize: 28, fontWeight: 900, color: '#102A57', letterSpacing: '-1.5px' },
  btn: (primary) => ({
    padding: '12px 24px', borderRadius: '16px', border: primary ? 'none' : '1px solid #E2E8F0',
    background: primary ? '#102A57' : '#FFF', color: primary ? '#FFF' : '#102A57',
    fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, transition: 'all 0.2s',
  }),
  badge: (color, bg) => ({
    padding: '4px 10px', borderRadius: 8, fontSize: 10, fontWeight: 900, textTransform: 'uppercase',
    color, background: bg
  })
};

export default function Maintenance() {
  const [tab, setTab] = useState('manutencao');
  const [rows, setRows] = useState([]);
  const [filter, setFilter] = useState('all');
  const [showAddM, setShowAddM] = useState(false);
  const [nm, setNm] = useState(MAINT_BLANK);
  const [insurance, setInsurance] = useState([]);
  const [showAddI, setShowAddI] = useState(false);
  const [ni, setNi] = useState(INS_BLANK);
  const [fines, setFines] = useState([]);
  const [showAddF, setShowAddF] = useState(false);
  const [nf, setNf] = useState(FINE_BLANK);
  const [finePhoto, setFinePhoto] = useState(null);
  const [fineUploading, setFineUploading] = useState(false);
  const fineFileRef = useRef();
  const [vehicles, setVehicles] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

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
    const ext = file.name.split('.').pop();
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

  if (loading) return <div className="loading"><div className="spinner" /> Carregando frota...</div>;

  const totalExpenses = rows.filter(r => r.event_type === 'expense').reduce((s, r) => s + (r.value_amount || 0), 0);
  const pendSchedule = rows.filter(r => r.event_type === 'schedule' && !r.done).length;
  const insExpiring = insurance.filter(i => i.expiry_date && daysUntil(i.expiry_date) <= 30).length;
  const finesPending = fines.filter(f => f.status === 'pendente').reduce((s, f) => s + (f.amount || 0), 0);
  const filtered = rows.filter(r => filter === 'all' || r.event_type === filter);

  return (
    <div className="page" style={{ background: '#F8FAFB', minHeight: '100vh', padding: '24px 0' }}>

      {/* ── HEADER ── */}
      <div style={{ marginBottom: 48, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
        <h2 style={{ fontSize: 32, fontWeight: 900, color: '#102A57', letterSpacing: '-1.5px', margin: 0 }}>Frota</h2>
        <p style={{ color: '#64748B', fontWeight: 600, marginTop: 4, fontSize: 16 }}>Inteligência em manutenção e conformidade</p>

        <div style={{ display: 'flex', gap: 12, marginTop: 24, flexWrap: 'wrap', justifyContent: 'center' }}>
          <button style={G.btn(true)} onClick={() => setShowAddM(true)}><Wrench size={18} /> MANUTENÇÃO</button>
          <button style={G.btn(true)} onClick={() => setShowAddI(true)}><Shield size={18} /> SEGURO</button>
          <button style={G.btn(true)} onClick={() => setShowAddF(true)}><AlertCircle size={18} /> MULTA</button>
        </div>
      </div>

      {/* ── STATS GRID ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 24, marginBottom: 40 }}>
        {[
          { l: 'Investimento Frota', v: `R$ ${fmt(totalExpenses)}`, icon: DollarSign, color: '#102A57', bg: '#F8FAFB' },
          { l: 'Manutenções Pend.', v: pendSchedule, icon: Wrench, color: '#5B58EC', bg: '#F3F2FF' },
          { l: 'Seguros a Renovar', v: insExpiring, icon: Shield, color: '#F59E0B', bg: '#FFFBEB' },
          { l: 'Multas Pendentes', v: `R$ ${fmt(finesPending)}`, icon: AlertCircle, color: '#EF4444', bg: '#FFF1F1' },
        ].map((s, i) => (
          <div key={i} style={G.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <s.icon size={20} color={s.color} />
              </div>
            </div>
            <div style={G.statLabel}>{s.l}</div>
            <div style={{ ...G.statValue, color: s.color }}>{s.v}</div>
          </div>
        ))}
      </div>

      {/* ── NAVIGATION ── */}
      <div style={{ background: '#FFF', padding: '8px', borderRadius: '20px', border: '1px solid #F1F5F9', marginBottom: 32, display: 'inline-flex' }}>
        <PillTabs
          tabs={[['manutencao', 'Manutenção'], ['seguro', 'Seguros'], ['multas', 'Multas Recentes']]}
          active={tab}
          onChange={setTab}
        />
      </div>

      {/* ── CONTENT ── */}
      <div style={{ minHeight: 400 }}>
        {tab === 'manutencao' && (
          <>
            <div style={{ marginBottom: 24, display: 'flex', gap: 12 }}>
              <PillTabs
                tabs={[['all', 'Todos'], ['expense', 'Realizados'], ['schedule', 'Agendados']]}
                active={filter}
                onChange={setFilter}
              />
            </div>
            {filtered.length === 0 ? (
              <div style={{ ...G.card, textAlign: 'center', padding: '80px 40px' }}>
                <Wrench size={48} color="#E2E8F0" style={{ marginBottom: 20 }} />
                <h3 style={{ fontSize: 18, fontWeight: 900, color: '#102A57' }}>Nenhum registro encontrado</h3>
                <p style={{ color: '#64748B', fontWeight: 600 }}>Tudo em ordem com a sua frota.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {filtered.map(m => {
                  const days = m.date ? daysUntil(m.date) : null;
                  const isLate = days !== null && days < 0;
                  const isSchedule = m.event_type === 'schedule';
                  const veh = m.vehicles;

                  return (
                    <div key={m.id} style={{
                      ...G.card,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      opacity: m.done ? 0.6 : 1,
                      borderLeft: isSchedule && !m.done ? `6px solid ${isLate ? '#EF4444' : '#5B58EC'}` : '1px solid #F1F5F9'
                    }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                          <span style={{ fontSize: 13, fontWeight: 900, color: '#102A57' }}>{CAT_EMOJIS[m.category]} {m.category}</span>
                          <span style={G.badge(isSchedule ? '#5B58EC' : '#64748B', isSchedule ? '#F3F2FF' : '#F8FAFB')}>
                            {isSchedule ? 'Agendamento' : 'Realizado'}
                          </span>
                          {veh && <span style={{ fontSize: 11, fontWeight: 800, color: '#94A3B8' }}>• {veh.brand} {veh.model} ({veh.plate})</span>}
                        </div>
                        <h4 style={{ fontSize: 16, fontWeight: 800, color: '#102A57', margin: '0 0 8px' }}>{m.description || 'Sem descrição'}</h4>
                        <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
                          {m.date && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: isLate && !m.done ? '#EF4444' : '#64748B' }}>
                              <Calendar size={14} />
                              {ptDate(m.date)} {isSchedule && !m.done && `(${isLate ? 'atrasado' : `em ${days}d`})`}
                            </div>
                          )}
                          {m.value_amount > 0 && (
                            <div style={{ fontSize: 15, fontWeight: 900, color: '#102A57' }}>R$ {fmt(m.value_amount)}</div>
                          )}
                        </div>
                      </div>
                      {isSchedule && (
                        <button
                          style={{ ...G.btn(!m.done), height: 40, padding: '0 20px' }}
                          onClick={() => toggleDone(m.id, m.done)}
                        >
                          {m.done ? 'REABRIR' : 'CONCLUIR'}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {tab === 'seguro' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {insurance.length === 0 ? (
              <div style={{ ...G.card, textAlign: 'center', padding: '80px 40px' }}>
                <Shield size={48} color="#E2E8F0" style={{ marginBottom: 20 }} />
                <h3 style={{ fontSize: 18, fontWeight: 900, color: '#102A57' }}>Nenhum seguro ativo</h3>
              </div>
            ) : (
              insurance.map(ins => {
                const days = ins.expiry_date ? daysUntil(ins.expiry_date) : null;
                const isCritical = days !== null && days < 15;
                const veh = ins.vehicles;
                return (
                  <div key={ins.id} style={{ ...G.card, borderLeft: ins.pay_date ? '1px solid #F1F5F9' : '6px solid #F59E0B' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                          <span style={{ fontSize: 13, fontWeight: 900, color: '#102A57' }}>{ins.insurer || 'Seguradora Não Inf.'}</span>
                          <span style={G.badge(ins.pay_date ? '#10B981' : '#F59E0B', ins.pay_date ? '#F0FDF4' : '#FFFBEB')}>
                            {ins.pay_date ? 'Ativo' : 'Pendente de Pagamento'}
                          </span>
                        </div>
                        <h4 style={{ fontSize: 18, fontWeight: 800, color: '#102A57', margin: '0 0 4px' }}>{veh?.brand} {veh?.model}</h4>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#94A3B8' }}>Apólice: {ins.policy_number || '—'} · Placa: {veh?.plate}</div>

                        <div style={{ display: 'flex', gap: 24, marginTop: 16 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: isCritical ? '#EF4444' : '#64748B' }}>
                            <Calendar size={14} style={{ marginRight: 6 }} />
                            Vence em: {ptDate(ins.expiry_date)} ({days} dias)
                          </div>
                          <div style={{ fontSize: 16, fontWeight: 900, color: '#102A57' }}>R$ {fmt(ins.amount)}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {tab === 'multas' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {fines.length === 0 ? (
              <div style={{ ...G.card, textAlign: 'center', padding: '80px 40px' }}>
                <AlertCircle size={48} color="#E2E8F0" style={{ marginBottom: 20 }} />
                <h3 style={{ fontSize: 18, fontWeight: 900, color: '#102A57' }}>Nada por aqui</h3>
              </div>
            ) : (
              fines.map(f => {
                const veh = f.vehicles;
                const isPaid = f.status === 'pago';
                return (
                  <div key={f.id} style={{ ...G.card, display: 'flex', gap: 24, alignItems: 'center' }}>
                    <div style={{ width: 64, height: 64, borderRadius: 16, background: '#F8FAFB', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {f.photo_url ? <img src={f.photo_url} style={{ width: '100%', height: '100%', borderRadius: 16, objectFit: 'cover' }} /> : <FileText size={24} color="#CBD5E1" />}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
                        <span style={{ fontSize: 14, fontWeight: 900, color: '#102A57' }}>{veh?.plate}</span>
                        <span style={G.badge(isPaid ? '#10B981' : '#EF4444', isPaid ? '#F0FDF4' : '#FFF1F1')}>{f.status}</span>
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#64748B' }}>{f.description}</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#94A3B8', marginTop: 4 }}>Condutor: {f.tenants?.name || 'Não identificado'}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 18, fontWeight: 900, color: '#EF4444', marginBottom: 8 }}>R$ {fmt(f.amount)}</div>
                      <button style={{ ...G.btn(isPaid), height: 32, padding: '0 12px', fontSize: 11 }} onClick={() => toggleFineStatus(f.id, f.status)}>
                        {isPaid ? 'REATIVAR' : 'MARCAR PAGO'}
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}
      </div>

      {/* ── MODAIS (LUNARA STYLE) ── */}
      {showAddM && (
        <div style={{ ...S.ovl, backdropFilter: 'blur(12px)' }} onClick={e => e.target === e.currentTarget && setShowAddM(false)}>
          <div style={{ ...G.card, width: '100%', maxWidth: 500, padding: 40, border: 'none' }}>
            <h3 style={{ fontSize: 24, fontWeight: 900, color: '#102A57', marginBottom: 32, letterSpacing: '-1px' }}>Registrar Evento</h3>

            <div style={{ display: 'grid', gap: 24 }}>
              <div>
                <label style={G.statLabel}>Tipo de Atividade</label>
                <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                  {[['expense', 'Despesa'], ['schedule', 'Agendamento']].map(([v, l]) => (
                    <button key={v} onClick={() => setNm(p => ({ ...p, event_type: v }))} style={{ ...G.btn(nm.event_type === v), flex: 1, justifyContent: 'center' }}>{l}</button>
                  ))}
                </div>
              </div>

              <div>
                <label style={G.statLabel}>Veículo *</label>
                <select style={{ ...S.inp, height: 48, borderRadius: 14, marginTop: 8 }} value={nm.vehicle_id} onChange={e => setNm(p => ({ ...p, vehicle_id: e.target.value }))}>
                  <option value="">Selecione...</option>
                  {vehicles.map(v => <option key={v.id} value={v.id}>{v.brand} {v.model} ({v.plate})</option>)}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={G.statLabel}>Categoria</label>
                  <select style={{ ...S.inp, height: 48, borderRadius: 14, marginTop: 8 }} value={nm.category} onChange={e => setNm(p => ({ ...p, category: e.target.value }))}>
                    {CATEGORIES.map(c => <option key={c}>{CAT_EMOJIS[c]} {c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={G.statLabel}>Data</label>
                  <input type="date" style={{ ...S.inp, height: 48, borderRadius: 14, marginTop: 8 }} value={nm.date} onChange={e => setNm(p => ({ ...p, date: e.target.value }))} />
                </div>
              </div>

              <div>
                <label style={G.statLabel}>Descrição</label>
                <input placeholder="Ex: Troca de óleo 5W30" style={{ ...S.inp, height: 48, borderRadius: 14, marginTop: 8 }} value={nm.description} onChange={e => setNm(p => ({ ...p, description: e.target.value }))} />
              </div>

              {nm.event_type === 'expense' && (
                <div>
                  <label style={G.statLabel}>Valor (R$)</label>
                  <input type="number" style={{ ...S.inp, height: 48, borderRadius: 14, marginTop: 8 }} value={nm.value_amount} onChange={e => setNm(p => ({ ...p, value_amount: Number(e.target.value) }))} />
                </div>
              )}
            </div>

            {error && <div style={{ color: '#EF4444', fontSize: 13, marginTop: 20, fontWeight: 700 }}>{error}</div>}

            <div style={{ display: 'flex', gap: 12, marginTop: 40 }}>
              <button style={{ ...G.btn(true), flex: 1, height: 52, justifyContent: 'center' }} onClick={handleAddM} disabled={saving}>{saving ? 'PROCESSANDO...' : 'SALVAR REGISTRO'}</button>
              <button style={{ ...G.btn(false), flex: 1, height: 52, justifyContent: 'center' }} onClick={() => setShowAddM(false)}>CANCELAR</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Seguro */}
      {showAddI && (
        <div style={{ ...S.ovl, backdropFilter: 'blur(12px)' }} onClick={e => e.target === e.currentTarget && setShowAddI(false)}>
          <div style={{ ...G.card, width: '100%', maxWidth: 500, padding: 40, border: 'none' }}>
            <h3 style={{ fontSize: 24, fontWeight: 900, color: '#102A57', marginBottom: 32, letterSpacing: '-1px' }}>Frota Insurance</h3>
            <div style={{ display: 'grid', gap: 24 }}>
              <div>
                <label style={G.statLabel}>Veículo *</label>
                <select style={{ ...S.inp, height: 48, borderRadius: 14, marginTop: 8 }} value={ni.vehicle_id} onChange={e => setNi(p => ({ ...p, vehicle_id: e.target.value }))}>
                  <option value="">Selecione...</option>
                  {vehicles.map(v => <option key={v.id} value={v.id}>{v.brand} {v.model} ({v.plate})</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div><label style={G.statLabel}>Seguradora</label><input style={{ ...S.inp, height: 48, borderRadius: 14, marginTop: 8 }} value={ni.insurer} onChange={e => setNi(p => ({ ...p, insurer: e.target.value }))} /></div>
                <div><label style={G.statLabel}>Apólice</label><input style={{ ...S.inp, height: 48, borderRadius: 14, marginTop: 8 }} value={ni.policy_number} onChange={e => setNi(p => ({ ...p, policy_number: e.target.value }))} /></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div><label style={G.statLabel}>Vencimento</label><input type="date" style={{ ...S.inp, height: 48, borderRadius: 14, marginTop: 8 }} value={ni.expiry_date} onChange={e => setNi(p => ({ ...p, expiry_date: e.target.value }))} /></div>
                <div><label style={G.statLabel}>Valor (R$)</label><input type="number" style={{ ...S.inp, height: 48, borderRadius: 14, marginTop: 8 }} value={ni.amount} onChange={e => setNi(p => ({ ...p, amount: Number(e.target.value) }))} /></div>
              </div>
            </div>
            {error && <div style={{ color: '#EF4444', fontSize: 13, marginTop: 20, fontWeight: 700 }}>{error}</div>}
            <div style={{ display: 'flex', gap: 12, marginTop: 40 }}>
              <button style={{ ...G.btn(true), flex: 1, height: 52, justifyContent: 'center' }} onClick={handleAddI} disabled={saving}>{saving ? '...' : 'SALVAR SEGURO'}</button>
              <button style={{ ...G.btn(false), flex: 1, height: 52, justifyContent: 'center' }} onClick={() => setShowAddI(false)}>CANCELAR</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Multa */}
      {showAddF && (
        <div style={{ ...S.ovl, backdropFilter: 'blur(12px)' }} onClick={e => e.target === e.currentTarget && setShowAddF(false)}>
          <div style={{ ...G.card, width: '100%', maxWidth: 500, padding: 40, border: 'none' }}>
            <h3 style={{ fontSize: 24, fontWeight: 900, color: '#102A57', marginBottom: 32, letterSpacing: '-1px' }}>Registrar Multa</h3>
            <div style={{ display: 'grid', gap: 24 }}>
              <div>
                <label style={G.statLabel}>Veículo *</label>
                <select style={{ ...S.inp, height: 48, borderRadius: 14, marginTop: 8 }} value={nf.vehicle_id} onChange={e => setNf(p => ({ ...p, vehicle_id: e.target.value }))}>
                  <option value="">Selecione...</option>
                  {vehicles.map(v => <option key={v.id} value={v.id}>{v.brand} {v.model} ({v.plate})</option>)}
                </select>
              </div>
              <div>
                <label style={G.statLabel}>Infrator (Opcional)</label>
                <select style={{ ...S.inp, height: 48, borderRadius: 14, marginTop: 8 }} value={nf.tenant_id} onChange={e => setNf(p => ({ ...p, tenant_id: e.target.value }))}>
                  <option value="">Desconhecido / Proprietário</option>
                  {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div><label style={G.statLabel}>Valor (R$)</label><input type="number" step="0.01" style={{ ...S.inp, height: 48, borderRadius: 14, marginTop: 8 }} value={nf.amount} onChange={e => setNf(p => ({ ...p, amount: parseFloat(e.target.value) || 0 }))} /></div>
                <div><label style={G.statLabel}>Data Infração</label><input type="date" style={{ ...S.inp, height: 48, borderRadius: 14, marginTop: 8 }} value={nf.date} onChange={e => setNf(p => ({ ...p, date: e.target.value }))} /></div>
              </div>
              <div>
                <label style={G.statLabel}>Descrição da Infração</label>
                <input placeholder="Ex: Excesso de velocidade 15-20km/h" style={{ ...S.inp, height: 48, borderRadius: 14, marginTop: 8 }} value={nf.description} onChange={e => setNf(p => ({ ...p, description: e.target.value }))} />
              </div>
              <div>
                <label style={G.statLabel}>Código da Infração</label>
                <input placeholder="Ex: 55412" style={{ ...S.inp, height: 48, borderRadius: 14, marginTop: 8 }} value={nf.infraction_code} onChange={e => setNf(p => ({ ...p, infraction_code: e.target.value }))} />
              </div>
              <div>
                <label style={G.statLabel}>Foto da Infração</label>
                <button style={{ ...G.btn(), width: '100%', marginTop: 8 }} onClick={() => fineFileRef.current.click()}>
                  {fineUploading ? 'ENVIANDO...' : finePhoto ? 'FOTO ANEXADA ✓' : 'ANEXAR COMPROVANTE'}
                </button>
                <input ref={fineFileRef} type="file" hidden onChange={e => handleFinePhotoUpload(e.target.files)} />
              </div>
            </div>
            {error && <div style={{ color: '#EF4444', fontSize: 13, marginTop: 20, fontWeight: 700 }}>{error}</div>}
            <div style={{ display: 'flex', gap: 12, marginTop: 40 }}>
              <button style={{ ...G.btn(true), flex: 1, height: 52, justifyContent: 'center' }} onClick={handleAddF} disabled={saving}>{saving ? '...' : 'SALVAR MULTA'}</button>
              <button style={{ ...G.btn(false), flex: 1, height: 52, justifyContent: 'center' }} onClick={() => setShowAddF(false)}>CANCELAR</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
