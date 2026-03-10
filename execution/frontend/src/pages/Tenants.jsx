import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { generateContractPDF } from '../components/ContractGenerator';
import { S, ptDate, fmt, exportCSV } from '../lib/shared';
import {
  Plus, FileText, Pencil, Trash2, Globe, Link,
  Receipt, Car, CheckCircle2, AlertCircle, X, Share2,
  ClipboardCheck, Download, Search, UserCheck, ShieldAlert,
  MessageCircle
} from 'lucide-react';

// ── Design System Lunara Elite ──
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
  statValue: { fontSize: 24, fontWeight: 900, color: '#102A57', letterSpacing: '-1px' },
  btn: (primary) => ({
    padding: '12px 24px', borderRadius: '16px', border: primary ? 'none' : '1px solid #E2E8F0',
    background: primary ? '#102A57' : '#FFF', color: primary ? '#FFF' : '#102A57',
    fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, transition: 'all 0.2s',
  }),
  badge: (color, bg) => ({
    padding: '4px 10px', borderRadius: 8, fontSize: 10, fontWeight: 900, textTransform: 'uppercase',
    color, background: bg
  }),
  // Estilos de seção de formulário
  sec: { fontSize: 11, fontWeight: 800, color: '#5B58EC', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12, paddingBottom: 6, borderBottom: '2px solid #EEF2FF' },
  inp: { background: '#F8FAFB', border: '1.5px solid #E2E8F0', borderRadius: 12, padding: '10px 14px', color: '#102A57', fontFamily: 'Helvetica, Inter, sans-serif', fontSize: 13, width: '100%', outline: 'none', boxSizing: 'border-box', fontWeight: 600 },
  lbl: { fontSize: 11, color: '#94A3B8', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 6, display: 'block', fontWeight: 700 },
  ovl: { position: 'fixed', inset: 0, background: 'rgba(16,42,87,0.25)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 16 },
  mbox: { background: '#FFF', borderRadius: 28, padding: 36, width: '100%', maxWidth: 780, maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(16,42,87,0.12)', border: '1px solid #F1F5F9' },
};

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

// BOT_USERNAME é carregado dinamicamente do clients.telegram_bot_username

// ── Subcomponente de Seção do Formulário ──
const Sec = ({ t }) => <div style={G.sec}>{t}</div>;

export default function Tenants() {
  const [rows, setRows] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [nt, setNt] = useState(BLANK);
  const [showEdit, setShowEdit] = useState(false);
  const [et, setEt] = useState(BLANK);
  const [editTenant, setEditTenant] = useState(null);
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [error, setError] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [search, setSearch] = useState('');
  const [userId, setUserId] = useState(null);
  const [botUsername, setBotUsername] = useState(null);

  // Aprovação de pré-cadastro
  const [showApproval, setShowApproval] = useState(false);
  const [approvalTenant, setApprovalTenant] = useState(null);
  const [approvalData, setApprovalData] = useState({ vehicle_id: '', rent_weekly: 400, payment_day: 'segunda-feira', deposits: 0 });
  const [approvingSaving, setApprovingSaving] = useState(false);

  // Helpers de campo
  const ntf = (k, v) => setNt(p => ({ ...p, [k]: v }));
  const etf = (k, v) => setEt(p => ({ ...p, [k]: v }));

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      setUserId(user.id);
      supabase.from('clients').select('telegram_bot_username').eq('id', user.id).maybeSingle()
        .then(({ data }) => { if (data?.telegram_bot_username) setBotUsername(data.telegram_bot_username); });
    });
    load();
  }, []);

  const load = () => {
    setLoading(true);
    Promise.all([
      supabase.from('tenants').select('*, vehicles!vehicle_id(id, brand, model, plate, type), payments(id, value_amount, paid_status, due_date)').order('created_at', { ascending: false }),
      supabase.from('vehicles').select('id, brand, model, plate, type, status').eq('status', 'disponivel'),
    ]).then(([{ data: tenants }, { data: vehs }]) => {
      setRows(tenants ?? []);
      setVehicles(vehs ?? []);
      setLoading(false);
    });
  };

  // ── Links ──
  const activationLink = (tenantId) => botUsername
    ? `https://t.me/${botUsername}?start=${tenantId}`
    : null;

  const copyTelegramLink = (tenantId) => {
    const link = activationLink(tenantId);
    if (!link) { alert('Configure seu bot Telegram em Motor IA → Gerente IA no Telegram antes de gerar links.'); return; }
    navigator.clipboard.writeText(link);
    setCopiedId(`tg-${tenantId}`);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const copyPortalLink = (tenantId) => {
    navigator.clipboard.writeText(`${window.location.origin}/portal/${tenantId}`);
    setCopiedId(`portal-${tenantId}`);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const copyOnboardingLink = () => {
    if (!userId) return;
    navigator.clipboard.writeText(`${window.location.origin}/pre-cadastro?ref=${userId}`);
    setCopiedId('onboarding');
    setTimeout(() => setCopiedId(null), 2500);
  };

  // ── Payload completo (todos os campos) ──
  const buildPayload = (data) => ({
    name:               data.name.trim(),
    cpf:                data.cpf                || null,
    rg:                 data.rg                 || null,
    birth_date:         data.birth_date         || null,
    phone:              data.phone              || null,
    phone2:             data.phone2             || null,
    email:              data.email              || null,
    cnh:                data.cnh                || null,
    cnh_category:       data.cnh_category       || null,
    app_used:           data.app_used           || null,
    app_rating:         data.app_rating         || null,
    address:            data.address            || null,
    bairro:             data.bairro             || null,
    cidade:             data.cidade             || null,
    estado:             data.estado             || null,
    cep:                data.cep                || null,
    emergency_name:     data.emergency_name     || null,
    emergency_phone:    data.emergency_phone    || null,
    emergency_relation: data.emergency_relation || null,
    vehicle_id:         data.vehicle_id         || null,
    rent_weekly:        Number(data.rent_weekly) || 400,
    deposits:           Number(data.deposits)   || 0,
    payment_day:        data.payment_day        || null,
    payment_method:     data.payment_method     || null,
    pix_key:            data.pix_key            || null,
    telegram_username:  data.telegram_username  || null,
    notes:              data.notes              || null,
  });

  // ── Cadastrar novo ──
  const handleAdd = async () => {
    if (!nt.name.trim()) { setError('Nome é obrigatório.'); return; }
    setSaving(true); setError(null);
    const { data: { user } } = await supabase.auth.getUser();
    const { error: err } = await supabase.from('tenants').insert({
      ...buildPayload(nt),
      client_id: user.id,
      since: new Date().toISOString().slice(0, 10),
      status: 'ativo',
      blacklisted: false,
    });
    setSaving(false);
    if (err) { setError(err.message); return; }
    setShowAdd(false); setNt(BLANK); load();
  };

  // ── Editar existente ──
  const openEdit = (t) => {
    setEditTenant(t);
    setEt({
      name: t.name ?? '', cpf: t.cpf ?? '', rg: t.rg ?? '',
      birth_date: t.birth_date ?? '', phone: t.phone ?? '', phone2: t.phone2 ?? '',
      email: t.email ?? '', cnh: t.cnh ?? '', cnh_category: t.cnh_category ?? 'B',
      app_used: t.app_used ?? 'Uber', app_rating: t.app_rating ?? '',
      address: t.address ?? '', bairro: t.bairro ?? '', cidade: t.cidade ?? '',
      estado: t.estado ?? 'SP', cep: t.cep ?? '',
      emergency_name: t.emergency_name ?? '', emergency_phone: t.emergency_phone ?? '',
      emergency_relation: t.emergency_relation ?? '',
      vehicle_id: t.vehicle_id ?? '', rent_weekly: t.rent_weekly ?? 400,
      deposits: t.deposits ?? 0, payment_day: t.payment_day ?? 'segunda-feira',
      payment_method: t.payment_method ?? 'Pix', pix_key: t.pix_key ?? '',
      telegram_username: t.telegram_username ?? '', notes: t.notes ?? '',
    });
    setError(null);
    setShowEdit(true);
  };

  const handleUpdate = async () => {
    if (!et.name.trim()) { setError('Nome é obrigatório.'); return; }
    setSaving(true); setError(null);
    const { error: err } = await supabase.from('tenants').update(buildPayload(et)).eq('id', editTenant.id);
    setSaving(false);
    if (err) { setError(err.message); return; }
    setShowEdit(false); setEditTenant(null); load();
  };

  // ── Deletar ──
  const handleDelete = async (id, name) => {
    if (!confirm(`Deseja EXCLUIR permanentemente o locatário ${name}?`)) return;
    setActionLoading(id);
    const { error: err } = await supabase.from('tenants').delete().eq('id', id);
    setActionLoading(null);
    if (err) alert(err.message);
    else { setSelectedTenant(null); load(); }
  };

  // ── Aprovar pré-cadastro ──
  const handleApprove = async () => {
    setApprovingSaving(true);
    const { error: err } = await supabase.from('tenants').update({
      status: 'ativo',
      vehicle_id: approvalData.vehicle_id || null,
      rent_weekly: approvalData.rent_weekly,
      payment_day: approvalData.payment_day,
      deposits: approvalData.deposits,
      since: new Date().toISOString().slice(0, 10),
    }).eq('id', approvalTenant.id);
    setApprovingSaving(false);
    if (!err) { setShowApproval(false); load(); }
  };

  if (loading) return <div className="loading"><div className="spinner" /> Carregando base...</div>;

  const pendentes  = rows.filter(t => t.status === 'pendente');
  const encerrados = rows.filter(t => t.status === 'encerrado');
  const searchFiltered = rows.filter(t => {
    const s = search.toLowerCase();
    return !search || t.name?.toLowerCase().includes(s) || t.cpf?.includes(s) || t.phone?.includes(s);
  });
  const ativos = searchFiltered.filter(t => t.status === 'ativo');

  // ── Formulário reutilizável (novo + edição) ──
  const TenantForm = ({ data, setData, onSave, onCancel, title, subtitle, veiculos }) => {
    const f = (k, v) => setData(p => ({ ...p, [k]: v }));
    const currentVeh = editTenant?.vehicles;
    const vOpts = [
      ...(currentVeh && editTenant?.vehicle_id ? [{ id: editTenant.vehicle_id, brand: currentVeh.brand, model: currentVeh.model, plate: currentVeh.plate }] : []),
      ...veiculos.filter(v => v.id !== editTenant?.vehicle_id),
    ];
    return (
      <div style={G.ovl} onClick={e => e.target === e.currentTarget && onCancel()}>
        <div style={G.mbox}>
          <h3 style={{ fontSize: 22, fontWeight: 900, color: '#102A57', margin: '0 0 4px', letterSpacing: '-1px' }}>{title}</h3>
          <p style={{ color: '#94A3B8', fontSize: 14, margin: '0 0 28px', fontWeight: 600 }}>{subtitle}</p>

          <Sec t="Dados Pessoais" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
            <div style={{ gridColumn: '1/-1' }}><label style={G.lbl}>Nome Completo *</label><input style={G.inp} placeholder="João da Silva" value={data.name} onChange={e => f('name', e.target.value)} /></div>
            <div><label style={G.lbl}>CPF *</label><input style={G.inp} placeholder="000.000.000-00" value={data.cpf} onChange={e => f('cpf', e.target.value)} /></div>
            <div><label style={G.lbl}>RG</label><input style={G.inp} placeholder="00.000.000-0" value={data.rg} onChange={e => f('rg', e.target.value)} /></div>
            <div><label style={G.lbl}>Nascimento</label><input type="date" style={G.inp} value={data.birth_date} onChange={e => f('birth_date', e.target.value)} /></div>
            <div><label style={G.lbl}>E-mail</label><input style={G.inp} placeholder="email@exemplo.com" value={data.email} onChange={e => f('email', e.target.value)} /></div>
            <div><label style={G.lbl}>Telefone Principal *</label><input style={G.inp} placeholder="(11) 99999-9999" value={data.phone} onChange={e => f('phone', e.target.value)} /></div>
            <div><label style={G.lbl}>Telefone Secundário</label><input style={G.inp} placeholder="(11) 99999-9999" value={data.phone2} onChange={e => f('phone2', e.target.value)} /></div>
            <div><label style={G.lbl}>Telegram @username</label><input style={G.inp} placeholder="@motorista" value={data.telegram_username} onChange={e => f('telegram_username', e.target.value)} /></div>
          </div>

          <Sec t="CNH & App" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
            <div><label style={G.lbl}>CNH *</label><input style={G.inp} placeholder="00000000000" value={data.cnh} onChange={e => f('cnh', e.target.value)} /></div>
            <div><label style={G.lbl}>Categoria</label><select style={G.inp} value={data.cnh_category} onChange={e => f('cnh_category', e.target.value)}>{['A','B','AB','C','D','E'].map(c => <option key={c}>{c}</option>)}</select></div>
            <div><label style={G.lbl}>App Usado</label><select style={G.inp} value={data.app_used} onChange={e => f('app_used', e.target.value)}>{['Uber','99','InDriver','Lyft','Outro'].map(a => <option key={a}>{a}</option>)}</select></div>
            <div><label style={G.lbl}>Avaliação</label><input style={G.inp} placeholder="4.87" value={data.app_rating} onChange={e => f('app_rating', e.target.value)} /></div>
          </div>

          <Sec t="Endereço" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
            <div style={{ gridColumn: '1/-1' }}><label style={G.lbl}>Rua e Número</label><input style={G.inp} placeholder="Rua das Flores, 123" value={data.address} onChange={e => f('address', e.target.value)} /></div>
            <div><label style={G.lbl}>Bairro</label><input style={G.inp} placeholder="Vila Mariana" value={data.bairro} onChange={e => f('bairro', e.target.value)} /></div>
            <div><label style={G.lbl}>Cidade</label><input style={G.inp} placeholder="São Paulo" value={data.cidade} onChange={e => f('cidade', e.target.value)} /></div>
            <div><label style={G.lbl}>Estado</label><input style={G.inp} placeholder="SP" value={data.estado} onChange={e => f('estado', e.target.value)} /></div>
            <div><label style={G.lbl}>CEP</label><input style={G.inp} placeholder="00000-000" value={data.cep} onChange={e => f('cep', e.target.value)} /></div>
          </div>

          <Sec t="Contato de Emergência" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
            <div><label style={G.lbl}>Nome</label><input style={G.inp} placeholder="Maria da Silva" value={data.emergency_name} onChange={e => f('emergency_name', e.target.value)} /></div>
            <div><label style={G.lbl}>Parentesco</label><input style={G.inp} placeholder="Mãe" value={data.emergency_relation} onChange={e => f('emergency_relation', e.target.value)} /></div>
            <div><label style={G.lbl}>Telefone</label><input style={G.inp} placeholder="(11) 99999-9999" value={data.emergency_phone} onChange={e => f('emergency_phone', e.target.value)} /></div>
          </div>

          <Sec t="Contrato & Pagamento" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={G.lbl}>Veículo Designado</label>
              <select style={G.inp} value={data.vehicle_id} onChange={e => f('vehicle_id', e.target.value)}>
                <option value="">Sem veículo</option>
                {vOpts.map(v => <option key={v.id} value={v.id}>{v.brand} {v.model} — {v.plate}</option>)}
              </select>
            </div>
            <div><label style={G.lbl}>Aluguel Semanal (R$)</label><input type="number" style={G.inp} value={data.rent_weekly} onChange={e => f('rent_weekly', Number(e.target.value))} /></div>
            <div><label style={G.lbl}>Caução (R$)</label><input type="number" style={G.inp} value={data.deposits} onChange={e => f('deposits', Number(e.target.value))} /></div>
            <div>
              <label style={G.lbl}>Método de Pagamento</label>
              <select style={G.inp} value={data.payment_method} onChange={e => f('payment_method', e.target.value)}>{['Pix','Dinheiro','Transferência'].map(m => <option key={m}>{m}</option>)}</select>
            </div>
            <div>
              <label style={G.lbl}>Dia de Vencimento</label>
              <select style={G.inp} value={data.payment_day} onChange={e => f('payment_day', e.target.value)}>
                {['segunda-feira','terça-feira','quarta-feira','quinta-feira','sexta-feira','sábado'].map(d => <option key={d}>{d}</option>)}
              </select>
            </div>
            <div><label style={G.lbl}>Chave Pix</label><input style={G.inp} placeholder="CPF ou e-mail" value={data.pix_key} onChange={e => f('pix_key', e.target.value)} /></div>
          </div>

          <Sec t="Observações" />
          <textarea style={{ ...G.inp, minHeight: 64, resize: 'vertical', marginBottom: 28 }} placeholder="Observações internas..." value={data.notes} onChange={e => f('notes', e.target.value)} />

          {error && <div style={{ color: '#EF4444', fontSize: 13, marginBottom: 16, fontWeight: 700 }}>⚠ {error}</div>}

          <div style={{ display: 'flex', gap: 12 }}>
            <button style={{ ...G.btn(true), flex: 1, height: 52, justifyContent: 'center' }} onClick={onSave} disabled={saving}>
              {saving ? 'SALVANDO...' : 'CONFIRMAR DADOS'}
            </button>
            <button style={{ ...G.btn(false), flex: 1, height: 52, justifyContent: 'center' }} onClick={onCancel}>CANCELAR</button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="page" style={{ background: '#F8FAFB', minHeight: '100vh', padding: '24px 0' }}>

      {/* ── Header & Search ── */}
      <div style={{ marginBottom: 48, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
        <h2 style={{ fontSize: 32, fontWeight: 900, color: '#102A57', letterSpacing: '-1.5px', margin: 0 }}>Locatários</h2>
        <p style={{ color: '#64748B', fontWeight: 600, marginTop: 4, fontSize: 16 }}>Gestão de contratos, CRM e análise de risco</p>

        <div style={{ display: 'flex', gap: 16, marginTop: 32, width: '100%', justifyContent: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', width: '100%', maxWidth: 400 }}>
            <Search size={20} style={{ position: 'absolute', left: 20, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
            <input
              placeholder="Buscar por nome, CPF ou telefone..."
              style={{ ...S.inp, height: 52, paddingLeft: 56, borderRadius: 999, background: '#FFF', border: '1.5px solid #E2E8F0', fontSize: 15 }}
              value={search} onChange={e => setSearch(e.target.value)}
            />
          </div>
          <button style={{ ...G.btn(), height: 52 }} onClick={copyOnboardingLink}>
            {copiedId === 'onboarding' ? <CheckCircle2 size={18} color="#10B981" /> : <Share2 size={18} />}
            PRÉ-CADASTRO
          </button>
          <button style={{ ...G.btn(), height: 52 }} onClick={() => exportCSV('locatarios.csv', ['Nome', 'CPF', 'Telefone', 'Status', 'Veículo', 'Aluguel/Sem'], rows.map(r => [r.name, r.cpf || '—', r.phone || '—', r.status, r.vehicles?.plate || '—', r.rent_weekly]))}><Download size={18} /> EXPORTAR</button>
          <button style={{ ...G.btn(true), height: 52 }} onClick={() => setShowAdd(true)}><Plus size={18} /> NOVO LOCATÁRIO</button>
        </div>
      </div>

      {/* ── FILA DE CANDIDATURAS (Pré-cadastros pendentes) ── */}
      {pendentes.length > 0 && (
        <div style={{ marginBottom: 48 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 900, color: '#F59E0B', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>Novas Candidaturas</h3>
            <span style={{ background: '#F59E0B', color: '#FFF', padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 900 }}>{pendentes.length}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 20 }}>
            {pendentes.map(t => (
              <div key={t.id} style={{ ...G.card, border: '1px solid #FEF3C7', background: '#FFFDF7' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                    <div style={{ width: 44, height: 44, borderRadius: 14, background: '#FEF3C7', color: '#B45309', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 18 }}>{t.name.charAt(0)}</div>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: '#102A57' }}>{t.name}</div>
                      <div style={{ fontSize: 12, color: '#B45309', fontWeight: 700 }}>{t.app_used || 'App não informado'} {t.app_rating ? `⭐ ${t.app_rating}` : ''}</div>
                      {t.phone && <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600 }}>{t.phone}</div>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexDirection: 'column' }}>
                    <button style={{ ...G.btn(true), height: 36, padding: '0 16px', fontSize: 11 }} onClick={() => { setApprovalTenant(t); setApprovalData({ vehicle_id: '', rent_weekly: 400, payment_day: 'segunda-feira', deposits: 0 }); setShowApproval(true); }}>ANALISAR</button>
                    <button style={{ ...G.btn(false), height: 36, padding: '0 12px', fontSize: 11 }} onClick={() => openEdit(t)}>EDITAR</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── BASE ATIVA ── */}
      <h3 style={{ fontSize: 14, fontWeight: 900, color: '#102A57', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 24 }}>
        Base Ativa <span style={{ color: '#5B58EC', marginLeft: 8 }}>{ativos.length}</span>
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 24 }}>
        {ativos.length === 0 && (
          <div style={{ ...G.card, textAlign: 'center', padding: 48, gridColumn: '1/-1' }}>
            <p style={{ color: '#94A3B8', fontWeight: 600 }}>Nenhum locatário ativo encontrado.</p>
            <button style={{ ...G.btn(true), margin: '16px auto 0', justifyContent: 'center' }} onClick={() => setShowAdd(true)}><Plus size={18} /> Cadastrar primeiro</button>
          </div>
        )}
        {ativos.map(t => {
          const payments = t.payments ?? [];
          const pendCount = payments.filter(p => !p.paid_status).length;
          const isLate = pendCount > 0;
          const veh = t.vehicles;
          return (
            <div key={t.id}
              style={{ ...G.card, border: isLate ? '2px solid #EF4444' : t.blacklisted ? '2px solid #F59E0B' : '1px solid #F1F5F9', cursor: 'pointer' }}
              onClick={() => setSelectedTenant(t)}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 12px 30px rgba(16,42,87,0.08)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = G.card.boxShadow; }}
            >
              {/* Header do card */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                  <div style={{ width: 52, height: 52, borderRadius: 16, background: isLate ? '#FFF1F1' : '#F3F2FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 900, color: isLate ? '#EF4444' : '#5B58EC', flexShrink: 0 }}>
                    {t.name.charAt(0)}
                  </div>
                  <div>
                    <h4 style={{ fontSize: 16, fontWeight: 900, color: '#102A57', margin: 0 }}>{t.name}</h4>
                    <div style={{ fontSize: 12, color: '#94A3B8', fontWeight: 600, marginTop: 2 }}>
                      {t.app_used || '—'} {t.app_rating ? `⭐ ${t.app_rating}` : ''}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
                  <span style={G.badge(isLate ? '#EF4444' : '#10B981', isLate ? '#FFF1F1' : '#F0FDF4')}>
                    {isLate ? `${pendCount} Pend.` : 'Em dia'}
                  </span>
                  {t.blacklisted && <span style={G.badge('#B45309', '#FEF3C7')}>BLACKLIST</span>}
                </div>
              </div>

              {/* Veículo */}
              {veh && (
                <div style={{ background: '#F8FAFB', borderRadius: 12, padding: '10px 14px', marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#102A57' }}><Car size={12} style={{ marginRight: 6, verticalAlign: 'middle' }} />{veh.brand} {veh.model}</span>
                  <span style={{ fontSize: 12, color: '#94A3B8', fontWeight: 700 }}>{veh.plate}</span>
                </div>
              )}

              {/* Status Telegram */}
              {t.telegram_username && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, padding: '6px 10px', borderRadius: 10, background: '#F8FAFB' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: t.telegram_chat_id ? '#10B981' : '#CBD5E1', flexShrink: 0 }} />
                  <span style={{ fontSize: 11, color: t.telegram_chat_id ? '#065F46' : '#94A3B8', fontWeight: 700 }}>
                    <MessageCircle size={11} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                    {t.telegram_chat_id ? 'Telegram vinculado' : `@${t.telegram_username} — pendente`}
                  </span>
                </div>
              )}

              {/* Métricas */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                <div style={{ background: '#F8FAFB', borderRadius: 12, padding: '10px 12px' }}>
                  <div style={G.statLabel}>Semanal</div>
                  <div style={{ fontSize: 16, fontWeight: 900, color: '#102A57' }}>R$ {t.rent_weekly || 0}</div>
                </div>
                <div style={{ background: '#F8FAFB', borderRadius: 12, padding: '10px 12px' }}>
                  <div style={G.statLabel}>Vencimento</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#102A57', textTransform: 'capitalize' }}>{t.payment_day?.split('-')[0]}</div>
                </div>
              </div>

              {/* Ações rápidas */}
              <div style={{ display: 'flex', gap: 8 }} onClick={e => e.stopPropagation()}>
                <button title="Gerar PDF" style={{ ...G.btn(false), flex: 1, height: 38, fontSize: 11, justifyContent: 'center', padding: '0 8px' }} onClick={() => generateContractPDF(t, veh)}>
                  <FileText size={14} /> PDF
                </button>
                <button title="Link do Portal" style={{ ...G.btn(false), flex: 1, height: 38, fontSize: 11, justifyContent: 'center', padding: '0 8px' }} onClick={() => copyPortalLink(t.id)}>
                  {copiedId === `portal-${t.id}` ? <CheckCircle2 size={14} color="#10B981" /> : <Globe size={14} />}
                  PORTAL
                </button>
                {!t.telegram_chat_id && botUsername && (
                  <button title="Copiar link de vinculação Telegram" style={{ ...G.btn(false), height: 38, fontSize: 11, padding: '0 10px' }} onClick={() => copyTelegramLink(t.id)}>
                    {copiedId === `tg-${t.id}` ? <CheckCircle2 size={14} color="#10B981" /> : <Link size={14} />}
                  </button>
                )}
                <button title="Editar" style={{ ...G.btn(true), height: 38, padding: '0 14px' }} onClick={() => openEdit(t)}>
                  <Pencil size={14} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── CONTRATOS ENCERRADOS ── */}
      {encerrados.length > 0 && (
        <div style={{ marginTop: 48 }}>
          <h3 style={{ fontSize: 14, fontWeight: 900, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16 }}>Contratos Encerrados</h3>
          {encerrados.map(t => (
            <div key={t.id} style={{ ...G.card, marginBottom: 8, opacity: 0.6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 700, color: '#102A57', fontSize: 15 }}>{t.name}</div>
                <div style={{ fontSize: 12, color: '#94A3B8', fontWeight: 600 }}>CPF: {t.cpf ?? '—'} · {t.phone ?? '—'}</div>
              </div>
              <span style={G.badge('#64748B', '#F1F5F9')}>ENCERRADO</span>
            </div>
          ))}
        </div>
      )}

      {/* ── SLIDE PANEL — Perfil do Locatário ── */}
      {selectedTenant && (() => {
        const p = selectedTenant;
        const totalDue = (p.payments || []).filter(pay => !pay.paid_status).reduce((s, pay) => s + (pay.value_amount || 0), 0);
        return (
          <>
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(16,42,87,0.2)', backdropFilter: 'blur(8px)', zIndex: 300 }} onClick={() => setSelectedTenant(null)} />
            <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: '100%', maxWidth: 520, background: '#FFF', zIndex: 310, padding: 40, boxShadow: '-10px 0 40px rgba(0,0,0,0.1)', overflowY: 'auto', animation: 'slideIn .3s ease' }}>

              <button onClick={() => setSelectedTenant(null)} style={{ position: 'absolute', top: 28, right: 28, background: '#F8FAFB', border: 'none', borderRadius: '50%', width: 44, height: 44, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={20} color="#102A57" />
              </button>

              {/* Avatar + nome */}
              <div style={{ textAlign: 'center', marginBottom: 32 }}>
                <div style={{ width: 80, height: 80, borderRadius: 28, background: '#F3F2FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, fontWeight: 900, color: '#5B58EC', margin: '0 auto 16px' }}>{p.name.charAt(0)}</div>
                <h2 style={{ fontSize: 22, fontWeight: 900, color: '#102A57', margin: 0, letterSpacing: '-1px' }}>{p.name}</h2>
                <p style={{ color: '#94A3B8', fontWeight: 700, marginTop: 4, fontSize: 14 }}>{p.cpf || p.phone || '—'}</p>
                {p.app_used && <p style={{ color: '#5B58EC', fontWeight: 700, fontSize: 13, margin: '4px 0 0' }}>{p.app_used} {p.app_rating ? `⭐ ${p.app_rating}` : ''}</p>}
              </div>

              {/* Ações principais */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <button style={{ ...G.btn(false), height: 48, justifyContent: 'center' }} onClick={() => { setSelectedTenant(null); openEdit(p); }}><Pencil size={16} /> EDITAR</button>
                <button style={{ ...G.btn(false), height: 48, justifyContent: 'center' }} onClick={() => copyPortalLink(p.id)}><Globe size={16} /> PORTAL</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12, marginBottom: 32 }}>
                <button style={{ ...G.btn(true), height: 52, background: '#10B981', justifyContent: 'center' }} onClick={() => generateContractPDF(p, p.vehicles)}>
                  <FileText size={18} /> GERAR CONTRATO PDF
                </button>
                {!p.telegram_chat_id && botUsername && (
                  <button style={{ ...G.btn(false), height: 44, justifyContent: 'center', borderColor: '#5B58EC', color: '#5B58EC' }} onClick={() => copyTelegramLink(p.id)}>
                    <MessageCircle size={16} /> {copiedId === `tg-${p.id}` ? 'LINK COPIADO!' : 'VINCULAR TELEGRAM'}
                  </button>
                )}
                {!p.telegram_chat_id && !botUsername && (
                  <div style={{ height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#94A3B8', border: '1px dashed #E2E8F0', borderRadius: 10, padding: '0 12px' }}>
                    Configure seu bot em Motor IA
                  </div>
                )}
                <button style={{ ...G.btn(false), height: 44, justifyContent: 'center', borderColor: '#EF4444', color: '#EF4444' }} onClick={() => handleDelete(p.id, p.name)} disabled={actionLoading === p.id}>
                  <Trash2 size={16} /> {actionLoading === p.id ? 'EXCLUINDO...' : 'EXCLUIR LOCATÁRIO'}
                </button>
              </div>

              {/* Saldo Devedor */}
              <div style={{ ...G.card, border: totalDue > 0 ? '2px solid #EF4444' : '1.5px solid #10B981', background: totalDue > 0 ? '#FFF1F1' : '#F0FDF4', marginBottom: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={G.statLabel}>Saldo Devedor</div>
                  <span style={G.badge(totalDue > 0 ? '#EF4444' : '#10B981', totalDue > 0 ? '#FFF1F1' : '#F0FDF4')}>{totalDue > 0 ? 'Em Risco' : 'Saudável'}</span>
                </div>
                <div style={{ fontSize: 36, fontWeight: 900, color: totalDue > 0 ? '#EF4444' : '#102A57', letterSpacing: '-1.5px' }}>R$ {fmt(totalDue)}</div>
              </div>

              {/* Contrato & Veículo */}
              <h4 style={{ ...G.statLabel, marginBottom: 12 }}>Contrato & Veículo</h4>
              <div style={{ ...G.card, padding: 20, marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 48, height: 48, borderRadius: 14, background: '#F3F2FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Car size={22} color="#5B58EC" /></div>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: '#102A57' }}>{p.vehicles ? `${p.vehicles.brand} ${p.vehicles.model}` : 'Sem veículo'}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#94A3B8' }}>Placa: {p.vehicles?.plate || '—'} · R$ {p.rent_weekly}/sem · {p.payment_day?.split('-')[0]}</div>
                  </div>
                </div>
              </div>

              {/* Dados do motorista */}
              <h4 style={{ ...G.statLabel, marginBottom: 12 }}>Dados do Motorista</h4>
              <div style={{ ...G.card, padding: 20, marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  ['Telefone', p.phone], ['E-mail', p.email], ['CNH', p.cnh],
                  ['Telegram', p.telegram_username ? `@${p.telegram_username}` : null],
                  ['Endereço', p.address ? `${p.address}, ${p.bairro || ''} — ${p.cidade || ''}` : null],
                  ['Emergência', p.emergency_name ? `${p.emergency_name} (${p.emergency_relation}) · ${p.emergency_phone}` : null],
                ].filter(([, v]) => v).map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase' }}>{k}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#102A57', maxWidth: '60%', textAlign: 'right' }}>{v}</span>
                  </div>
                ))}
              </div>

              {/* Cobranças recentes */}
              <h4 style={{ ...G.statLabel, marginBottom: 12 }}>Cobranças Recentes</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {(p.payments || []).length === 0 && <p style={{ color: '#94A3B8', fontSize: 13, fontWeight: 600 }}>Nenhuma cobrança registrada.</p>}
                {(p.payments || []).slice(0, 6).map(pay => (
                  <div key={pay.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', borderRadius: 14, background: '#F8FAFB', border: `1px solid ${pay.paid_status ? '#E2E8F0' : '#FECACA'}` }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: '#102A57' }}>R$ {fmt(pay.value_amount)}</div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8' }}>{ptDate(pay.due_date)}</div>
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 900, color: pay.paid_status ? '#10B981' : '#EF4444', background: pay.paid_status ? '#F0FDF4' : '#FFF1F1', padding: '4px 10px', borderRadius: 8 }}>
                      {pay.paid_status ? 'RECEBIDO' : 'PENDENTE'}
                    </span>
                  </div>
                ))}
              </div>

              {p.notes && (
                <div style={{ marginTop: 24, ...G.card, background: '#FFFDF7', border: '1px solid #FEF3C7', padding: 18 }}>
                  <div style={{ ...G.statLabel, marginBottom: 6 }}>Observações</div>
                  <p style={{ fontSize: 13, color: '#92400E', fontWeight: 600, margin: 0, lineHeight: 1.6 }}>{p.notes}</p>
                </div>
              )}
            </div>
          </>
        );
      })()}

      {/* ── MODAL: Novo Locatário ── */}
      {showAdd && (
        <TenantForm
          data={nt} setData={setNt}
          onSave={handleAdd}
          onCancel={() => { setShowAdd(false); setNt(BLANK); setError(null); }}
          title="Novo Cadastro de Locatário"
          subtitle="Preencha os dados do motorista para criar o perfil completo."
          veiculos={vehicles}
        />
      )}

      {/* ── MODAL: Editar Locatário ── */}
      {showEdit && editTenant && (
        <TenantForm
          data={et} setData={setEt}
          onSave={handleUpdate}
          onCancel={() => { setShowEdit(false); setEditTenant(null); setError(null); }}
          title="Editar Perfil do Motorista"
          subtitle={`Atualizando dados de ${editTenant.name}`}
          veiculos={vehicles}
        />
      )}

      {/* ── MODAL: Aprovação de Candidatura ── */}
      {showApproval && (
        <div style={G.ovl} onClick={e => e.target === e.currentTarget && setShowApproval(false)}>
          <div style={{ ...G.mbox, maxWidth: 500 }}>
            <div style={{ textAlign: 'center', marginBottom: 32 }}>
              <div style={{ width: 64, height: 64, borderRadius: 20, background: '#FEF3C7', color: '#B45309', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}><UserCheck size={32} /></div>
              <h3 style={{ fontSize: 22, fontWeight: 900, color: '#102A57', margin: 0 }}>Aprovar Motorista</h3>
              <p style={{ color: '#64748B', fontWeight: 600, marginTop: 8 }}>Defina os termos do contrato para <strong>{approvalTenant?.name}</strong></p>
              {approvalTenant?.phone && <p style={{ color: '#94A3B8', fontSize: 13, margin: '4px 0 0' }}>{approvalTenant.phone}</p>}
            </div>

            <div style={{ display: 'grid', gap: 16 }}>
              <div>
                <label style={G.lbl}>Veículo Designado *</label>
                <select style={G.inp} value={approvalData.vehicle_id} onChange={e => setApprovalData(p => ({ ...p, vehicle_id: e.target.value }))}>
                  <option value="">Selecione um veículo disponível...</option>
                  {vehicles.map(v => <option key={v.id} value={v.id}>{v.brand} {v.model} ({v.plate})</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={G.lbl}>Aluguel Semanal (R$)</label>
                  <input type="number" style={G.inp} value={approvalData.rent_weekly} onChange={e => setApprovalData(p => ({ ...p, rent_weekly: Number(e.target.value) }))} />
                </div>
                <div>
                  <label style={G.lbl}>Caução (R$)</label>
                  <input type="number" style={G.inp} value={approvalData.deposits} onChange={e => setApprovalData(p => ({ ...p, deposits: Number(e.target.value) }))} />
                </div>
              </div>
              <div>
                <label style={G.lbl}>Dia de Vencimento</label>
                <select style={G.inp} value={approvalData.payment_day} onChange={e => setApprovalData(p => ({ ...p, payment_day: e.target.value }))}>
                  {['segunda-feira','terça-feira','quarta-feira','quinta-feira','sexta-feira','sábado'].map(d => <option key={d}>{d}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 32 }}>
              <button style={{ ...G.btn(true), flex: 1, height: 52, justifyContent: 'center' }} onClick={handleApprove} disabled={approvingSaving}>
                {approvingSaving ? 'ATIVANDO...' : 'ATIVAR CONTRATO'}
              </button>
              <button style={{ ...G.btn(false), flex: 1, height: 52, justifyContent: 'center' }} onClick={() => setShowApproval(false)}>CANCELAR</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
      `}</style>
    </div>
  );
}
