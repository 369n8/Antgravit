import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function Dashboard() {
  const [stats, setStats]   = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [vehicles, tenants, payments, maintenance] = await Promise.all([
        supabase.from('vehicles').select('id, status'),
        supabase.from('tenants').select('id, status'),
        supabase.from('payments').select('id, paid_status, value_amount'),
        supabase.from('maintenance').select('id, done, event_type'),
      ]);

      const v = vehicles.data ?? [];
      const t = tenants.data ?? [];
      const p = payments.data ?? [];
      const m = maintenance.data ?? [];

      setStats({
        totalVehicles:  v.length,
        rented:         v.filter(x => x.status === 'locado').length,
        available:      v.filter(x => x.status === 'disponivel').length,
        inMaintenance:  v.filter(x => x.status === 'manutencao').length,
        activeTenants:  t.filter(x => x.status === 'ativo').length,
        pendingPayments: p.filter(x => !x.paid_status).length,
        pendingAmount:  p.filter(x => !x.paid_status).reduce((s, x) => s + (x.value_amount || 0), 0),
        pendingMaint:   m.filter(x => !x.done && x.event_type === 'schedule').length,
      });
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <div className="loading"><div className="spinner"/> Carregando...</div>;

  const s = stats;

  return (
    <div className="page">
      <div className="page-header">
        <h1>Dashboard</h1>
        <p>Visão geral da sua frota</p>
      </div>

      <div className="stat-grid">
        <StatCard label="Total de Veículos" value={s.totalVehicles} sub={`${s.available} disponíveis`} color="var(--accent)" />
        <StatCard label="Veículos Locados"  value={s.rented}        sub={`${s.inMaintenance} em manutenção`} color="var(--green)" />
        <StatCard label="Locatários Ativos" value={s.activeTenants} color="var(--orange)" />
        <StatCard
          label="Pagamentos Pendentes"
          value={s.pendingPayments}
          sub={`R$ ${s.pendingAmount.toFixed(2).replace('.', ',')}`}
          color="var(--red)"
        />
        <StatCard label="Manutenções Agendadas" value={s.pendingMaint} color="var(--orange)" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <VehicleStatusChart rented={s.rented} available={s.available} maintenance={s.inMaintenance} />
        <PaymentSummary pending={s.pendingPayments} amount={s.pendingAmount} />
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, color }) {
  return (
    <div className="stat-card">
      <div className="label">{label}</div>
      <div className="value" style={{ color }}>{value}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  );
}

function VehicleStatusChart({ rented, available, maintenance }) {
  const total = rented + available + maintenance || 1;
  const bars = [
    { label: 'Locado',      value: rented,      color: 'var(--green)' },
    { label: 'Disponível',  value: available,    color: 'var(--accent)' },
    { label: 'Manutenção',  value: maintenance,  color: 'var(--orange)' },
  ];

  return (
    <div className="table-wrap" style={{ padding: 20 }}>
      <div className="section-header"><h2>Status da Frota</h2></div>
      {bars.map(b => (
        <div key={b.label} style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
            <span style={{ color: 'var(--muted)' }}>{b.label}</span>
            <span style={{ color: b.color, fontWeight: 600 }}>{b.value}</span>
          </div>
          <div style={{ height: 6, background: 'var(--border)', borderRadius: 99 }}>
            <div style={{ height: '100%', width: `${(b.value / total) * 100}%`, background: b.color, borderRadius: 99, transition: 'width .4s' }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function PaymentSummary({ pending, amount }) {
  return (
    <div className="table-wrap" style={{ padding: 20 }}>
      <div className="section-header"><h2>Financeiro</h2></div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ background: 'var(--surface)', borderRadius: 8, padding: '16px 20px' }}>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>Cobranças em aberto</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--red)' }}>{pending}</div>
        </div>
        <div style={{ background: 'var(--surface)', borderRadius: 8, padding: '16px 20px' }}>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>Valor pendente total</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--orange)' }}>
            R$ {amount.toFixed(2).replace('.', ',')}
          </div>
        </div>
      </div>
    </div>
  );
}
