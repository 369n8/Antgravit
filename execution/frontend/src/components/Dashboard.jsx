import { DollarSign, TrendingUp, Receipt, Award, Car, CheckCircle, AlertTriangle, Bell } from 'lucide-react';

function daysUntil(d) { return Math.ceil((new Date(d) - new Date()) / 86400000); }
function ptDate(d) { if (!d) return '—'; const [y,m,dd] = d.split('-'); return `${dd}/${m}/${y}`; }

const PASTEL = {
  '#22c55e': ['rgba(143,156,130,0.18)', '#4A5441'],
  '#ef4444': ['#E6C6C6',               '#7A3B3B'],
  '#f59e0b': ['#FFF0C2',               '#7A5800'],
  '#3b82f6': ['#DDEAF3',               '#2D5085'],
  '#6366f1': ['#ECEEFF',               '#3B3E9A'],
  '#64748b': ['#EBEBEB',               '#4B5563'],
  '#8b5cf6': ['#F0ECFF',               '#5B3FA0'],
};

function bdg(c) {
  const [bg, text] = PASTEL[c] ?? ['#EBEBEB', '#4B5563'];
  return { display:'inline-flex', alignItems:'center', padding:'3px 10px', borderRadius:999, fontSize:11, fontWeight:600, background:bg, color:text, whiteSpace:'nowrap' };
}

const iconStyle = { width: 16, height: 16, color: '#6B7280', flexShrink: 0 };

const STATS = (weekRev, totalExpenses, locados, disponiveis, inadimplentes, alertCount) => [
  { l: 'Receita Semanal', v: `R$ ${weekRev.toLocaleString()}`,                                    Icon: DollarSign,    to: 'payments'     },
  { l: 'Receita Mensal',  v: `R$ ${(weekRev * 4).toLocaleString()}`,                              Icon: TrendingUp,    to: 'payments'     },
  { l: 'Gastos (total)',  v: `R$ ${totalExpenses.toLocaleString()}`,                               Icon: Receipt,       to: 'maintenance'  },
  { l: 'Lucro Estimado',  v: `R$ ${Math.max(0, weekRev * 4 - totalExpenses).toLocaleString()}`,   Icon: Award,         to: 'payments'     },
  { l: 'Locados',         v: locados,       Icon: Car,           to: 'vehicles'     },
  { l: 'Disponíveis',     v: disponiveis,   Icon: CheckCircle,   to: 'vehicles'     },
  { l: 'Inadimplentes',   v: inadimplentes, Icon: AlertTriangle, to: 'tenants'      },
  { l: 'Alertas',         v: alertCount,    Icon: Bell,          to: 'maintenance'  },
];

const statCard = { background: '#fff', borderRadius: 24, padding: '18px 20px', boxShadow: 'none', border: '1px solid #EBEBEB', cursor: 'pointer', transition: 'border-color .15s' };
const sectionCard = { background: '#fff', borderRadius: 24, padding: 24, boxShadow: 'none', border: '1px solid #EBEBEB' };

const alertRow = d => ({
  background: d < 15 ? '#E6C6C630' : d < 30 ? '#FFF0C2' : '#EEF4FB',
  border: `1px solid ${d < 15 ? '#E6C6C6' : d < 30 ? '#F5D98B' : '#C3D9EC'}`,
  borderRadius: 14, padding: '12px 16px', display: 'flex', alignItems: 'center',
  justifyContent: 'space-between', marginBottom: 9,
});

export default function Dashboard({ vehicles = [], tenants = [], alerts = [], weekRev = 0, totalExpenses = 0, fleetAlerts = { insurance: [], fines: [] }, onNavigate }) {
  const nav = (page) => onNavigate && onNavigate(page);
  const locados      = vehicles.filter(v => v.status === 'locado').length;
  const disponiveis  = vehicles.filter(v => v.status === 'disponível').length;
  const inadimplentes = tenants.filter(t => !t.paid).length;
  const stats = STATS(weekRev, totalExpenses, locados, disponiveis, inadimplentes, alerts.length);

  return (
    <div>
      {/* Stat grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12, marginBottom: 20 }}>
        {stats.map((s, i) => (
          <div key={i} onClick={() => nav(s.to)} style={statCard}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#C8C8C6'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#EBEBEB'; }}>
            <s.Icon style={{ ...iconStyle, marginBottom: 10 }} />
            <div style={{ fontSize: 36, fontWeight: 700, color: '#111827', letterSpacing: '-2px', lineHeight: 1, marginBottom: 6 }}>{s.v}</div>
            <div style={{ fontSize: 10, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '.1em', fontWeight: 600 }}>{s.l}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Alertas de Frota */}
        <div style={sectionCard}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, color: '#111827', letterSpacing: '-0.2px' }}>
            Alertas de Frota
            {(fleetAlerts.insurance.length + fleetAlerts.fines.length) > 0 && (
              <span style={bdg('#ef4444')}>{fleetAlerts.insurance.length + fleetAlerts.fines.length}</span>
            )}
          </div>
          {fleetAlerts.insurance.length === 0 && fleetAlerts.fines.length === 0 ? (
            <div style={{ color: '#4A5441', fontSize: 13, background: 'rgba(143,156,130,0.15)', borderRadius: 12, padding: '10px 14px', fontWeight: 500 }}>Nenhum alerta de frota</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 9 }}>
              {fleetAlerts.insurance.map((ins, i) => {
                const d = ins.expiry_date ? daysUntil(ins.expiry_date) : null;
                const c = d !== null && d <= 7 ? '#ef4444' : '#f59e0b';
                const [bg, tx] = PASTEL[c] ?? ['#EBEBEB', '#4B5563'];
                const veh = ins.vehicles;
                return (
                  <div key={`ins-${i}`} onClick={() => nav('maintenance')}
                    style={{ background: bg, border: `1px solid ${c}40`, borderRadius: 14, padding: '12px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13, color: '#111827' }}>{veh ? `${veh.brand} ${veh.model}` : '—'}</div>
                      <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>{ins.insurer ?? 'Seguro'} · vence {ptDate(ins.expiry_date)}</div>
                    </div>
                    <span style={bdg(c)}>{d !== null ? `${d}d` : '—'}</span>
                  </div>
                );
              })}
              {fleetAlerts.fines.map((f, i) => {
                const veh = f.vehicles;
                const hasDue = !!f.due_date;
                const d = hasDue ? daysUntil(f.due_date) : null;
                return (
                  <div key={`fine-${i}`} onClick={() => nav('maintenance')}
                    style={{ background: '#E6C6C630', border: '1px solid #E6C6C6', borderRadius: 14, padding: '12px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13, color: '#111827' }}>{veh ? `${veh.brand} ${veh.model}` : 'Multa'}</div>
                      <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>
                        {f.description ? f.description.slice(0, 30) : 'Pendente'}{hasDue ? ` · vence ${ptDate(f.due_date)}` : ''}
                      </div>
                    </div>
                    <span style={bdg('#ef4444')}>{f.amount > 0 ? `R$${Number(f.amount).toFixed(0)}` : 'Pendente'}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Alertas de Documentos */}
        <div style={sectionCard}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: '#111827', letterSpacing: '-0.2px' }}>Alertas de Documentos</div>
          {alerts.length === 0 ? (
            <div style={{ color: '#4A5441', fontSize: 13, background: 'rgba(143,156,130,0.15)', borderRadius: 12, padding: '10px 14px', fontWeight: 500 }}>Tudo em ordem!</div>
          ) : (
            alerts.slice(0, 5).map((a, i) => (
              <div key={i} style={alertRow(a.days)}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13, color: '#111827' }}>{a.veh} <span style={{ color: '#9CA3AF', fontWeight: 400 }}>({a.plate})</span></div>
                  <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>{a.doc.toUpperCase()} — {a.days} dias restantes</div>
                </div>
                <div style={bdg(a.days < 15 || a.days === 0 ? '#ef4444' : a.days < 30 ? '#f59e0b' : '#3b82f6')}>
                  {a.days === 0 ? 'URGENTE' : `${a.days}d`}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
