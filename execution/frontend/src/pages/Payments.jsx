import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { S, PillTabs, daysUntil, ptDate, fmt, weekRange, monthRange, exportCSV } from '../lib/shared';
import {
  Plus, X, FileText, Upload, Check, ChevronLeft,
  ChevronRight, Download, Search, Banknote,
  AlertCircle, TrendingUp, DollarSign, Clock, QrCode, Copy, CheckCircle2
} from 'lucide-react';
import { api } from '../services/api';

const BLANK = { tenant_id: '', value_amount: 400, due_date: '', payment_method: 'Pix', week_label: '' };

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

/* ── Lightbox ── */
function Lightbox({ url, onClose }) {
  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const isImage = /\.(jpe?g|png|gif|webp|heic)(\?|$)/i.test(url);
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(16,42,87,0.95)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)' }} onClick={onClose}>
      {isImage ? (
        <img src={url} alt="comprovante" onClick={e => e.stopPropagation()} style={{ maxWidth: '90vw', maxHeight: '88vh', objectFit: 'contain', borderRadius: 24, boxShadow: '0 20px 50px rgba(0,0,0,0.3)' }} />
      ) : (
        <div onClick={e => e.stopPropagation()} style={{ background: '#FFF', borderRadius: 32, padding: 48, textAlign: 'center', maxWidth: 400 }}>
          <FileText size={64} style={{ color: '#5B58EC', marginBottom: 20 }} />
          <h3 style={{ fontSize: 20, fontWeight: 900, color: '#102A57', marginBottom: 24 }}>Comprovante em PDF</h3>
          <a href={url} target="_blank" rel="noreferrer" style={{ ...G.btn(true), textDecoration: 'none', justifyContent: 'center' }}>ABRIR DOCUMENTO</a>
        </div>
      )}
      <button onClick={onClose} style={{ position: 'absolute', top: 32, right: 32, background: 'rgba(255,255,255,0.2)', border: 'none', color: '#FFF', width: 48, height: 48, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={24} /></button>
    </div>
  );
}

/* ── Extrato Slide-over ── */
function TenantExtrato({ tenant, payments, onClose, onReceiptUpdate }) {
  const tenantPayments = payments.filter(p => p.tenant_id === tenant.id);
  const paidPayments = tenantPayments.filter(p => p.paid_status && p.paid_date);
  const [wStart, wEnd] = weekRange();
  const [mStart, mEnd] = monthRange();
  const weekRev = paidPayments.filter(p => { const d = new Date(p.paid_date); return d >= wStart && d <= wEnd; }).reduce((s, p) => s + (p.value_amount || 0), 0);
  const monthRev = paidPayments.filter(p => { const d = new Date(p.paid_date); return d >= mStart && d <= mEnd; }).reduce((s, p) => s + (p.value_amount || 0), 0);
  const totalPaid = paidPayments.reduce((s, p) => s + (p.value_amount || 0), 0);
  const totalPending = tenantPayments.filter(p => !p.paid_status).reduce((s, p) => s + (p.value_amount || 0), 0);

  const [uploadingId, setUploadingId] = useState(null);
  const [lightboxUrl, setLightboxUrl] = useState(null);
  const [checkoutId, setCheckoutId] = useState(null);
  const fileRefs = useRef({});

  const handleStripeCheckout = async (paymentId) => {
    setCheckoutId(paymentId);
    try {
      const data = await api.createCheckoutSession(paymentId);
      if (!data?.url) throw new Error('Sem URL de pagamento');
      window.location.href = data.url;
    } catch (err) { alert('Erro ao abrir pagamento: ' + err.message); }
    finally { setCheckoutId(null); }
  };

  const handleReceiptUpload = useCallback(async (paymentId, file) => {
    if (!file) return;
    setUploadingId(paymentId);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const ext = file.name.split('.').pop();
      const path = `${user.id}/${paymentId}/${Date.now()}.${ext}`;
      await supabase.storage.from('payment-receipts').upload(path, file, { upsert: true });
      const { data: { publicUrl } } = supabase.storage.from('payment-receipts').getPublicUrl(path);
      await supabase.from('payments').update({ receipt_url: publicUrl }).eq('id', paymentId);
      onReceiptUpdate(paymentId, publicUrl);
    } catch (err) { console.error(err); }
    finally { setUploadingId(null); }
  }, [onReceiptUpdate]);

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(16,42,87,0.2)', backdropFilter: 'blur(8px)', zIndex: 300 }} />
      <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: '100%', maxWidth: 500, background: '#FFF', zIndex: 310, display: 'flex', flexDirection: 'column', boxShadow: '-10px 0 40px rgba(0,0,0,0.1)', animation: 'slideIn .3s ease' }}>
        <div style={{ padding: '40px 32px 24px', borderBottom: '1px solid #F1F5F9' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={G.statLabel}>Extrato Consolidado</div>
              <h2 style={{ fontSize: 28, fontWeight: 900, color: '#102A57', margin: '4px 0 0', letterSpacing: '-1px' }}>{tenant.name}</h2>
            </div>
            <button onClick={onClose} style={{ background: '#F8FAFB', border: 'none', borderRadius: '50%', width: 40, height: 40, cursor: 'pointer' }}><X size={20} color="#102A57" /></button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 32 }}>
            <div style={G.card}>
              <div style={G.statLabel}>Semana</div>
              <div style={G.statValue}>R$ {fmt(weekRev)}</div>
            </div>
            <div style={{ ...G.card, border: totalPending > 0 ? '1px solid #EF4444' : '1px solid #F1F5F9' }}>
              <div style={G.statLabel}>Em Aberto</div>
              <div style={{ ...G.statValue, color: totalPending > 0 ? '#EF4444' : '#102A57' }}>R$ {fmt(totalPending)}</div>
            </div>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '32px' }}>
          <h4 style={{ ...G.statLabel, marginBottom: 20 }}>Histórico de Lançamentos ({tenantPayments.length})</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {tenantPayments.map(p => {
              const isLate = !p.paid_status && daysUntil(p.due_date) < 0;
              return (
                <div key={p.id} style={{ ...G.card, padding: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: '#102A57' }}>{p.week_label || 'Cobrança'}</div>
                      <div style={{ fontSize: 12, color: '#94A3B8', fontWeight: 600, marginTop: 4 }}>Vencimento: {ptDate(p.due_date)}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 16, fontWeight: 900, color: p.paid_status ? '#10B981' : isLate ? '#EF4444' : '#102A57' }}>R$ {fmt(p.value_amount)}</div>
                      <span style={G.badge(p.paid_status ? '#10B981' : isLate ? '#EF4444' : '#F59E0B', p.paid_status ? '#F0FDF4' : isLate ? '#FFF1F1' : '#FFFBEB')}>
                        {p.paid_status ? 'Pago' : isLate ? 'Atrasado' : 'Pendente'}
                      </span>
                    </div>
                  </div>
                  {!p.paid_status && (
                    <button onClick={() => handleStripeCheckout(p.id)} disabled={checkoutId === p.id} style={{ ...G.btn(true), width: '100%', marginTop: 16, background: '#5B58EC', justifyContent: 'center' }}>
                      {checkoutId === p.id ? 'PROCESSANDO...' : 'PAGAR AGORA'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {lightboxUrl && <Lightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />}
    </>
  );
}

export default function Payments() {
  const [rows, setRows] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [showAdd, setShowAdd] = useState(false);
  const [np, setNp] = useState(BLANK);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [sendingIds, setSendingIds] = useState(new Set());
  const [pixLoadingIds, setPixLoadingIds] = useState(new Set());
  const [toast, setToast] = useState(null);
  const [extrato, setExtrato] = useState(null);
  const [pixModal, setPixModal] = useState(null); // { paymentId, qr_code, copy_paste, name, amount }
  const [copied, setCopied] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([
      supabase.from('payments').select('*, tenants(name, phone)').order('due_date', { ascending: false }),
      supabase.from('tenants').select('id, name').eq('status', 'ativo'),
    ]).then(([{ data: pays }, { data: tens }]) => {
      setRows(pays ?? []);
      setTenants(tens ?? []);
      setLoading(false);
    });
  };

  useEffect(() => { load(); }, []);

  const showToast = (msg, color = '#10B981') => {
    setToast({ msg, color });
    setTimeout(() => setToast(null), 3000);
  };

  const handleReceiptUpdate = useCallback((paymentId, url) => {
    setRows(r => r.map(p => p.id === paymentId ? { ...p, receipt_url: url } : p));
  }, []);

  const handlePixCharge = async (p) => {
    if (pixLoadingIds.has(p.id)) return;
    setPixLoadingIds(prev => new Set(prev).add(p.id));
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pix-charge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ payment_id: p.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao gerar PIX');

      // Atualiza row localmente se retornou pix_copy_paste
      if (data.pix_copy_paste) {
        setRows(r => r.map(row => row.id === p.id ? {
          ...row, pix_copy_paste: data.pix_copy_paste,
          pix_qr_code: data.qrcode_image, pix_expires_at: data.expires_at
        } : row));
      }

      // Abre modal com QR Code
      const updatedRow = rows.find(r => r.id === p.id);
      setPixModal({
        paymentId: p.id,
        qr_code: data.qrcode_image || updatedRow?.pix_qr_code,
        copy_paste: data.pix_copy_paste,
        name: p.tenants?.name,
        amount: p.value_amount,
        week_label: p.week_label,
      });
      showToast('PIX enviado para o Telegram do locatário! 📱');
    } catch (err) {
      showToast(err.message ?? 'Erro ao gerar PIX', '#EF4444');
    } finally {
      setPixLoadingIds(prev => { const s = new Set(prev); s.delete(p.id); return s; });
    }
  };

  const copyPix = (code) => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const sendBilling = async (p) => {
    if (sendingIds.has(p.id)) return;
    setSendingIds(prev => new Set(prev).add(p.id));
    try {
      await api.sendBillingNotification({
        payment_id: p.id, client_name: p.tenants?.name ?? 'Locatário',
        amount_due: p.value_amount, week_label: p.week_label || 'Referência', due_date: p.due_date,
      });
      showToast('Cobranca enviada ao Telegram 📱');
    } catch (err) { showToast(err.message ?? 'Erro ao notificar', '#EF4444'); }
    finally { setSendingIds(prev => { const s = new Set(prev); s.delete(p.id); return s; }); }
  };

  const togglePaid = async (id, current) => {
    const update = { paid_status: !current, paid_date: !current ? new Date().toISOString().slice(0, 10) : null };
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

  if (loading) return <div className="loading"><div className="spinner" /> Carregando caixa...</div>;

  const totalPending = rows.filter(r => !r.paid_status).reduce((s, r) => s + (r.value_amount || 0), 0);
  const totalPaid = rows.filter(r => r.paid_status).reduce((s, r) => s + (r.value_amount || 0), 0);
  const overdueCount = rows.filter(r => !r.paid_status && daysUntil(r.due_date) < 0).length;
  const filtered = rows.filter(r => filter === 'all' || (filter === 'pending' ? !r.paid_status : r.paid_status));

  return (
    <div className="page" style={{ background: '#F8FAFB', minHeight: '100vh', padding: '24px 0' }}>
      {toast && (
        <div style={{ position: 'fixed', bottom: 32, left: '50%', transform: 'translateX(-50%)', background: toast.color, color: '#FFF', padding: '14px 28px', borderRadius: 20, fontWeight: 800, zIndex: 999, boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }}>{toast.msg}</div>
      )}

      {/* ── HEADER ── */}
      <div style={{ marginBottom: 48, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
        <h2 style={{ fontSize: 32, fontWeight: 900, color: '#102A57', letterSpacing: '-1.5px', margin: 0 }}>Pagamentos</h2>
        <p style={{ color: '#64748B', fontWeight: 600, marginTop: 4, fontSize: 16 }}>Fluxo de caixa e gestão de inadimplência</p>

        <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
          <button style={G.btn(true)} onClick={() => setShowAdd(true)}><Plus size={18} /> NOVA COBRANÇA</button>
        </div>
      </div>

      {/* ── STATS GRID ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 24, marginBottom: 40 }}>
        {[
          { l: 'Pendente', v: `R$ ${fmt(totalPending)}`, icon: Clock, color: '#F59E0B', bg: '#FFFBEB' },
          { l: 'Recebido (Mês)', v: `R$ ${fmt(totalPaid)}`, icon: TrendingUp, color: '#10B981', bg: '#F0FDF4' },
          { l: 'Em Atraso', v: overdueCount, icon: AlertCircle, color: '#EF4444', bg: '#FFF1F1' },
          { l: 'Total Cobranças', v: rows.length, icon: FileText, color: '#102A57', bg: '#F8FAFB' },
        ].map((s, i) => (
          <div key={i} style={G.card}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <s.icon size={20} color={s.color} />
            </div>
            <div style={G.statLabel}>{s.l}</div>
            <div style={{ ...G.statValue, color: s.color }}>{s.v}</div>
          </div>
        ))}
      </div>

      {/* ── FILTROS ── */}
      <div style={{ marginBottom: 32 }}>
        <PillTabs tabs={[['all', 'Todos'], ['pending', 'Pendentes'], ['paid', 'Pagos']]} active={filter} onChange={setFilter} />
      </div>

      {/* ── LISTA ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {filtered.map(p => {
          const isLate = !p.paid_status && daysUntil(p.due_date) < 0;
          return (
            <div key={p.id} style={{ ...G.card, padding: '20px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }} onClick={() => setExtrato({ id: p.tenant_id, name: p.tenants?.name })}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <h4 style={{ fontSize: 16, fontWeight: 800, color: '#102A57', margin: 0 }}>{p.tenants?.name || '—'}</h4>
                  <span style={G.badge(p.paid_status ? '#10B981' : isLate ? '#EF4444' : '#F59E0B', p.paid_status ? '#F0FDF4' : isLate ? '#FFF1F1' : '#FFFBEB')}>
                    {p.paid_status ? 'Pago' : isLate ? 'Atrasado' : 'Pendente'}
                  </span>
                </div>
                <div style={{ fontSize: 13, color: '#94A3B8', fontWeight: 600, marginTop: 4 }}>{p.week_label || '—'} · Vence em {ptDate(p.due_date)}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                <div style={{ fontSize: 18, fontWeight: 900, color: p.paid_status ? '#10B981' : '#102A57' }}>R$ {fmt(p.value_amount)}</div>
                <div style={{ display: 'flex', gap: 10 }}>
                  {!p.paid_status && (
                    <>
                      <button
                        style={{ ...G.btn(), height: 36, padding: '0 14px', background: '#F3F2FF', color: '#5B58EC', border: '1px solid #C7D2FE' }}
                        onClick={(e) => { e.stopPropagation(); handlePixCharge(p); }}
                        disabled={pixLoadingIds.has(p.id)}
                        title="Gerar PIX e enviar para o Telegram do locatário"
                      >
                        {pixLoadingIds.has(p.id) ? '...' : <><QrCode size={14} /> PIX</>}
                      </button>
                      {p.pix_copy_paste && (
                        <button
                          style={{ ...G.btn(), height: 36, padding: '0 10px', background: '#F8FAFB' }}
                          onClick={(e) => { e.stopPropagation(); setPixModal({ paymentId: p.id, qr_code: p.pix_qr_code, copy_paste: p.pix_copy_paste, name: p.tenants?.name, amount: p.value_amount, week_label: p.week_label }); }}
                          title="Ver QR Code gerado"
                        >
                          <QrCode size={14} />
                        </button>
                      )}
                    </>
                  )}
                  <button style={{ ...G.btn(p.paid_status), height: 36, padding: '0 16px' }} onClick={(e) => { e.stopPropagation(); togglePaid(p.id, p.paid_status); }}>{p.paid_status ? 'DESFAZER' : 'PAGO'}</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── EXTRATO ── */}
      {extrato && <TenantExtrato tenant={extrato} payments={rows} onClose={() => setExtrato(null)} onReceiptUpdate={handleReceiptUpdate} />}

      {/* ── MODAL NOVA COBRANÇA ── */}
      {showAdd && (
        <div style={{ ...S.ovl, backdropFilter: 'blur(12px)' }} onClick={e => e.target === e.currentTarget && setShowAdd(false)}>
          <div style={{ ...G.card, width: '100%', maxWidth: 500, padding: 40, border: 'none' }}>
            <h3 style={{ fontSize: 24, fontWeight: 900, color: '#102A57', marginBottom: 32, letterSpacing: '-1px' }}>Nova Cobrança</h3>
            <div style={{ display: 'grid', gap: 24 }}>
              <div>
                <label style={G.statLabel}>Locatário *</label>
                <select style={{ ...S.inp, height: 48, borderRadius: 14, marginTop: 8 }} value={np.tenant_id} onChange={e => setNp(p => ({ ...p, tenant_id: e.target.value }))}>
                  <option value="">Selecione...</option>
                  {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div><label style={G.statLabel}>Valor (R$)</label><input type="number" style={{ ...S.inp, height: 48, borderRadius: 14, marginTop: 8 }} value={np.value_amount} onChange={e => setNp(p => ({ ...p, value_amount: Number(e.target.value) }))} /></div>
                <div><label style={G.statLabel}>Vencimento</label><input type="date" style={{ ...S.inp, height: 48, borderRadius: 14, marginTop: 8 }} value={np.due_date} onChange={e => setNp(p => ({ ...p, due_date: e.target.value }))} /></div>
              </div>
              <div><label style={G.statLabel}>Semana / Referência</label><input placeholder="Ex: Semana 01" style={{ ...S.inp, height: 48, borderRadius: 14, marginTop: 8 }} value={np.week_label} onChange={e => setNp(p => ({ ...p, week_label: e.target.value }))} /></div>
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 40 }}>
              <button style={{ ...G.btn(true), flex: 1, height: 52, justifyContent: 'center' }} onClick={handleAdd} disabled={saving}>CADASTRAR</button>
              <button style={{ ...G.btn(false), flex: 1, height: 52, justifyContent: 'center' }} onClick={() => setShowAdd(false)}>CANCELAR</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL QR CODE PIX ── */}
      {pixModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(16,42,87,0.5)', backdropFilter: 'blur(12px)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={() => setPixModal(null)}>
          <div style={{ background: '#FFF', borderRadius: 32, padding: 40, width: '100%', maxWidth: 420, textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }} onClick={e => e.stopPropagation()}>
            <button onClick={() => setPixModal(null)} style={{ position: 'absolute', top: 20, right: 20, background: '#F8FAFB', border: 'none', borderRadius: '50%', width: 36, height: 36, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={18} /></button>

            <div style={{ width: 56, height: 56, borderRadius: 18, background: '#F3F2FF', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <QrCode size={28} color="#5B58EC" />
            </div>

            <h3 style={{ fontSize: 20, fontWeight: 900, color: '#102A57', margin: '0 0 4px', letterSpacing: '-0.5px' }}>PIX Gerado</h3>
            <p style={{ color: '#94A3B8', fontWeight: 600, fontSize: 14, margin: '0 0 24px' }}>
              {pixModal.name} · R$ {fmt(pixModal.amount)} · {pixModal.week_label}
            </p>

            {pixModal.qr_code && (
              <img src={pixModal.qr_code} alt="QR Code PIX" style={{ width: 200, height: 200, borderRadius: 16, marginBottom: 24, border: '2px solid #F1F5F9' }} />
            )}

            <div style={{ background: '#F8FAFB', borderRadius: 16, padding: 16, marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', marginBottom: 8 }}>Código Copia e Cola</div>
              <div style={{ fontSize: 11, color: '#102A57', fontWeight: 600, wordBreak: 'break-all', fontFamily: 'monospace', maxHeight: 80, overflowY: 'auto' }}>
                {pixModal.copy_paste}
              </div>
            </div>

            <button
              style={{ ...G.btn(true), width: '100%', justifyContent: 'center', background: copied ? '#10B981' : '#5B58EC', gap: 8 }}
              onClick={() => copyPix(pixModal.copy_paste)}
            >
              {copied ? <><CheckCircle2 size={16} /> COPIADO!</> : <><Copy size={16} /> COPIAR CÓDIGO PIX</>}
            </button>

            <p style={{ color: '#94A3B8', fontSize: 12, fontWeight: 600, marginTop: 16 }}>
              ✅ O QR Code e o código foram enviados automaticamente para o Telegram do locatário.
            </p>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
      `}</style>
    </div>
  );
}
