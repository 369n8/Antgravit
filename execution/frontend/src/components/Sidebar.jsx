import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

const NAV = [
  { id: 'dashboard',   label: 'Dashboard',   icon: IconGrid },
  { id: 'vehicles',    label: 'Veículos',     icon: IconCar },
  { id: 'tenants',     label: 'Locatários',   icon: IconUsers },
  { id: 'payments',    label: 'Pagamentos',   icon: IconMoney },
  { id: 'maintenance', label: 'Frota',         icon: IconWrench },
];

export default function Sidebar({ page, onNavigate }) {
  const { user } = useAuth();
  const [showTg, setShowTg]           = useState(false);
  const [tgInput, setTgInput]         = useState('');
  const [tgSaved, setTgSaved]         = useState('');
  const [saving, setSaving]           = useState(false);
  const [tgError, setTgError]         = useState('');

  useEffect(() => {
    if (!user) return;
    supabase
      .from('clients')
      .select('telegram_username')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (data?.telegram_username) {
          setTgSaved(data.telegram_username);
          setTgInput(data.telegram_username);
        }
      });
  }, [user]);

  const handleSave = async () => {
    const username = tgInput.trim().replace(/^@/, '');
    if (!username) { setTgError('Digite seu @username do Telegram.'); return; }
    setSaving(true); setTgError('');
    const { error } = await supabase
      .from('clients')
      .update({ telegram_username: username })
      .eq('id', user.id);
    setSaving(false);
    if (error) { setTgError(error.message); return; }
    setTgSaved(username);
    setShowTg(false);
  };

  const isConnected = !!tgSaved;

  return (
    <>
      <aside className="sidebar">
        <div className="sidebar-brand">
          <img src="/logo.png" alt="myfrot.ai" style={{ width: '100%', maxWidth: 180, height: 'auto', objectFit: 'contain', display: 'block' }} />
        </div>

        <nav className="sidebar-nav">
          {NAV.map(item => (
            <button
              key={item.id}
              className={`nav-item${page === item.id ? ' active' : ''}`}
              onClick={() => onNavigate(item.id)}
            >
              <item.icon size={16} />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button
            onClick={() => { setShowTg(true); setTgError(''); }}
            style={{
              width: '100%',
              marginBottom: 10,
              padding: '9px 12px',
              borderRadius: 10,
              border: `1px solid ${isConnected ? 'rgba(143,156,130,0.4)' : '#E8E8E6'}`,
              background: isConnected ? 'rgba(143,156,130,0.12)' : '#F6F6F4',
              color: isConnected ? '#4A5441' : '#6B7280',
              fontFamily: 'inherit',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <IconTelegram size={15} />
            {isConnected ? `@${tgSaved}` : 'Conectar Telegram'}
            {isConnected && (
              <span style={{ marginLeft: 'auto', width: 7, height: 7, borderRadius: '50%', background: '#8F9C82', flexShrink: 0 }} />
            )}
          </button>

          <div className="user-email">{user?.email}</div>
          <button className="btn-logout" onClick={() => supabase.auth.signOut()}>
            Sair
          </button>
        </div>
      </aside>

      {/* ── Modal Telegram ── */}
      {showTg && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setShowTg(false); }}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,.12)',
            backdropFilter: 'blur(20px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 300, padding: 20,
          }}
        >
          <div style={{
            background: '#fff',
            borderRadius: 28,
            boxShadow: '0 20px 60px rgba(0,0,0,.08)',
            width: '100%',
            maxWidth: 420,
            overflow: 'hidden',
          }}>
            {/* Cabeçalho colorido */}
            <div style={{
              background: 'linear-gradient(135deg,#229ED9,#1a7cb8)',
              padding: '28px 28px 24px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 12,
                  background: 'rgba(255,255,255,.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <IconTelegram size={24} color="#fff" />
                </div>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 700, color: '#fff', lineHeight: 1.2 }}>Conectar Telegram</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,.7)', marginTop: 2 }}>Receba alertas e cobranças pelo bot</div>
                </div>
              </div>
            </div>

            {/* Bento grid de benefícios */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, padding: '20px 24px 0' }}>
              {[
                { ic: '🔔', t: 'Alertas de vencimento', d: 'IPVA, seguro, revisão' },
                { ic: '💰', t: 'Cobrança automática', d: 'Notificações de pagamento' },
                { ic: '🚗', t: 'Status da frota', d: 'Atualizações em tempo real' },
                { ic: '📋', t: 'Relatórios rápidos', d: 'Resumo diário direto no chat' },
              ].map((b, i) => (
                <div key={i} style={{
                  background: '#F6F6F4',
                  borderRadius: 14,
                  padding: '12px 13px',
                }}>
                  <div style={{ fontSize: 18, marginBottom: 4 }}>{b.ic}</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#111827' }}>{b.t}</div>
                  <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{b.d}</div>
                </div>
              ))}
            </div>

            {/* Input + ação */}
            <div style={{ padding: '20px 24px 24px' }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', letterSpacing: '.08em', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
                Seu @username do Telegram
              </label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', fontSize: 14, fontWeight: 600 }}>@</span>
                <input
                  autoFocus
                  value={tgInput.replace(/^@/, '')}
                  onChange={e => setTgInput(e.target.value.replace(/^@/, ''))}
                  onKeyDown={e => e.key === 'Enter' && handleSave()}
                  placeholder="username"
                  style={{
                    width: '100%',
                    padding: '11px 14px 11px 30px',
                    borderRadius: 12,
                    border: `1.5px solid ${tgError ? '#ef4444' : '#E8E8E6'}`,
                    background: '#F3F4F6',
                    fontSize: 14,
                    color: '#111827',
                    outline: 'none',
                    boxSizing: 'border-box',
                    fontFamily: 'inherit',
                    transition: 'border-color .15s',
                  }}
                  onFocus={e => { e.target.style.borderColor = '#229ED9'; }}
                  onBlur={e => { e.target.style.borderColor = tgError ? '#ef4444' : '#E8E8E6'; }}
                />
              </div>

              {tgError && (
                <div style={{ color: '#ef4444', fontSize: 12, marginTop: 6 }}>⚠ {tgError}</div>
              )}

              <div style={{ display: 'flex', gap: 9, marginTop: 16 }}>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  style={{
                    flex: 1,
                    padding: '11px',
                    borderRadius: 12,
                    border: 'none',
                    background: 'linear-gradient(135deg,#229ED9,#1a7cb8)',
                    color: '#fff',
                    fontFamily: 'inherit',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: saving ? 'not-allowed' : 'pointer',
                    opacity: saving ? .7 : 1,
                    transition: 'opacity .15s',
                  }}
                >
                  {saving ? 'Salvando...' : isConnected ? '✓ Atualizar' : 'Conectar'}
                </button>
                {isConnected && (
                  <button
                    onClick={async () => {
                      await supabase.from('clients').update({ telegram_username: null }).eq('id', user.id);
                      setTgSaved(''); setTgInput(''); setShowTg(false);
                    }}
                    style={{
                      padding: '11px 16px',
                      borderRadius: 12,
                      border: '1.5px solid #E8E8E6',
                      background: 'transparent',
                      color: '#9CA3AF',
                      fontFamily: 'inherit',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Desconectar
                  </button>
                )}
                <button
                  onClick={() => setShowTg(false)}
                  style={{
                    padding: '11px 16px',
                    borderRadius: 12,
                    border: '1.5px solid #E8E8E6',
                    background: 'transparent',
                    color: '#9CA3AF',
                    fontFamily: 'inherit',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ── Ícones ── */

function IconTelegram({ size = 16, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L8.32 14.617l-2.96-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.828.942z"/>
    </svg>
  );
}

function IconGrid({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <rect x="1" y="1" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5"/>
      <rect x="9" y="1" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5"/>
      <rect x="1" y="9" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5"/>
      <rect x="9" y="9" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  );
}

function IconCar({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d="M2 8l1.5-4h9L14 8v4H2V8z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      <circle cx="4.5" cy="11" r="1" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="11.5" cy="11" r="1" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M2 8h12" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  );
}

function IconUsers({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <circle cx="6" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M1 14c0-2.76 2.24-5 5-5s5 2.24 5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M11 7c1.1 0 2 .9 2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M13 14c0-1.66-.9-3.1-2.24-3.87" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

function IconMoney({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <rect x="1" y="4" width="14" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="8" cy="8.5" r="2" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M4 4V3a1 1 0 011-1h6a1 1 0 011 1v1" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  );
}

function IconWrench({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d="M10.5 2a3.5 3.5 0 00-3.36 4.46L2.5 11.1A1.5 1.5 0 004.62 13.2l4.65-4.64A3.5 3.5 0 0010.5 9a3.5 3.5 0 000-7z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      <circle cx="10.5" cy="5.5" r="1" fill="currentColor"/>
    </svg>
  );
}
