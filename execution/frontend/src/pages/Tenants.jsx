import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { generateContractPDF } from '../components/ContractGenerator';

const BLANK = {
  name: '', cpf: '', rg: '', birth_date: '', phone: '', phone2: '', email: '',
  cnh: '', cnh_category: 'B',
  app_used: 'Uber', app_rating: '',
  address: '', bairro: '', cidade: '', estado: 'SP', cep: '',
  emergency_name: '', emergency_phone: '', emergency_relation: '',
  vehicle_id: '', rent_weekly: 400, deposits: 0,
  payment_day: 'segunda-feira', payment_method: 'Pix', pix_key: '',
  telegram_username: '',
  notes: '',
};

const S = {
  card: { background: 'linear-gradient(135deg,#0f172a,#1e293b)', border: '1px solid #334155', borderRadius: 16, padding: 20 },
  bdg:  c => ({ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: `${c}20`, color: c, border: `1px solid ${c}40`, letterSpacing: '.05em', textTransform: 'uppercase', whiteSpace: 'nowrap' }),
  btn:  (v = 'p') => ({ padding: '9px 17px', borderRadius: 10, border: 'none', background: v === 'p' ? 'linear-gradient(135deg,#6366f1,#8b5cf6)' : v === 's' ? 'linear-gradient(135deg,#22c55e,#16a34a)' : v === 'd' ? 'linear-gradient(135deg,#ef4444,#dc2626)' : '#1e293b', color: '#fff', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }),
  inp:  { background: '#0a0f1e', border: '1px solid #334155', borderRadius: 8, padding: '9px 12px', color: '#e2e8f0', fontFamily: 'inherit', fontSize: 13, width: '100%', outline: 'none', boxSizing: 'border-box' },
  lbl:  { fontSize: 11, color: '#64748b', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 5, display: 'block' },
  ovl:  { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 16 },
  mbox: { background: '#0f172a', border: '1px solid #334155', borderRadius: 20, padding: 24, width: '100%', maxWidth: 700, maxHeight: '92vh', overflowY: 'auto' },
};

const Sec = ({ t }) => (
  <div style={{ fontSize: 11, fontWeight: 700, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 10, borderBottom: '1px solid #6366f130', paddingBottom: 6 }}>{t}</div>
);

function ptDate(dateStr) {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

export default function Tenants() {
  const [rows, setRows]         = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showAdd, setShowAdd]   = useState(false);
  const [nt, setNt]             = useState(BLANK);
  const [showEdit, setShowEdit] = useState(false);
  const [et, setEt]             = useState(BLANK);
  const [editTenant, setEditTenant] = useState(null);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  const BOT_USERNAME = 'Myfrot_bot';
  const activationLink = (tenantId) => `https://t.me/${BOT_USERNAME}?start=${tenantId}`;

  const copyLink = (tenantId) => {
    navigator.clipboard.writeText(activationLink(tenantId));
    setCopiedId(tenantId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const ntf = (k, v) => setNt(p => ({ ...p, [k]: v }));
  const etf = (k, v) => setEt(p => ({ ...p, [k]: v }));

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Excluir locatário "${name}"? Esta ação não pode ser desfeita.`)) return;
    await supabase.from('tenants').delete().eq('id', id);
    setRows(r => r.filter(t => t.id !== id));
  };

  const openEdit = (t) => {
    setEditTenant(t);
    setEt({
      name:               t.name               ?? '',
      cpf:                t.cpf                ?? '',
      rg:                 t.rg                 ?? '',
      birth_date:         t.birth_date         ?? '',
      phone:              t.phone              ?? '',
      phone2:             t.phone2             ?? '',
      email:              t.email              ?? '',
      cnh:                t.cnh                ?? '',
      cnh_category:       t.cnh_category       ?? 'B',
      app_used:           t.app_used           ?? 'Uber',
      app_rating:         t.app_rating         ?? '',
      address:            t.address            ?? '',
      bairro:             t.bairro             ?? '',
      cidade:             t.cidade             ?? '',
      estado:             t.estado             ?? 'SP',
      cep:                t.cep                ?? '',
      emergency_name:     t.emergency_name     ?? '',
      emergency_phone:    t.emergency_phone    ?? '',
      emergency_relation: t.emergency_relation ?? '',
      vehicle_id:         t.vehicle_id         ?? '',
      rent_weekly:        t.rent_weekly        ?? 400,
      deposits:           t.deposits           ?? 0,
      payment_day:        t.payment_day        ?? 'segunda-feira',
      payment_method:     t.payment_method     ?? 'Pix',
      pix_key:            t.pix_key            ?? '',
      telegram_username:  t.telegram_username  ?? '',
      notes:              t.notes              ?? '',
    });
    setError(null);
    setShowEdit(true);
  };

  const handleUpdate = async () => {
    if (!et.name.trim()) { setError('Nome é obrigatório.'); return; }
    setSaving(true);
    setError(null);

    const payload = {
      name:               et.name.trim(),
      cpf:                et.cpf                || null,
      rg:                 et.rg                 || null,
      birth_date:         et.birth_date         || null,
      phone:              et.phone              || null,
      phone2:             et.phone2             || null,
      email:              et.email              || null,
      cnh:                et.cnh                || null,
      cnh_category:       et.cnh_category       || null,
      app_used:           et.app_used           || null,
      app_rating:         et.app_rating         || null,
      address:            et.address            || null,
      bairro:             et.bairro             || null,
      cidade:             et.cidade             || null,
      estado:             et.estado             || null,
      cep:                et.cep                || null,
      emergency_name:     et.emergency_name     || null,
      emergency_phone:    et.emergency_phone    || null,
      emergency_relation: et.emergency_relation || null,
      vehicle_id:         et.vehicle_id         || null,
      rent_weekly:        et.rent_weekly,
      deposits:           et.deposits,
      payment_day:        et.payment_day        || null,
      payment_method:     et.payment_method     || null,
      pix_key:            et.pix_key            || null,
      telegram_username:  et.telegram_username  || null,
      notes:              et.notes              || null,
    };

    const { error: err } = await supabase.from('tenants').update(payload).eq('id', editTenant.id);
    setSaving(false);
    if (err) { setError(err.message); return; }

    setRows(r => r.map(t => t.id === editTenant.id ? { ...t, ...payload } : t));
    setShowEdit(false);
    setEditTenant(null);
  };

  const load = () => {
    setLoading(true);
    Promise.all([
      supabase.from('tenants')
        .select('*, vehicles(plate, brand, model, type), payments(paid_status)')
        .order('created_at', { ascending: false }),
      supabase.from('vehicles')
        .select('id, brand, model, plate, type, status')
        .eq('status', 'disponivel'),
    ]).then(([{ data: tenants }, { data: vehs }]) => {
      setRows(tenants ?? []);
      setVehicles(vehs ?? []);
      setLoading(false);
    });
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async () => {
    if (!nt.name.trim()) { setError('Nome é obrigatório.'); return; }
    setSaving(true);
    setError(null);

    const { data: { user } } = await supabase.auth.getUser();

    const payload = {
      client_id:          user.id,
      name:               nt.name.trim(),
      cpf:                nt.cpf || null,
      rg:                 nt.rg || null,
      birth_date:         nt.birth_date || null,
      phone:              nt.phone || null,
      phone2:             nt.phone2 || null,
      email:              nt.email || null,
      cnh:                nt.cnh || null,
      cnh_category:       nt.cnh_category || null,
      app_used:           nt.app_used || null,
      app_rating:         nt.app_rating || null,
      address:            nt.address || null,
      bairro:             nt.bairro || null,
      cidade:             nt.cidade || null,
      estado:             nt.estado || null,
      cep:                nt.cep || null,
      emergency_name:     nt.emergency_name || null,
      emergency_phone:    nt.emergency_phone || null,
      emergency_relation: nt.emergency_relation || null,
      vehicle_id:         nt.vehicle_id || null,
      rent_weekly:        nt.rent_weekly,
      deposits:           nt.deposits,
      payment_day:        nt.payment_day || null,
      payment_method:     nt.payment_method || null,
      pix_key:            nt.pix_key            || null,
      telegram_username:  nt.telegram_username  || null,
      notes:              nt.notes              || null,
      since:              new Date().toISOString().slice(0, 10),
      status:             'ativo',
      blacklisted:        false,
    };

    const { error: err } = await supabase.from('tenants').insert(payload);
    setSaving(false);
    if (err) { setError(err.message); return; }
    setShowAdd(false);
    setNt(BLANK);
    load();
  };

  if (loading) return <div className="loading"><div className="spinner" /> Carregando...</div>;

  const ativos     = rows.filter(t => t.status !== 'encerrado');
  const encerrados = rows.filter(t => t.status === 'encerrado');

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>👥 Locatários</div>
        <button style={S.btn()} onClick={() => setShowAdd(true)}>+ Cadastrar</button>
      </div>

      {/* Cards ativos */}
      {ativos.length === 0 ? (
        <div style={{ ...S.card, textAlign: 'center', padding: 50 }}>
          <div style={{ fontSize: 44, marginBottom: 11 }}>👥</div>
          <div style={{ color: '#64748b', marginBottom: 15 }}>Nenhum locatário ativo</div>
          <button style={{ ...S.btn(), margin: '0 auto', justifyContent: 'center' }} onClick={() => setShowAdd(true)}>
            Cadastrar primeiro
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 15 }}>
          {ativos.map(t => {
            const payments  = t.payments ?? [];
            const pendCount = payments.filter(p => !p.paid_status).length;
            const veh       = t.vehicles;

            return (
              <div key={t.id} style={{ ...S.card, border: `1px solid ${pendCount > 0 ? '#ef444440' : t.blacklisted ? '#f59e0b40' : '#334155'}` }}>
                {/* Avatar + nome */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 13 }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, flexShrink: 0 }}>
                      {t.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{t.name}</div>
                      <div style={{ fontSize: 12, color: '#64748b' }}>
                        {t.app_used ?? '—'} {t.app_rating ? `⭐${t.app_rating}` : ''}
                      </div>
                    </div>
                  </div>
                  <div style={S.bdg(pendCount > 0 ? '#ef4444' : payments.length === 0 ? '#64748b' : '#22c55e')}>
                    {pendCount > 0 ? 'Inadiml.' : payments.length === 0 ? 'Novo' : 'Em dia'}
                  </div>
                </div>

                {/* Veículo vinculado */}
                {veh && (
                  <div style={{ background: '#080d1a', borderRadius: 8, padding: '7px 10px', marginBottom: 11, display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 13 }}>{veh.type === 'moto' ? '🏍️' : '🚗'} {veh.brand} {veh.model}</span>
                    <span style={{ fontSize: 12, color: '#64748b' }}>{veh.plate}</span>
                  </div>
                )}

                {/* Status Telegram */}
                {t.telegram_username && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, padding: '5px 8px', borderRadius: 8, background: '#080d1a' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: t.telegram_chat_id ? '#229ED9' : '#475569', flexShrink: 0 }} />
                    <span style={{ fontSize: 11, color: t.telegram_chat_id ? '#229ED9' : '#64748b' }}>
                      {t.telegram_chat_id ? `Telegram vinculado` : `@${t.telegram_username} — pendente`}
                    </span>
                  </div>
                )}

                {/* Mini-cards */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                  {[
                    [`R$${t.rent_weekly ?? 0}`, '/Sem', '#6366f1'],
                    [t.blacklisted ? '⛔' : '✓',        'BL',   t.blacklisted ? '#ef4444' : '#22c55e'],
                    [`${pendCount}`,                     pendCount > 0 ? 'Pend.' : 'OK', pendCount > 0 ? '#ef4444' : '#22c55e'],
                  ].map(([val, lbl, color], i) => (
                    <div key={i} style={{ background: '#080d1a', borderRadius: 8, padding: '6px 4px', textAlign: 'center' }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color }}>{val}</div>
                      <div style={{ fontSize: 9, color: '#64748b' }}>{lbl}</div>
                    </div>
                  ))}
                </div>

                {/* Rodapé */}
                <div style={{ display: 'flex', gap: 7, borderTop: '1px solid #1e293b', paddingTop: 10, marginTop: 10 }}>
                  <button
                    style={{ ...S.btn('s'), flex: 1, justifyContent: 'center', padding: '6px 10px', fontSize: 11 }}
                    onClick={() => generateContractPDF(t, veh)}
                  >
                    📋 PDF
                  </button>
                  {!t.telegram_chat_id && (
                    <button
                      title="Copiar link de ativação do Telegram"
                      style={{ padding: '6px 10px', borderRadius: 10, border: '1px solid #334155', background: copiedId === t.id ? '#22c55e22' : '#1e293b', color: copiedId === t.id ? '#22c55e' : '#64748b', fontFamily: 'inherit', fontSize: 11, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
                      onClick={() => copyLink(t.id)}
                    >
                      {copiedId === t.id ? '✓ Copiado' : '🔗 Link'}
                    </button>
                  )}
                  <button
                    style={{ ...S.btn('p'), padding: '6px 12px', fontSize: 12 }}
                    onClick={() => openEdit(t)}
                  >
                    ✏
                  </button>
                  <button
                    style={{ ...S.btn('d'), padding: '6px 12px', fontSize: 12 }}
                    onClick={() => handleDelete(t.id, t.name)}
                  >
                    🗑
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Encerrados */}
      {encerrados.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <div style={{ fontSize: 14, color: '#64748b', fontWeight: 700, marginBottom: 12 }}>📁 Contratos Encerrados</div>
          {encerrados.map(t => (
            <div key={t.id} style={{ ...S.card, marginBottom: 8, opacity: 0.65, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 600 }}>{t.name}</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>CPF: {t.cpf ?? '—'} • {t.phone ?? '—'}</div>
              </div>
              <div style={S.bdg('#64748b')}>Encerrado</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Modal Editar Locatário ── */}
      {showEdit && editTenant && (() => {
        const currentVeh = editTenant.vehicles;
        const editVehicleOpts = [
          ...(currentVeh && editTenant.vehicle_id ? [{ id: editTenant.vehicle_id, brand: currentVeh.brand, model: currentVeh.model, plate: currentVeh.plate }] : []),
          ...vehicles.filter(v => v.id !== editTenant.vehicle_id),
        ];
        return (
          <div style={S.ovl} onClick={e => { if (e.target === e.currentTarget) { setShowEdit(false); setError(null); } }}>
            <div style={S.mbox}>
              <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>✏ Editar Locatário</div>
              <div style={{ color: '#64748b', fontSize: 13, marginBottom: 18 }}>{editTenant.name}</div>

              <Sec t="— Dados Pessoais" />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                <div style={{ gridColumn: '1/-1' }}>
                  <label style={S.lbl}>Nome *</label>
                  <input style={S.inp} value={et.name} onChange={e => etf('name', e.target.value)} />
                </div>
                <div>
                  <label style={S.lbl}>CPF</label>
                  <input style={S.inp} placeholder="000.000.000-00" value={et.cpf} onChange={e => etf('cpf', e.target.value)} />
                </div>
                <div>
                  <label style={S.lbl}>RG</label>
                  <input style={S.inp} placeholder="00.000.000-0" value={et.rg} onChange={e => etf('rg', e.target.value)} />
                </div>
                <div>
                  <label style={S.lbl}>Nascimento</label>
                  <input style={S.inp} type="date" value={et.birth_date} onChange={e => etf('birth_date', e.target.value)} />
                </div>
                <div>
                  <label style={S.lbl}>Telefone</label>
                  <input style={S.inp} placeholder="(11) 99999-9999" value={et.phone} onChange={e => etf('phone', e.target.value)} />
                </div>
                <div>
                  <label style={S.lbl}>Telefone 2</label>
                  <input style={S.inp} placeholder="(11) 99999-9999" value={et.phone2} onChange={e => etf('phone2', e.target.value)} />
                </div>
                <div>
                  <label style={S.lbl}>E-mail</label>
                  <input style={S.inp} placeholder="email@exemplo.com" value={et.email} onChange={e => etf('email', e.target.value)} />
                </div>
                <div>
                  <label style={S.lbl}>Telegram Username</label>
                  <input style={S.inp} placeholder="@usuario" value={et.telegram_username} onChange={e => etf('telegram_username', e.target.value)} />
                </div>
              </div>

              <Sec t="— CNH & App" />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
                <div>
                  <label style={S.lbl}>CNH</label>
                  <input style={S.inp} placeholder="00000000000" value={et.cnh} onChange={e => etf('cnh', e.target.value)} />
                </div>
                <div>
                  <label style={S.lbl}>Categoria</label>
                  <select style={S.inp} value={et.cnh_category} onChange={e => etf('cnh_category', e.target.value)}>
                    {['A', 'B', 'AB', 'C', 'D', 'E'].map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={S.lbl}>App</label>
                  <select style={S.inp} value={et.app_used} onChange={e => etf('app_used', e.target.value)}>
                    {['Uber', '99', 'InDriver', 'Lyft', 'Outro'].map(a => <option key={a}>{a}</option>)}
                  </select>
                </div>
                <div>
                  <label style={S.lbl}>Avaliação</label>
                  <input style={S.inp} placeholder="4.87" value={et.app_rating} onChange={e => etf('app_rating', e.target.value)} />
                </div>
              </div>

              <Sec t="— Endereço" />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                <div style={{ gridColumn: '1/-1' }}>
                  <label style={S.lbl}>Rua e Número</label>
                  <input style={S.inp} placeholder="Rua das Flores, 123" value={et.address} onChange={e => etf('address', e.target.value)} />
                </div>
                <div>
                  <label style={S.lbl}>Bairro</label>
                  <input style={S.inp} placeholder="Vila Mariana" value={et.bairro} onChange={e => etf('bairro', e.target.value)} />
                </div>
                <div>
                  <label style={S.lbl}>Cidade</label>
                  <input style={S.inp} placeholder="São Paulo" value={et.cidade} onChange={e => etf('cidade', e.target.value)} />
                </div>
                <div>
                  <label style={S.lbl}>Estado</label>
                  <input style={S.inp} placeholder="SP" value={et.estado} onChange={e => etf('estado', e.target.value)} />
                </div>
                <div>
                  <label style={S.lbl}>CEP</label>
                  <input style={S.inp} placeholder="00000-000" value={et.cep} onChange={e => etf('cep', e.target.value)} />
                </div>
              </div>

              <Sec t="— Emergência" />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
                <div>
                  <label style={S.lbl}>Nome</label>
                  <input style={S.inp} placeholder="Maria da Silva" value={et.emergency_name} onChange={e => etf('emergency_name', e.target.value)} />
                </div>
                <div>
                  <label style={S.lbl}>Parentesco</label>
                  <input style={S.inp} placeholder="Mãe" value={et.emergency_relation} onChange={e => etf('emergency_relation', e.target.value)} />
                </div>
                <div>
                  <label style={S.lbl}>Telefone</label>
                  <input style={S.inp} placeholder="(11) 99999-9999" value={et.emergency_phone} onChange={e => etf('emergency_phone', e.target.value)} />
                </div>
              </div>

              <Sec t="— Contrato & Pagamento" />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
                <div>
                  <label style={S.lbl}>Veículo</label>
                  <select style={S.inp} value={et.vehicle_id} onChange={e => etf('vehicle_id', e.target.value)}>
                    <option value="">Nenhum</option>
                    {editVehicleOpts.map(v => (
                      <option key={v.id} value={v.id}>{v.brand} {v.model} — {v.plate}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={S.lbl}>Aluguel/Sem R$</label>
                  <input style={S.inp} type="number" value={et.rent_weekly} onChange={e => etf('rent_weekly', Number(e.target.value))} />
                </div>
                <div>
                  <label style={S.lbl}>Caução R$</label>
                  <input style={S.inp} type="number" value={et.deposits} onChange={e => etf('deposits', Number(e.target.value))} />
                </div>
                <div>
                  <label style={S.lbl}>Pagamento</label>
                  <select style={S.inp} value={et.payment_method} onChange={e => etf('payment_method', e.target.value)}>
                    {['Pix', 'Dinheiro', 'Transferência'].map(m => <option key={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label style={S.lbl}>Dia</label>
                  <select style={S.inp} value={et.payment_day} onChange={e => etf('payment_day', e.target.value)}>
                    {['segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'].map(d => <option key={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label style={S.lbl}>Chave Pix</label>
                  <input style={S.inp} placeholder="CPF ou e-mail" value={et.pix_key} onChange={e => etf('pix_key', e.target.value)} />
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={S.lbl}>Obs</label>
                <textarea style={{ ...S.inp, minHeight: 55, resize: 'vertical' }} value={et.notes} onChange={e => etf('notes', e.target.value)} />
              </div>

              {error && <div style={{ color: '#ef4444', fontSize: 13, marginBottom: 10 }}>⚠ {error}</div>}
              <div style={{ display: 'flex', gap: 9 }}>
                <button style={S.btn('s')} onClick={handleUpdate} disabled={saving}>
                  {saving ? 'Salvando...' : '✅ Salvar'}
                </button>
                <button style={S.btn('g')} onClick={() => { setShowEdit(false); setError(null); }}>
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Modal Cadastrar Locatário ── */}
      {showAdd && (
        <div style={S.ovl} onClick={e => { if (e.target === e.currentTarget) { setShowAdd(false); setError(null); } }}>
          <div style={S.mbox}>
            <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>👤 Cadastrar Locatário</div>
            <div style={{ color: '#64748b', fontSize: 13, marginBottom: 18 }}>Preencha os dados do locatário</div>

            <Sec t="— Dados Pessoais" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={S.lbl}>Nome *</label>
                <input style={S.inp} placeholder="João da Silva" value={nt.name} onChange={e => ntf('name', e.target.value)} />
              </div>
              <div>
                <label style={S.lbl}>CPF *</label>
                <input style={S.inp} placeholder="000.000.000-00" value={nt.cpf} onChange={e => ntf('cpf', e.target.value)} />
              </div>
              <div>
                <label style={S.lbl}>RG</label>
                <input style={S.inp} placeholder="00.000.000-0" value={nt.rg} onChange={e => ntf('rg', e.target.value)} />
              </div>
              <div>
                <label style={S.lbl}>Nascimento</label>
                <input style={S.inp} type="date" value={nt.birth_date} onChange={e => ntf('birth_date', e.target.value)} />
              </div>
              <div>
                <label style={S.lbl}>Telefone *</label>
                <input style={S.inp} placeholder="(11) 99999-9999" value={nt.phone} onChange={e => ntf('phone', e.target.value)} />
              </div>
              <div>
                <label style={S.lbl}>Telefone 2</label>
                <input style={S.inp} placeholder="(11) 99999-9999" value={nt.phone2} onChange={e => ntf('phone2', e.target.value)} />
              </div>
              <div>
                <label style={S.lbl}>E-mail</label>
                <input style={S.inp} placeholder="email@exemplo.com" value={nt.email} onChange={e => ntf('email', e.target.value)} />
              </div>
              <div>
                <label style={S.lbl}>Telegram Username</label>
                <input style={S.inp} placeholder="@usuario" value={nt.telegram_username} onChange={e => ntf('telegram_username', e.target.value)} />
              </div>
            </div>

            <Sec t="— CNH & App" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
              <div>
                <label style={S.lbl}>CNH</label>
                <input style={S.inp} placeholder="00000000000" value={nt.cnh} onChange={e => ntf('cnh', e.target.value)} />
              </div>
              <div>
                <label style={S.lbl}>Categoria</label>
                <select style={S.inp} value={nt.cnh_category} onChange={e => ntf('cnh_category', e.target.value)}>
                  {['A', 'B', 'AB', 'C', 'D', 'E'].map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={S.lbl}>App</label>
                <select style={S.inp} value={nt.app_used} onChange={e => ntf('app_used', e.target.value)}>
                  {['Uber', '99', 'InDriver', 'Lyft', 'Outro'].map(a => <option key={a}>{a}</option>)}
                </select>
              </div>
              <div>
                <label style={S.lbl}>Avaliação</label>
                <input style={S.inp} placeholder="4.87" value={nt.app_rating} onChange={e => ntf('app_rating', e.target.value)} />
              </div>
            </div>

            <Sec t="— Endereço" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={S.lbl}>Rua e Número</label>
                <input style={S.inp} placeholder="Rua das Flores, 123" value={nt.address} onChange={e => ntf('address', e.target.value)} />
              </div>
              <div>
                <label style={S.lbl}>Bairro</label>
                <input style={S.inp} placeholder="Vila Mariana" value={nt.bairro} onChange={e => ntf('bairro', e.target.value)} />
              </div>
              <div>
                <label style={S.lbl}>Cidade</label>
                <input style={S.inp} placeholder="São Paulo" value={nt.cidade} onChange={e => ntf('cidade', e.target.value)} />
              </div>
              <div>
                <label style={S.lbl}>Estado</label>
                <input style={S.inp} placeholder="SP" value={nt.estado} onChange={e => ntf('estado', e.target.value)} />
              </div>
              <div>
                <label style={S.lbl}>CEP</label>
                <input style={S.inp} placeholder="00000-000" value={nt.cep} onChange={e => ntf('cep', e.target.value)} />
              </div>
            </div>

            <Sec t="— Emergência" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
              <div>
                <label style={S.lbl}>Nome</label>
                <input style={S.inp} placeholder="Maria da Silva" value={nt.emergency_name} onChange={e => ntf('emergency_name', e.target.value)} />
              </div>
              <div>
                <label style={S.lbl}>Parentesco</label>
                <input style={S.inp} placeholder="Mãe" value={nt.emergency_relation} onChange={e => ntf('emergency_relation', e.target.value)} />
              </div>
              <div>
                <label style={S.lbl}>Telefone</label>
                <input style={S.inp} placeholder="(11) 99999-9999" value={nt.emergency_phone} onChange={e => ntf('emergency_phone', e.target.value)} />
              </div>
            </div>

            <Sec t="— Contrato & Pagamento" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
              <div>
                <label style={S.lbl}>Veículo</label>
                <select style={S.inp} value={nt.vehicle_id} onChange={e => ntf('vehicle_id', e.target.value)}>
                  <option value="">Selecione</option>
                  {vehicles.map(v => (
                    <option key={v.id} value={v.id}>{v.brand} {v.model} — {v.plate}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={S.lbl}>Aluguel/Sem R$</label>
                <input style={S.inp} type="number" value={nt.rent_weekly} onChange={e => ntf('rent_weekly', Number(e.target.value))} />
              </div>
              <div>
                <label style={S.lbl}>Caução R$</label>
                <input style={S.inp} type="number" value={nt.deposits} onChange={e => ntf('deposits', Number(e.target.value))} />
              </div>
              <div>
                <label style={S.lbl}>Pagamento</label>
                <select style={S.inp} value={nt.payment_method} onChange={e => ntf('payment_method', e.target.value)}>
                  {['Pix', 'Dinheiro', 'Transferência'].map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label style={S.lbl}>Dia</label>
                <select style={S.inp} value={nt.payment_day} onChange={e => ntf('payment_day', e.target.value)}>
                  {['segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'].map(d => <option key={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label style={S.lbl}>Chave Pix</label>
                <input style={S.inp} placeholder="CPF ou e-mail" value={nt.pix_key} onChange={e => ntf('pix_key', e.target.value)} />
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={S.lbl}>Obs</label>
              <textarea style={{ ...S.inp, minHeight: 55, resize: 'vertical' }} value={nt.notes} onChange={e => ntf('notes', e.target.value)} />
            </div>

            {error && <div style={{ color: '#ef4444', fontSize: 13, marginBottom: 10 }}>⚠ {error}</div>}
            <div style={{ display: 'flex', gap: 9 }}>
              <button style={S.btn('s')} onClick={handleAdd} disabled={saving}>
                {saving ? 'Salvando...' : '✅ Cadastrar'}
              </button>
              <button style={S.btn('g')} onClick={() => { setShowAdd(false); setError(null); }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
