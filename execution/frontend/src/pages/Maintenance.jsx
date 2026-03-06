import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const CATEGORIES = ['Revisão', 'Pneu', 'Freios', 'Óleo', 'Elétrica', 'Funilaria', 'Seguro', 'IPVA', 'Multa', 'Outro'];

const BLANK = {
  vehicle_id: '', event_type: 'expense', category: 'Revisão',
  date: '', description: '', value_amount: 0,
};

const S = {
  card: { background: 'linear-gradient(135deg,#0f172a,#1e293b)', border: '1px solid #334155', borderRadius: 16, padding: 20 },
  sc:   ac => ({ background: 'linear-gradient(135deg,#0f172a,#1e293b)', border: `1px solid ${ac}40`, borderRadius: 16, padding: 18, position: 'relative', overflow: 'hidden' }),
  bar:  ac => ({ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: ac }),
  bdg:  c => ({ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: `${c}20`, color: c, border: `1px solid ${c}40`, letterSpacing: '.05em', textTransform: 'uppercase', whiteSpace: 'nowrap' }),
  btn:  (v = 'p') => ({ padding: '9px 17px', borderRadius: 10, border: 'none', background: v === 'p' ? 'linear-gradient(135deg,#6366f1,#8b5cf6)' : v === 's' ? 'linear-gradient(135deg,#22c55e,#16a34a)' : v === 'd' ? 'linear-gradient(135deg,#ef4444,#dc2626)' : '#1e293b', color: '#fff', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }),
  inp:  { background: '#0a0f1e', border: '1px solid #334155', borderRadius: 8, padding: '9px 12px', color: '#e2e8f0', fontFamily: 'inherit', fontSize: 13, width: '100%', outline: 'none', boxSizing: 'border-box' },
  lbl:  { fontSize: 11, color: '#64748b', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 5, display: 'block' },
  ovl:  { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 16 },
  mbox: { background: '#0f172a', border: '1px solid #334155', borderRadius: 20, padding: 24, width: '100%', maxWidth: 520, maxHeight: '92vh', overflowY: 'auto' },
  alr:  d => ({ background: d < 0 ? '#ef444410' : d < 7 ? '#ef444410' : d < 30 ? '#f59e0b10' : '#3b82f610', border: `1px solid ${d < 0 || d < 7 ? '#ef4444' : d < 30 ? '#f59e0b' : '#3b82f6'}40`, borderRadius: 12, padding: '12px 15px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 }),
};

function daysUntil(d) { return Math.ceil((new Date(d) - new Date()) / 86400000); }

export default function Maintenance() {
  const [rows, setRows]       = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState('all');
  const [showAdd, setShowAdd] = useState(false);
  const [nm, setNm]           = useState(BLANK);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState(null);

  const load = () => {
    setLoading(true);
    Promise.all([
      supabase.from('maintenance').select('*, vehicles(plate, brand, model, type)').order('date', { ascending: false }),
      supabase.from('vehicles').select('id, brand, model, plate, type'),
    ]).then(([{ data: maints }, { data: vehs }]) => {
      setRows(maints ?? []);
      setVehicles(vehs ?? []);
      setLoading(false);
    });
  };

  useEffect(() => { load(); }, []);

  const toggleDone = async (id, current) => {
    await supabase.from('maintenance').update({ done: !current }).eq('id', id);
    setRows(r => r.map(m => m.id === id ? { ...m, done: !current } : m));
  };

  const handleAdd = async () => {
    if (!nm.vehicle_id) { setError('Selecione um veículo.'); return; }
    setSaving(true); setError(null);
    const { data: { user } } = await supabase.auth.getUser();
    const { error: err } = await supabase.from('maintenance').insert({
      client_id:    user.id,
      vehicle_id:   nm.vehicle_id,
      event_type:   nm.event_type,
      category:     nm.category,
      date:         nm.date || null,
      description:  nm.description || null,
      value_amount: nm.value_amount || 0,
      done:         false,
    });
    setSaving(false);
    if (err) { setError(err.message); return; }
    setShowAdd(false); setNm(BLANK); load();
  };

  if (loading) return <div className="loading"><div className="spinner" /> Carregando...</div>;

  const filtered       = rows.filter(r => filter === 'all' || r.event_type === filter);
  const totalExpenses  = rows.filter(r => r.event_type === 'expense').reduce((s, r) => s + (r.value_amount || 0), 0);
  const pendSchedule   = rows.filter(r => r.event_type === 'schedule' && !r.done).length;
  const overdueCount   = rows.filter(r => r.event_type === 'schedule' && !r.done && r.date && daysUntil(r.date) < 0).length;

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>🔧 Manutenção</div>
        <button style={S.btn()} onClick={() => setShowAdd(true)}>+ Registrar</button>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(185px,1fr))', gap: 13, marginBottom: 20 }}>
        {[
          { l: 'Total em despesas',   v: `R$ ${totalExpenses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, ac: '#ef4444' },
          { l: 'Agendamentos pend.',  v: pendSchedule,   ac: '#f59e0b' },
          { l: 'Vencidos',            v: overdueCount,   ac: '#ef4444' },
          { l: 'Total de eventos',    v: rows.length,    ac: '#6366f1' },
        ].map((s, i) => (
          <div key={i} style={S.sc(s.ac)}>
            <div style={S.bar(s.ac)} />
            <div style={{ fontSize: 22, fontWeight: 700, color: s.ac, margin: '5px 0 2px' }}>{s.v}</div>
            <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.07em' }}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {[['all', 'Todos'], ['expense', 'Despesas'], ['schedule', 'Agendamentos']].map(([f, l]) => (
          <button key={f} onClick={() => setFilter(f)} style={{ ...S.btn(filter === f ? 'p' : 'g'), padding: '6px 16px', fontSize: 12 }}>{l}</button>
        ))}
      </div>

      {/* Lista */}
      {filtered.length === 0 ? (
        <div style={{ ...S.card, textAlign: 'center', padding: 50, color: '#64748b' }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>🔧</div>
          Nenhum evento registrado.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {filtered.map(m => {
            const days = m.date ? daysUntil(m.date) : null;
            const isSchedule = m.event_type === 'schedule';
            const color = isSchedule
              ? (days === null ? '#6366f1' : days < 0 ? '#ef4444' : days < 7 ? '#ef4444' : days < 30 ? '#f59e0b' : '#3b82f6')
              : '#ef4444';
            const veh = m.vehicles;
            return (
              <div key={m.id} style={isSchedule && !m.done ? S.alr(days ?? 999) : { ...S.card, marginBottom: 0, opacity: m.done ? 0.6 : 1 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>
                      {veh ? `${veh.type === 'moto' ? '🏍️' : '🚗'} ${veh.brand} ${veh.model}` : '—'}
                    </span>
                    {veh && <span style={S.bdg('#6366f1')}>{veh.plate}</span>}
                    <span style={S.bdg(isSchedule ? '#3b82f6' : '#ef4444')}>{isSchedule ? 'Agendamento' : 'Despesa'}</span>
                    {m.category && <span style={S.bdg('#f59e0b')}>{m.category}</span>}
                  </div>
                  <div style={{ fontSize: 13, color: '#94a3b8' }}>{m.description ?? '—'}</div>
                  {m.date && (
                    <div style={{ fontSize: 12, color, marginTop: 3, fontWeight: 600 }}>
                      {isSchedule && days !== null
                        ? days < 0 ? `⚠️ Vencido há ${Math.abs(days)} dias` : days === 0 ? '📅 Hoje!' : `📅 ${new Date(m.date).toLocaleDateString('pt-BR')} — em ${days}d`
                        : new Date(m.date).toLocaleDateString('pt-BR')}
                    </div>
                  )}
                  {m.value_amount > 0 && (
                    <div style={{ fontSize: 13, color: '#ef4444', fontWeight: 700, marginTop: 2 }}>
                      R$ {Number(m.value_amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                  )}
                </div>
                {isSchedule && (
                  <button
                    style={{ ...S.btn(m.done ? 'g' : 's'), padding: '6px 14px', fontSize: 12, flexShrink: 0 }}
                    onClick={() => toggleDone(m.id, m.done)}
                  >
                    {m.done ? '↩ Reabrir' : '✓ Concluir'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Registrar */}
      {showAdd && (
        <div style={S.ovl} onClick={e => { if (e.target === e.currentTarget) { setShowAdd(false); setError(null); } }}>
          <div style={S.mbox}>
            <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 16 }}>🔧 Registrar Evento</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
              {/* Tipo */}
              <div style={{ gridColumn: '1/-1' }}>
                <label style={S.lbl}>Tipo</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[['expense', '💸 Despesa'], ['schedule', '📅 Agendamento']].map(([v, l]) => (
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
              <div>
                <label style={S.lbl}>Categoria</label>
                <select style={S.inp} value={nm.category} onChange={e => setNm(p => ({ ...p, category: e.target.value }))}>
                  {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={S.lbl}>Data</label>
                <input style={S.inp} type="date" value={nm.date} onChange={e => setNm(p => ({ ...p, date: e.target.value }))} />
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={S.lbl}>Descrição</label>
                <input style={S.inp} placeholder="Troca de óleo, revisão dos 30k..." value={nm.description} onChange={e => setNm(p => ({ ...p, description: e.target.value }))} />
              </div>
              {nm.event_type === 'expense' && (
                <div>
                  <label style={S.lbl}>Valor R$</label>
                  <input style={S.inp} type="number" value={nm.value_amount} onChange={e => setNm(p => ({ ...p, value_amount: Number(e.target.value) }))} />
                </div>
              )}
            </div>
            {error && <div style={{ color: '#ef4444', fontSize: 13, marginBottom: 10 }}>⚠ {error}</div>}
            <div style={{ display: 'flex', gap: 9 }}>
              <button style={S.btn('s')} onClick={handleAdd} disabled={saving}>{saving ? 'Salvando...' : '✅ Cadastrar'}</button>
              <button style={S.btn('g')} onClick={() => { setShowAdd(false); setError(null); }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
