import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, X, FileText, Upload, Check, ChevronLeft, ChevronRight } from 'lucide-react';

const BLANK = {
  tenant_id: '', value_amount: 400, due_date: '', payment_method: 'Pix', week_label: '',
};

const PASTEL = {
  '#22c55e': ['rgba(143,156,130,0.18)', '#4A5441'],
  '#ef4444': ['#E6C6C6',               '#7A3B3B'],
  '#f59e0b': ['#FFF0C2',               '#7A5800'],
  '#6366f1': ['#ECEEFF',               '#3B3E9A'],
};

const S = {
  card: { background: '#fff', borderRadius: 24, padding: 24, boxShadow: 'none', border: '1px solid #EBEBEB' },
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
  mbox: { background: '#fff', borderRadius: 28, padding: 32, width: '100%', maxWidth: 500, maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.08)', border: '1px solid #EBEBEB' },
  row:  { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', borderBottom: '1px solid #F6F6F4' },
};

function daysUntil(d) { return Math.ceil((new Date(d) - new Date()) / 86400000); }
function ptDate(d) { if (!d) return '—'; const [y,m,dd] = d.split('-'); return `${dd}/${m}/${y}`; }
function fmt(v) { return Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 }); }

function weekRange() {
  const now  = new Date();
  const day  = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const mon  = new Date(now); mon.setDate(now.getDate() + diff); mon.setHours(0,0,0,0);
  const sun  = new Date(mon); sun.setDate(mon.getDate() + 6);   sun.setHours(23,59,59,999);
  return [mon, sun];
}

function monthRange() {
  const now   = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  return [start, end];
}

const PillTabs = ({ tabs, active, onChange, style }) => (
  <div style={{ background: '#F6F6F4', borderRadius: 999, padding: 4, display: 'inline-flex', gap: 2, ...style }}>
    {tabs.map(([id, l]) => (
      <button key={id} onClick={() => onChange(id)} style={{
        padding: '7px 18px', borderRadius: 999, border: 'none',
        background: active === id ? '#fff' : 'transparent',
        color: active === id ? '#111827' : '#9CA3AF',
        boxShadow: active === id ? '0 1px 3px rgba(0,0,0,0.10)' : 'none',
        cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 600,
        transition: 'all .15s',
      }}>{l}</button>
    ))}
  </div>
);

/* ── Lightbox ── */
function Lightbox({ url, onClose }) {
  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const isImage = /\.(jpe?g|png|gif|webp|heic)(\?|$)/i.test(url);

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.95)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}
    >
      {isImage ? (
        <img
          src={url} alt="comprovante"
          onClick={e => e.stopPropagation()}
          style={{ maxWidth: '90vw', maxHeight: '88vh', objectFit: 'contain', borderRadius: 12 }}
        />
      ) : (
        <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 20, padding: 32, textAlign: 'center' }}>
          <FileText size={40} style={{ color: '#9CA3AF', marginBottom: 12 }} />
          <div style={{ fontSize: 14, color: '#111827', marginBottom: 16 }}>Comprovante em PDF</div>
          <a href={url} target="_blank" rel="noreferrer"
            style={{ ...S.btn('p'), justifyContent: 'center', textDecoration: 'none', display: 'inline-flex' }}>
            Abrir PDF
          </a>
        </div>
      )}
      <button onClick={onClose} style={{ position: 'absolute', top: 18, right: 18, background: 'rgba(255,255,255,.15)', border: 'none', color: '#fff', width: 38, height: 38, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <X size={16} />
      </button>
    </div>
  );
}

/* ── Slide-over de extrato ── */
function TenantExtrato({ tenant, payments, onClose, onReceiptUpdate }) {
  const tenantPayments = payments.filter(p => p.tenant_id === tenant.id);
  const paidPayments   = tenantPayments.filter(p => p.paid_status && p.paid_date);

  const [wStart, wEnd] = weekRange();
  const [mStart, mEnd] = monthRange();

  const weekRev = paidPayments
    .filter(p => { const d = new Date(p.paid_date); return d >= wStart && d <= wEnd; })
    .reduce((s, p) => s + (p.value_amount || 0), 0);

  const monthRev = paidPayments
    .filter(p => { const d = new Date(p.paid_date); return d >= mStart && d <= mEnd; })
    .reduce((s, p) => s + (p.value_amount || 0), 0);

  const totalPaid    = paidPayments.reduce((s, p) => s + (p.value_amount || 0), 0);
  const totalPending = tenantPayments.filter(p => !p.paid_status).reduce((s, p) => s + (p.value_amount || 0), 0);

  const [uploadingId, setUploadingId] = useState(null);
  const [lightboxUrl, setLightboxUrl] = useState(null);
  const [checkoutId, setCheckoutId]   = useState(null); // payment_id em processamento
  const fileRefs = useRef({});

  const handleStripeCheckout = async (paymentId) => {
    setCheckoutId(paymentId);
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: { payment_id: paymentId },
      });
      if (error || !data?.url) throw new Error(error?.message ?? 'Sem URL de pagamento');
      window.location.href = data.url;
    } catch (err) {
      console.error('[stripe]', err);
      alert('Erro ao abrir pagamento: ' + err.message);
    } finally {
      setCheckoutId(null);
    }
  };

  const handleReceiptUpload = useCallback(async (paymentId, file) => {
    if (!file) return;
    setUploadingId(paymentId);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const ext  = file.name.split('.').pop();
      const path = `${user.id}/${paymentId}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('payment-receipts')
        .upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage
        .from('payment-receipts')
        .getPublicUrl(path);
      const { error: dbErr } = await supabase
        .from('payments')
        .update({ receipt_url: publicUrl })
        .eq('id', paymentId);
      if (dbErr) throw dbErr;
      onReceiptUpdate(paymentId, publicUrl);
    } catch (err) {
      console.error('Upload erro:', err);
    } finally {
      setUploadingId(null);
    }
  }, [onReceiptUpdate]);

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.15)', backdropFilter: 'blur(8px)', zIndex: 290 }} />

      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: '100%', maxWidth: 480,
        background: '#fff',
        borderLeft: '1px solid #EBEBEB',
        zIndex: 300,
        display: 'flex', flexDirection: 'column',
        animation: 'slideIn .22s cubic-bezier(.4,0,.2,1)',
      }}>
        {/* Cabeçalho */}
        <div style={{ padding: '28px 28px 20px', borderBottom: '1px solid #F6F6F4', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 9, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '.12em', fontWeight: 600, marginBottom: 6 }}>Extrato do Locatário</div>
              <div style={{ fontSize: 26, fontWeight: 700, color: '#111827', letterSpacing: '-1px', lineHeight: 1.1 }}>{tenant.name}</div>
            </div>
            <button onClick={onClose} style={{ background: '#F6F6F4', border: 'none', borderRadius: '50%', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, marginLeft: 16 }}>
              <X size={16} color="#6B7280" />
            </button>
          </div>

          {/* Métricas */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 20 }}>
            {[
              { l: 'Esta semana',    v: `R$ ${fmt(weekRev)}`   },
              { l: 'Este mês',       v: `R$ ${fmt(monthRev)}`  },
              { l: 'Total recebido', v: `R$ ${fmt(totalPaid)}` },
              { l: 'Pendente',       v: `R$ ${fmt(totalPending)}`, warn: totalPending > 0 },
            ].map((m, i) => (
              <div key={i} style={{ background: '#F6F6F4', borderRadius: 16, padding: '14px 16px' }}>
                <div style={{ fontSize: 10, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '.1em', fontWeight: 600, marginBottom: 6 }}>{m.l}</div>
                <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-1px', color: m.warn ? '#7A3B3B' : '#111827', lineHeight: 1 }}>{m.v}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Lista */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 28px 28px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '.1em', padding: '20px 0 12px' }}>
            Histórico · {tenantPayments.length} registros
          </div>

          {tenantPayments.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9CA3AF', fontSize: 13 }}>
              Nenhum pagamento registrado.
            </div>
          ) : (
            tenantPayments.map((p, i) => {
              const isLast = i === tenantPayments.length - 1;
              const isLate = !p.paid_status && p.due_date && daysUntil(p.due_date) < 0;
              const hasReceipt = !!p.receipt_url;
              const isUploading = uploadingId === p.id;

              return (
                <div key={p.id} style={{
                  padding: '14px 0',
                  borderBottom: isLast ? 'none' : '1px solid #F6F6F4',
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', marginBottom: 4 }}>
                        {p.week_label || 'Cobrança'}
                      </div>
                      <div style={{ fontSize: 11, color: '#9CA3AF', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {p.due_date && (
                          <span style={{ color: isLate ? '#7A3B3B' : '#9CA3AF' }}>
                            Vence {ptDate(p.due_date)}{isLate ? ' · atrasado' : ''}
                          </span>
                        )}
                        {p.paid_status && p.paid_date && (
                          <span style={{ color: '#4A5441' }}>Pago em {ptDate(p.paid_date)}</span>
                        )}
                        <span>{p.payment_method}</span>
                      </div>
                    </div>

                    {/* Valor + badge */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>
                        R$ {fmt(p.value_amount)}
                      </div>
                      <div style={S.bdg(p.paid_status ? '#22c55e' : isLate ? '#ef4444' : '#f59e0b')}>
                        {p.paid_status ? 'Pago' : isLate ? 'Atrasado' : 'Pendente'}
                      </div>
                    </div>
                  </div>

                  {/* Pagar Agora — apenas para pendentes */}
                  {!p.paid_status && (
                    <div style={{ marginTop: 10 }}>
                      <button
                        onClick={() => handleStripeCheckout(p.id)}
                        disabled={checkoutId === p.id}
                        style={{
                          width: '100%',
                          padding: '10px 16px',
                          borderRadius: 12,
                          border: 'none',
                          background: checkoutId === p.id ? '#E8E8E6' : '#FFC524',
                          color: checkoutId === p.id ? '#9CA3AF' : '#111827',
                          fontFamily: 'inherit',
                          fontSize: 13,
                          fontWeight: 700,
                          cursor: checkoutId === p.id ? 'not-allowed' : 'pointer',
                          letterSpacing: '-0.2px',
                          transition: 'background .15s',
                        }}
                      >
                        {checkoutId === p.id ? 'Abrindo pagamento...' : `Pagar R$ ${fmt(p.value_amount)}`}
                      </button>
                    </div>
                  )}

                  {/* Comprovante */}
                  <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                    {/* Input de arquivo oculto */}
                    <input
                      ref={el => { if (el) fileRefs.current[p.id] = el; }}
                      type="file"
                      accept="image/*,application/pdf"
                      hidden
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) handleReceiptUpload(p.id, file);
                        e.target.value = '';
                      }}
                    />

                    {hasReceipt ? (
                      /* Botão ver comprovante */
                      <button
                        onClick={() => setLightboxUrl(p.receipt_url)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 6,
                          padding: '6px 14px', borderRadius: 999,
                          border: '1px solid rgba(143,156,130,0.4)',
                          background: 'rgba(143,156,130,0.10)',
                          color: '#4A5441', fontFamily: 'inherit', fontSize: 12,
                          fontWeight: 600, cursor: 'pointer',
                        }}
                      >
                        <Check size={12} strokeWidth={2.5} />
                        Ver comprovante
                      </button>
                    ) : (
                      /* Botão anexar */
                      <button
                        onClick={() => fileRefs.current[p.id]?.click()}
                        disabled={isUploading}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 6,
                          padding: '6px 14px', borderRadius: 999,
                          border: '1.5px dashed #D1D5DB',
                          background: 'transparent',
                          color: isUploading ? '#9CA3AF' : '#6B7280',
                          fontFamily: 'inherit', fontSize: 12,
                          fontWeight: 500, cursor: isUploading ? 'not-allowed' : 'pointer',
                          transition: 'border-color .15s, color .15s',
                        }}
                        onMouseEnter={e => { if (!isUploading) { e.currentTarget.style.borderColor = '#111827'; e.currentTarget.style.color = '#111827'; } }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = '#D1D5DB'; e.currentTarget.style.color = isUploading ? '#9CA3AF' : '#6B7280'; }}
                      >
                        {isUploading
                          ? <><Upload size={12} style={{ animation: 'spin .8s linear infinite' }} /> Enviando...</>
                          : <><Plus size={12} /> Anexar comprovante</>
                        }
                      </button>
                    )}

                    {/* Trocar comprovante (quando já existe) */}
                    {hasReceipt && (
                      <button
                        onClick={() => fileRefs.current[p.id]?.click()}
                        disabled={isUploading}
                        title="Substituir comprovante"
                        style={{ background: 'none', border: 'none', color: '#9CA3AF', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}
                      >
                        <Upload size={13} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Lightbox de comprovante */}
      {lightboxUrl && <Lightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />}

      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </>
  );
}

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
  const [activationModal, setActivationModal] = useState(null);
  const [extrato, setExtrato]   = useState(null);

  const BOT_USERNAME   = 'Myfrot_bot';
  const activationLink = (tenantId) => `https://t.me/${BOT_USERNAME}?start=${tenantId}`;

  const load = () => {
    setLoading(true);
    Promise.all([
      supabase.from('payments')
        .select('*, tenants(name, phone, telegram_username, telegram_chat_id)')
        .order('due_date', { ascending: false }),
      supabase.from('tenants').select('id, name').eq('status', 'ativo'),
    ]).then(([{ data: pays }, { data: tens }]) => {
      setRows(pays ?? []);
      setTenants(tens ?? []);
      setLoading(false);
    });
  };

  useEffect(() => { load(); }, []);

  const showToast = (msg, color = '#8F9C82') => {
    setToast({ msg, color });
    setTimeout(() => setToast(null), 3000);
  };

  /* Atualiza receipt_url localmente após upload no extrato */
  const handleReceiptUpdate = useCallback((paymentId, url) => {
    setRows(r => r.map(p => p.id === paymentId ? { ...p, receipt_url: url } : p));
  }, []);

  const sendBilling = async (p) => {
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
      showToast(data?.error ?? fnErr?.message ?? 'Erro desconhecido', '#E6C6C6');
    } else {
      showToast('Cobrança enviada');
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
      client_id: user.id, tenant_id: np.tenant_id, value_amount: np.value_amount,
      due_date: np.due_date || null, payment_method: np.payment_method,
      week_label: np.week_label || null, paid_status: false,
    });
    setSaving(false);
    if (err) { setError(err.message); return; }
    setShowAdd(false); setNp(BLANK); load();
  };

  if (loading) return <div className="loading"><div className="spinner" /> Carregando...</div>;

  const filtered     = rows.filter(r => filter === 'all' || (filter === 'pending' ? !r.paid_status : r.paid_status));
  const totalPending = rows.filter(r => !r.paid_status).reduce((s, r) => s + (r.value_amount || 0), 0);
  const totalPaid    = rows.filter(r =>  r.paid_status).reduce((s, r) => s + (r.value_amount || 0), 0);
  const overdueCount = rows.filter(r => !r.paid_status && r.due_date && daysUntil(r.due_date) < 0).length;

  return (
    <div className="page">
      {toast && (
        <div style={{ position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)', background: toast.color, color: '#fff', padding: '10px 22px', borderRadius: 999, fontSize: 14, fontWeight: 600, zIndex: 999, boxShadow: '0 4px 20px rgba(0,0,0,.12)', pointerEvents: 'none' }}>
          {toast.msg}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
        <button style={S.btn()} onClick={() => setShowAdd(true)}><Plus size={14} /> Nova Cobrança</button>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(175px,1fr))', gap: 12, marginBottom: 24 }}>
        {[
          { l: 'Pendente',  v: `R$ ${fmt(totalPending)}` },
          { l: 'Recebido',  v: `R$ ${fmt(totalPaid)}`    },
          { l: 'Em atraso', v: overdueCount               },
          { l: 'Total',     v: rows.length                },
        ].map((s, i) => (
          <div key={i} style={{ background: '#fff', borderRadius: 24, padding: '18px 20px', border: '1px solid #EBEBEB' }}>
            <div style={{ fontSize: 36, fontWeight: 700, color: '#111827', letterSpacing: '-2px', lineHeight: 1, marginBottom: 6 }}>{s.v}</div>
            <div style={{ fontSize: 10, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '.1em', fontWeight: 600 }}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div style={{ marginBottom: 16 }}>
        <PillTabs
          tabs={[['all','Todos'],['pending','Pendentes'],['paid','Pagos']]}
          active={filter}
          onChange={setFilter}
        />
      </div>

      {/* Lista */}
      <div style={S.card}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9CA3AF' }}>Nenhum pagamento encontrado.</div>
        ) : (
          filtered.map(p => {
            const days   = p.due_date ? daysUntil(p.due_date) : null;
            const isLate = !p.paid_status && days !== null && days < 0;
            return (
              <div key={p.id} style={S.row}>
                {/* Área clicável — abre extrato */}
                <div
                  style={{ flex: 1, cursor: 'pointer', minWidth: 0 }}
                  onClick={() => setExtrato({ id: p.tenant_id, name: p.tenants?.name ?? '—' })}
                >
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#111827', display: 'flex', alignItems: 'center', gap: 6 }}>
                    {p.tenants?.name ?? '—'}
                    {p.tenants?.telegram_username && (
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: p.tenants?.telegram_chat_id ? '#8F9C82' : '#D1D5DB', flexShrink: 0, display: 'inline-block' }} />
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>
                    {p.week_label ?? '—'}
                    {p.due_date && (
                      <span style={{ color: isLate ? '#7A3B3B' : days < 3 ? '#7A5800' : '#9CA3AF', marginLeft: 8 }}>
                        · Vence {new Date(p.due_date + 'T00:00:00').toLocaleDateString('pt-BR')}
                        {isLate && ` (${Math.abs(days)}d atraso)`}
                      </span>
                    )}
                  </div>
                </div>

                {/* Ações */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, color: p.paid_status ? '#4A5441' : '#7A3B3B' }}>
                    R$ {fmt(p.value_amount)}
                  </div>
                  <div style={S.bdg(p.paid_status ? '#22c55e' : '#ef4444')}>
                    {p.paid_status ? 'Pago' : 'Pendente'}
                  </div>
                  {/* Indicador de comprovante */}
                  {p.receipt_url && (
                    <span title="Comprovante anexado" style={{ display: 'flex', alignItems: 'center' }}>
                      <FileText size={13} color="#8F9C82" />
                    </span>
                  )}
                  {isLate && p.tenants?.telegram_username && (
                    <button
                      style={{ padding: '5px 12px', borderRadius: 999, border: `1px ${p.tenants?.telegram_chat_id ? 'solid' : 'dashed'} #E8E8E6`, background: '#F6F6F4', color: '#6B7280', fontFamily: 'inherit', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', ...(sendingIds.has(p.id) ? { opacity: 0.5, cursor: 'not-allowed' } : {}) }}
                      onClick={() => sendBilling(p)}
                      disabled={sendingIds.has(p.id)}
                    >
                      {sendingIds.has(p.id) ? 'Enviando...' : p.tenants?.telegram_chat_id ? 'Cobrar' : 'Ativar'}
                    </button>
                  )}
                  <button style={{ ...S.btn(p.paid_status ? 'g' : 's'), padding: '5px 14px', fontSize: 12 }} onClick={() => togglePaid(p.id, p.paid_status)}>
                    {p.paid_status ? 'Desfazer' : 'Pago'}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Extrato */}
      {extrato && (
        <TenantExtrato
          tenant={extrato}
          payments={rows}
          onClose={() => setExtrato(null)}
          onReceiptUpdate={handleReceiptUpdate}
        />
      )}

      {/* Modal Ativação Telegram */}
      {activationModal && (
        <div style={S.ovl} onClick={e => { if (e.target === e.currentTarget) setActivationModal(null); }}>
          <div style={{ ...S.mbox, maxWidth: 420 }}>
            <div style={{ fontSize: 16, fontWeight: 700, textAlign: 'center', marginBottom: 6, color: '#111827' }}>
              Telegram não vinculado
            </div>
            <div style={{ fontSize: 13, color: '#6B7280', textAlign: 'center', marginBottom: 20 }}>
              <b style={{ color: '#111827' }}>{activationModal.name}</b> ainda não ativou o bot.<br />
              Envie o link abaixo para ele clicar e vincular o perfil.
            </div>
            <div style={{ background: '#F6F6F4', borderRadius: 14, padding: '10px 14px', fontSize: 12, color: '#3B3E9A', wordBreak: 'break-all', marginBottom: 16 }}>
              {activationModal.link}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              <button style={{ ...S.btn('p'), justifyContent: 'center' }} onClick={() => { navigator.clipboard.writeText(activationModal.link); showToast('Link copiado'); }}>
                Copiar Link
              </button>
              {activationModal.phone && (
                <a
                  href={`https://wa.me/${activationModal.phone.replace(/\D/g, '')}?text=${encodeURIComponent(`Olá! Para receber notificações de cobrança, clique no link e ative o bot:\n${activationModal.link}`)}`}
                  target="_blank" rel="noreferrer"
                  style={{ ...S.btn('s'), justifyContent: 'center', textDecoration: 'none' }}
                >
                  Enviar pelo WhatsApp
                </a>
              )}
              <button style={{ ...S.btn('g'), justifyContent: 'center' }} onClick={() => setActivationModal(null)}>Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Nova Cobrança */}
      {showAdd && (
        <div style={S.ovl} onClick={e => { if (e.target === e.currentTarget) { setShowAdd(false); setError(null); } }}>
          <div style={S.mbox}>
            <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 20, color: '#111827' }}>Nova Cobrança</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={S.lbl}>Locatário *</label>
                <select style={S.inp} value={np.tenant_id} onChange={e => setNp(p => ({ ...p, tenant_id: e.target.value }))}>
                  <option value="">Selecione</option>
                  {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div><label style={S.lbl}>Valor R$</label><input style={S.inp} type="number" value={np.value_amount} onChange={e => setNp(p => ({ ...p, value_amount: Number(e.target.value) }))} /></div>
              <div><label style={S.lbl}>Vencimento</label><input style={S.inp} type="date" value={np.due_date} onChange={e => setNp(p => ({ ...p, due_date: e.target.value }))} /></div>
              <div><label style={S.lbl}>Semana / Referência</label><input style={S.inp} placeholder="Semana 01/03" value={np.week_label} onChange={e => setNp(p => ({ ...p, week_label: e.target.value }))} /></div>
              <div>
                <label style={S.lbl}>Método</label>
                <select style={S.inp} value={np.payment_method} onChange={e => setNp(p => ({ ...p, payment_method: e.target.value }))}>
                  {['Pix','Dinheiro','Transferência'].map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
            </div>
            {error && <div style={{ color: '#7A3B3B', fontSize: 13, marginBottom: 12 }}>{error}</div>}
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
