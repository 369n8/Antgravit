import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: IconGrid },
  { id: 'vehicles', label: 'Minha Frota', icon: IconCar },
  { id: 'tenants', label: 'Motoristas', icon: IconUsers },
  { id: 'payments', label: 'Pagamentos', icon: IconMoney },
  { id: 'maintenance', label: 'Manutenção', icon: IconWrench },
  { id: 'fines', label: 'Multas & CNH', icon: IconAlert },
  { id: 'automacao', label: 'Motor IA', icon: IconBrain },
];

export default function Sidebar({ page, onNavigate }) {
  const { user } = useAuth();
  const [showTg, setShowTg] = useState(false);
  const [tgInput, setTgInput] = useState('');
  const [tgSaved, setTgSaved] = useState('');
  const [saving, setSaving] = useState(false);
  const [tgError, setTgError] = useState('');
  const [dark, setDark] = useState(() => document.documentElement.getAttribute('data-theme') === 'dark');

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

  // Multi-tenant: owner principal configura bot, locadoras configuram seu @username para receber notificações
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
              marginBottom: 12,
              padding: '14px 16px',
              borderRadius: 'var(--radius-md)',
              border: 'none',
              background: isConnected ? '#F3F2FF' : 'var(--bg)',
              color: isConnected ? '#5B58EC' : 'var(--muted)',
              fontFamily: 'inherit',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              transition: 'all 0.2s',
            }}
          >
            <IconTelegram size={16} color={isConnected ? '#5B58EC' : 'var(--muted)'} />
            {isConnected ? `@${tgSaved}` : 'Conectar Telegram'}
            {isConnected && (
              <span style={{ marginLeft: 'auto', width: 8, height: 8, borderRadius: '50%', background: '#5B58EC', flexShrink: 0 }} />
            )}
          </button>

          {/* Dark Mode Toggle */}
          <button
            onClick={() => {
              const next = !dark;
              setDark(next);
              document.documentElement.setAttribute('data-theme', next ? 'dark' : 'light');
              localStorage.setItem('theme', next ? 'dark' : 'light');
            }}
            style={{
              width: '100%', marginBottom: 12,
              padding: '12px 16px', borderRadius: 'var(--radius-md)',
              border: 'none', background: 'var(--bg)', color: 'var(--muted)',
              fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
              transition: 'all 0.2s',
            }}
          >
            {dark ? '☀️' : '🌙'}
            {dark ? 'Tema Claro' : 'Tema Escuro'}
          </button>

          <div className="user-email" style={{ color: '#102A57', opacity: 0.6 }}>{user?.email}</div>
          <button className="btn-logout" style={{ borderRadius: 'var(--radius-md)', fontWeight: 800, color: '#FF8E86', borderColor: '#FEE2E2' }} onClick={() => supabase.auth.signOut()}>
            Sair da Plataforma
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
            borderRadius: 'var(--radius-lg)',
            boxShadow: '0 24px 80px rgba(0,0,0,0.08)',
            width: '100%',
            maxWidth: 420,
            overflow: 'hidden',
          }}>
            {/* Cabeçalho */}
            <div style={{
              background: '#fff',
              borderBottom: '1px solid #F3F4F6',
              padding: '32px 32px 24px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 4 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 'var(--radius-sm)',
                  background: '#F3F4F6',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <IconTelegram size={24} color="#111827" />
                </div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#111827', letterSpacing: '-0.5px' }}>Conectar Telegram</div>
                  <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2, fontWeight: 500 }}>Receba alertas e cobranças pelo bot</div>
                </div>
              </div>
            </div>

            {/* Bento grid de benefícios */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, padding: '20px 24px 0' }}>
              {[
                { ic: '🔔', t: 'Alertas', d: 'IPVA, seguro, revisão' },
                { ic: '💰', t: 'Cobrança', d: 'Notificações no chat' },
                { ic: '🚗', t: 'Frota', d: 'Atualizações diárias' },
                { ic: '📋', t: 'Relatórios', d: 'Resumo direto no bot' },
              ].map((b, i) => (
                <div key={i} style={{
                  background: 'var(--bg)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '16px',
                }}>
                  <div style={{ fontSize: 20, marginBottom: 8 }}>{b.ic}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em' }}>{b.t}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4, lineHeight: 1.3 }}>{b.d}</div>
                </div>
              ))}
            </div>

            {/* Input + ação */}
            <div style={{ padding: '20px 24px 24px' }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#111827', display: 'block', marginBottom: 10 }}>
                Seu @username do Telegram
              </label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 18, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', fontSize: 15, fontWeight: 600 }}>@</span>
                <input
                  autoFocus
                  value={tgInput.replace(/^@/, '')}
                  onChange={e => setTgInput(e.target.value.replace(/^@/, ''))}
                  onKeyDown={e => e.key === 'Enter' && handleSave()}
                  placeholder="username"
                  style={{
                    width: '100%',
                    padding: '16px 16px 16px 36px',
                    borderRadius: 'var(--radius-pill)',
                    border: `2px solid transparent`,
                    background: 'var(--bg)',
                    fontSize: 14,
                    color: 'var(--text)',
                    fontWeight: 600,
                    outline: 'none',
                    boxSizing: 'border-box',
                    fontFamily: 'inherit',
                    transition: 'all .2s',
                  }}
                  onFocus={e => { e.target.style.background = 'var(--surface)'; e.target.style.borderColor = 'var(--accent)'; }}
                  onBlur={e => { e.target.style.background = 'var(--bg)'; e.target.style.borderColor = 'transparent'; }}
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
                    padding: '14px',
                    borderRadius: 'var(--radius-pill)',
                    border: 'none',
                    background: 'var(--accent)',
                    color: '#111827',
                    fontFamily: 'inherit',
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: saving ? 'not-allowed' : 'pointer',
                    opacity: saving ? .7 : 1,
                    boxShadow: 'none',
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
                      padding: '14px 20px',
                      borderRadius: 'var(--radius-pill)',
                      border: '1px solid var(--border)',
                      background: '#fff',
                      color: 'var(--muted)',
                      fontFamily: 'inherit',
                      fontSize: 14,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Desconectar
                  </button>
                )}
                <button
                  onClick={() => setShowTg(false)}
                  style={{
                    padding: '14px 20px',
                    borderRadius: 'var(--radius-pill)',
                    border: '1px solid var(--border)',
                    background: '#fff',
                    color: '#111827',
                    fontFamily: 'inherit',
                    fontSize: 14,
                    fontWeight: 700,
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
      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L8.32 14.617l-2.96-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.828.942z" />
    </svg>
  );
}

function IconGrid({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <rect x="1" y="1" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="9" y="1" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="1" y="9" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="9" y="9" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function IconCar({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d="M2 8l1.5-4h9L14 8v4H2V8z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx="4.5" cy="11" r="1" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="11.5" cy="11" r="1" stroke="currentColor" strokeWidth="1.5" />
      <path d="M2 8h12" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function IconUsers({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <circle cx="6" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M1 14c0-2.76 2.24-5 5-5s5 2.24 5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M11 7c1.1 0 2 .9 2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M13 14c0-1.66-.9-3.1-2.24-3.87" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconMoney({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <rect x="1" y="4" width="14" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="8" cy="8.5" r="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M4 4V3a1 1 0 011-1h6a1 1 0 011 1v1" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function IconWrench({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d="M10.5 2a3.5 3.5 0 00-3.36 4.46L2.5 11.1A1.5 1.5 0 004.62 13.2l4.65-4.64A3.5 3.5 0 0010.5 9a3.5 3.5 0 000-7z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx="10.5" cy="5.5" r="1" fill="currentColor" />
    </svg>
  );
}


function IconAlert({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function IconBrain({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.5 2a2.5 2.5 0 0 1 5 0c1.38 0 2.5 1.12 2.5 2.5 0 .28-.05.55-.13.8A2.5 2.5 0 0 1 19 7.5c0 .95-.53 1.78-1.31 2.2.19.38.31.8.31 1.3 0 1.1-.71 2.04-1.7 2.38C16.43 14.78 15.31 16 14 16h-4c-1.31 0-2.43-1.22-2.3-2.62C6.71 13.04 6 12.1 6 11c0-.5.12-.92.31-1.3A2.5 2.5 0 0 1 5 7.5a2.5 2.5 0 0 1 2.13-2.2A2.46 2.46 0 0 1 7 4.5C7 3.12 8.12 2 9.5 2z" />
      <path d="M12 16v6" />
      <path d="M8 22h8" />
      <path d="M9 11h.01M12 9h.01M15 11h.01" />
    </svg>
  );
}
