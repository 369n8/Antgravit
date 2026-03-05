import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

const NAV = [
  { id: 'dashboard',   label: 'Dashboard',   icon: IconGrid },
  { id: 'vehicles',    label: 'Veículos',     icon: IconCar },
  { id: 'tenants',     label: 'Locatários',   icon: IconUsers },
  { id: 'payments',    label: 'Pagamentos',   icon: IconMoney },
  { id: 'maintenance', label: 'Manutenção',   icon: IconWrench },
];

export default function Sidebar({ page, onNavigate }) {
  const { user } = useAuth();

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <h2>FrotaApp</h2>
        <span>Gestão de Frotas</span>
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
        <div className="user-email">{user?.email}</div>
        <button className="btn-logout" onClick={() => supabase.auth.signOut()}>
          Sair
        </button>
      </div>
    </aside>
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
