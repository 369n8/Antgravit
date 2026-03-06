import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const BLANK = {
  tenant_id: '', value_amount: 400, due_date: '', payment_method: 'Pix', week_label: '',
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
  mbox: { background: '#0f172a', border: '1px solid #334155', borderRadius: 20, padding: 24, width: '100%', maxWidth: 500, maxHeight: '92vh', overflowY: 'auto' },
  row:  { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #1e293b' },
};

function daysUntil(d) { return Math.ceil((new Date(d) - new Date()) / 86400000); }

export default function Payments() {
  const [rows, setRows]         = useState([]);
  const [tenants, setTenants]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState('all');
  const [showAdd, setShowAdd]   = useState(false);
  const [np, setNp]             = useState(BLANK);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState(null);
  const [sendingIds, setSendingIds] = useState(new Set());
  const [toast, setToast]       = useState(null);
  const [activationModal, setActivationModal] = useState(null); // { name, link, phone }

  const BOT_USERNAME = 'Myfrot_bot';
  const activationLink = (tenantId) => `https://t.me/${BOT_USERNAME}?start=${tenantId}`;

  const load = () => {
    setLoading(true);
    Promise.all([
      supabase.from('payments').select('*, tenants(name, phone, telegram_username, telegram_chat_id)').order('due_date', { ascending: false }),
      supabase.from('tenants').select('id, name').eq('status', 'ativo'),
    ]).then(([{ data: pays }, { data: tens }]) => {
      setRows(pays ?? []);
      setTenants(tens ?? []);
      setLoading(false);
    });
  };

  useEffect(() => { load(); }, []);

  const showToast = (msg, color = '#22c55e') => {
    setToast({ msg, color });
    setTimeout(() => setToast(null), 3000);
  };

  const sendBilling = async (p) => {
    // Se não tem chat_id vinculado, abrir modal de ativação em vez de tentar enviar
    if (!p.tenants?.telegram_chat_id) {
      setActivationModal({
        name:  p.tenants?.name ?? 'Locatário',
        link:  activationLink(p.tenant_id),
        phone: p.tenants?.phone ?? null,
      });
      return;
    }

    if (sendingIds.has(p.id)) return;
    setSendingIds(prev => new Set(prev).add(p.id));
    const { data, error: fnErr } = await supabase.functions.invoke('telegram-billing', {
      body: {
        client_name:        p.tenants?.name ?? 'Locatário',
        amount_due:         p.value_amount,
        telegram_chat_id:   p.tenants?.telegram_chat_id,
        telegram_username:  p.tenants?.telegram_username ?? '',
      },
    });
    setSendingIds(prev => { const s = new Set(prev); s.delete(p.id); return s; });
    if (fnErr || data?.ok === false) {
      const msg = data?.error ?? fnErr?.message ?? 'Erro desconhecido';
      showToast(`⚠ ${msg}`, '#ef4444');
    } else {
      showToast('Cobrança enviada ✓');
    }
  };

  const togglePaid = async (id, current) => {
    const update = { paid_status: !current };
    if (!current) update.paid_date = new Date().toISOString().slice(0, 10);
    else update.paid_date = null;
    await supabase.from('payments').update(update).eq('id', id);
    setRows(r => r.map(p => p.id === id ? { ...p, ...update } : p));
  };

  const handleAdd = async () => {
    if (!np.tenant_id) { setError('Selecione um locatário.'); return; }
    setSaving(true); setError(null);
    const { data: { user } } = await supabase.auth.getUser();
    const { error: err } = await supabase.from('payments').insert({
      client_id:      user.id,
      tenant_id:      np.tenant_id,
      value_amount:   np.value_amount,
      due_date:       np.due_date || null,
      payment_method: np.payment_method,
      week_label:     np.week_label || null,
      paid_status:    false,
    });
    setSaving(false);
    if (err) { setError(err.message); return; }
    setShowAdd(false); setNp(BLANK); load();
  };

  if (loading) return <div className="loading"><div className="spinner" /> Carregando...</div>;

  const filtered      = rows.filter(r => filter === 'all' || (filter === 'pending' ? !r.paid_status : r.paid_status));
  const totalPending  = rows.filter(r => !r.paid_status).reduce((s, r) => s + (r.value_amount || 0), 0);
  const totalPaid     = rows.filter(r =>  r.paid_status).reduce((s, r) => s + (r.value_amount || 0), 0);
  const overdueCount  = rows.filter(r => !r.paid_status && r.due_date && daysUntil(r.due_date) < 0).length;

  const btnCobrar = { padding: '5px 12px', borderRadius: 10, border: '1px solid #334155', background: '#1e293b', color: '#94a3b8', fontFamily: 'inherit', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' };

  return (
    <div style={{ padding: 24 }}>
      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)', background: toast.color, color: '#fff', padding: '10px 22px', borderRadius: 12, fontSize: 14, fontWeight: 600, zIndex: 999, boxShadow: '0 4px 24px rgba(0,0,0,.4)', pointerEvents: 'none' }}>
          {toast.msg}
        </div>
      )}
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>💰 Pagamentos</div>
        <button style={S.btn()} onClick={() => setShowAdd(true)}>+ Nova Cobrança</button>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(185px,1fr))', gap: 13, marginBottom: 20 }}>
        {[
          { l: 'Pendente',  v: `R$ ${totalPending.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, ac: '#ef4444' },
          { l: 'Recebido',  v: `R$ ${totalPaid.toLocaleString('pt-BR',    { minimumFractionDigits: 2 })}`, ac: '#22c55e' },
          { l: 'Em atraso', v: overdueCount,                                                               ac: '#f59e0b' },
          { l: 'Total',     v: rows.length,                                                                ac: '#6366f1' },
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
        {[['all', 'Todos'], ['pending', 'Pendentes'], ['paid', 'Pagos']].map(([f, l]) => (
          <button key={f} onClick={() => setFilter(f)} style={{ ...S.btn(filter === f ? 'p' : 'g'), padding: '6px 16px', fontSize: 12 }}>{l}</button>
        ))}
      </div>

      {/* Lista */}
      <div style={S.card}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b' }}>Nenhum pagamento encontrado.</div>
        ) : (
          filtered.map(p => {
            const days   = p.due_date ? daysUntil(p.due_date) : null;
            const isLate = !p.paid_status && days !== null && days < 0;
            return (
              <div key={p.id} style={S.row}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                    {p.tenants?.name ?? '—'}
                    {p.tenants?.telegram_username && (
                      <span
                        title={p.tenants?.telegram_chat_id ? 'Telegram vinculado' : 'Telegram pendente — clique em Cobrar para ativar'}
                        style={{ width: 8, height: 8, borderRadius: '50%', background: p.tenants?.telegram_chat_id ? '#229ED9' : '#475569', flexShrink: 0, display: 'inline-block' }}
                      />
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                    {p.week_label ?? '—'}
                    {p.due_date && (
                      <span style={{ color: isLate ? '#ef4444' : days < 3 ? '#f59e0b' : '#64748b', marginLeft: 8 }}>
                        • Vence {new Date(p.due_date).toLocaleDateString('pt-BR')}
                        {isLate && ` (${Math.abs(days)}d atraso)`}
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, color: p.paid_status ? '#22c55e' : '#ef4444' }}>
                    R$ {Number(p.value_amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                  <div style={S.bdg(p.paid_status ? '#22c55e' : '#ef4444')}>
                    {p.paid_status ? 'Pago' : 'Pendente'}
                  </div>
                  {isLate && p.tenants?.telegram_username && (
                    <button
                      style={{ ...btnCobrar, ...(sendingIds.has(p.id) ? { opacity: 0.5, cursor: 'not-allowed' } : {}), ...(!p.tenants?.telegram_chat_id ? { color: '#64748b', borderStyle: 'dashed' } : {}) }}
                      onClick={() => sendBilling(p)}
                      disabled={sendingIds.has(p.id)}
                      title={p.tenants?.telegram_chat_id ? 'Enviar cobrança via Telegram' : 'Telegram não vinculado — gerar link de ativação'}
                    >
                      {sendingIds.has(p.id) ? 'Enviando...' : p.tenants?.telegram_chat_id ? '📱 Cobrar' : '🔗 Ativar'}
                    </button>
                  )}
                  <button
                    style={{ ...S.btn(p.paid_status ? 'g' : 's'), padding: '5px 12px', fontSize: 12 }}
                    onClick={() => togglePaid(p.id, p.paid_status)}
                  >
                    {p.paid_status ? '↩ Desfazer' : '✓ Marcar Pago'}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal Ativação Telegram */}
      {activationModal && (
        <div style={S.ovl} onClick={e => { if (e.target === e.currentTarget) setActivationModal(null); }}>
          <div style={{ ...S.mbox, maxWidth: 420 }}>
            <div style={{ fontSize: 28, textAlign: 'center', marginBottom: 8 }}>🔗</div>
            <div style={{ fontSize: 16, fontWeight: 700, textAlign: 'center', marginBottom: 6 }}>
              Telegram não vinculado
            </div>
            <div style={{ fontSize: 13, color: '#64748b', textAlign: 'center', marginBottom: 20 }}>
              <b style={{ color: '#e2e8f0' }}>{activationModal.name}</b> ainda não ativou o bot.<br />
              Envie o link abaixo para ele clicar e vincular o perfil.
            </div>

            <div style={{ background: '#0a0f1e', border: '1px solid #334155', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: '#6366f1', wordBreak: 'break-all', marginBottom: 16 }}>
              {activationModal.link}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              <button
                style={{ ...S.btn('p'), justifyContent: 'center' }}
                onClick={() => { navigator.clipboard.writeText(activationModal.link); showToast('Link copiado ✓'); }}
              >
                📋 Copiar Link
              </button>
              {activationModal.phone && (
                <a
                  href={`https://wa.me/${activationModal.phone.replace(/\D/g, '')}?text=${encodeURIComponent(`Olá! Para receber notificações de cobrança, clique no link e ative o bot:\n${activationModal.link}`)}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ ...S.btn('s'), justifyContent: 'center', textDecoration: 'none' }}
                >
                  💬 Enviar pelo WhatsApp
                </a>
              )}
              <button style={{ ...S.btn('g'), justifyContent: 'center' }} onClick={() => setActivationModal(null)}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Nova Cobrança */}
      {showAdd && (
        <div style={S.ovl} onClick={e => { if (e.target === e.currentTarget) { setShowAdd(false); setError(null); } }}>
          <div style={S.mbox}>
            <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 16 }}>💰 Nova Cobrança</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={S.lbl}>Locatário *</label>
                <select style={S.inp} value={np.tenant_id} onChange={e => setNp(p => ({ ...p, tenant_id: e.target.value }))}>
                  <option value="">Selecione</option>
                  {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <label style={S.lbl}>Valor R$</label>
                <input style={S.inp} type="number" value={np.value_amount} onChange={e => setNp(p => ({ ...p, value_amount: Number(e.target.value) }))} />
              </div>
              <div>
                <label style={S.lbl}>Vencimento</label>
                <input style={S.inp} type="date" value={np.due_date} onChange={e => setNp(p => ({ ...p, due_date: e.target.value }))} />
              </div>
              <div>
                <label style={S.lbl}>Semana / Referência</label>
                <input style={S.inp} placeholder="Semana 01/03" value={np.week_label} onChange={e => setNp(p => ({ ...p, week_label: e.target.value }))} />
              </div>
              <div>
                <label style={S.lbl}>Método</label>
                <select style={S.inp} value={np.payment_method} onChange={e => setNp(p => ({ ...p, payment_method: e.target.value }))}>
                  {['Pix', 'Dinheiro', 'Transferência'].map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
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
