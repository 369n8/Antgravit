import { useState, useEffect } from 'react';
import './App.css';
import { supabase } from './lib/supabase';
import { useAuth } from './hooks/useAuth';
import { api } from './services/api';
import Login from './pages/Login';
import Portal from './pages/Portal';
import Cadastro from './pages/Cadastro';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Vehicles from './pages/Vehicles';
import Tenants from './pages/Tenants';
import Payments from './pages/Payments';
import Maintenance from './pages/Maintenance';
import SuperAdmin from './pages/SuperAdmin';
import BlacklistManager from './components/BlacklistManager';
import Fines from './pages/Fines';
import AutomacaoIA from './pages/AutomacaoIA';
import Central from './pages/Central';

const PAGES = { central: Central, dashboard: Dashboard, vehicles: Vehicles, tenants: Tenants, payments: Payments, maintenance: Maintenance, fines: Fines, automacao: AutomacaoIA };
const TITLES = { central: 'Central de Comando', dashboard: 'Histórico & Dados', vehicles: 'Minha Frota', tenants: 'Motoristas', payments: 'Pagamentos', maintenance: 'Manutenção', fines: 'Multas & CNH', automacao: 'Configurações IA' };

export default function App() {
  const { user, loading } = useAuth();
  const [page, setPage] = useState('central');
  const [showBlacklist, setShowBlacklist] = useState(false);
  const [stripeLoading, setStripeLoading] = useState(false);
  const [connectStatus, setConnectStatus] = useState(null);

  // Buscar status do Stripe Connect ao montar
  useEffect(() => {
    if (!user) return;
    supabase.from('clients').select('stripe_connect_status').eq('id', user.id).single()
      .then(({ data }) => { if (data) setConnectStatus(data.stripe_connect_status); });
  }, [user]);

  const handleConnectStripe = async () => {
    if (connectStatus === 'active') return;
    try {
      setStripeLoading(true);
      const data = await api.getStripeOnboardingLink();
      if (data?.url) window.location.href = data.url;
    } catch (err) {
      console.error(err);
      alert('Erro ao conectar conta: ' + err.message);
    } finally {
      setStripeLoading(false);
    }
  };

  if (loading) return (
    <div className="loading">
      <div className="spinner" /> Carregando...
    </div>
  );

  const path = window.location.pathname;
  if (path.startsWith('/portal/')) {
    const token = path.split('/')[2];
    return <Portal token={token} />;
  }
  if (path.startsWith('/pre-cadastro') || path.startsWith('/cadastro')) {
    return <Cadastro />;
  }

  if (!user) return <Login />;

  if (path.startsWith('/super-admin')) {
    return <SuperAdmin />;
  }

  const Page = PAGES[page];
  const stripeLabel = connectStatus === 'active' ? '✓ Conectado'
    : connectStatus === 'pending' ? '⏳ Pendente'
      : 'Conta Bancária';
  const stripeDisabled = stripeLoading || connectStatus === 'active';

  return (
    <div className="layout">
      <Sidebar page={page} onNavigate={setPage} />
      <div className="main-content">
        <div className="topbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ width: 220 }} /> {/* Spacer for balance */}
          <span className="topbar-title" style={{ flex: 1, textAlign: 'center' }}>{TITLES[page]}</span>
          <div style={{ display: 'flex', gap: 8, width: 220, justifyContent: 'flex-end' }}>
            <button
              onClick={handleConnectStripe}
              disabled={stripeDisabled}
              className={`topbar-btn ${connectStatus === 'active' ? 'topbar-btn-connected' : ''}`}
            >
              {stripeLoading ? (
                <div className="spinner" style={{ width: 12, height: 12, borderWidth: 2 }} />
              ) : connectStatus === 'active' ? null : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" /><path d="M3 5v14a2 2 0 0 0 2 2h16v-5" /><path d="M18 12a2 2 0 0 0 0 4h4v-4Z" /></svg>
              )}
              {stripeLoading ? 'Conectando...' : stripeLabel}
            </button>
            <button
              className="topbar-btn"
              onClick={() => setShowBlacklist(true)}
            >
              Blacklist
            </button>
          </div>
        </div>
        <Page onNavigate={setPage} />
      </div>

      {showBlacklist && <BlacklistManager onClose={() => setShowBlacklist(false)} />}
    </div>
  );
}
