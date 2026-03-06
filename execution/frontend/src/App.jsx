import { useState } from 'react';
import './App.css';
import { useAuth }         from './hooks/useAuth';
import Login               from './pages/Login';
import Sidebar             from './components/Sidebar';
import Dashboard           from './pages/Dashboard';
import Vehicles            from './pages/Vehicles';
import Tenants             from './pages/Tenants';
import Payments            from './pages/Payments';
import Maintenance         from './pages/Maintenance';
import BlacklistManager    from './components/BlacklistManager';

const PAGES = { dashboard: Dashboard, vehicles: Vehicles, tenants: Tenants, payments: Payments, maintenance: Maintenance };
const TITLES = { dashboard: 'Dashboard', vehicles: 'Veículos', tenants: 'Locatários', payments: 'Pagamentos', maintenance: 'Frota Operacional' };

export default function App() {
  const { user, loading }         = useAuth();
  const [page, setPage]           = useState('dashboard');
  const [showBlacklist, setShowBlacklist] = useState(false);

  if (loading) return (
    <div className="loading" style={{ minHeight: '100vh' }}>
      <div className="spinner"/> Carregando...
    </div>
  );

  if (!user) return <Login />;

  const Page = PAGES[page];

  return (
    <div className="layout">
      <Sidebar page={page} onNavigate={setPage} />
      <div className="main-content">
        <div className="topbar">
          <span className="topbar-title">{TITLES[page]}</span>
          <button
            onClick={() => setShowBlacklist(true)}
            style={{ padding:'6px 14px', borderRadius:8, border:'1px solid var(--border)', background:'transparent', color:'var(--muted)', fontSize:13, cursor:'pointer' }}
          >
            Blacklist
          </button>
        </div>
        <Page onNavigate={setPage} />
      </div>

      {showBlacklist && <BlacklistManager onClose={() => setShowBlacklist(false)} />}
    </div>
  );
}
