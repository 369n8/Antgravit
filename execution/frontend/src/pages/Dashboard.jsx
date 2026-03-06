import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import Dashboard from '../components/Dashboard';

export default function DashboardPage({ onNavigate }) {
  const [vehicles, setVehicles]   = useState([]);
  const [tenants, setTenants]     = useState([]);
  const [weekRev, setWeekRev]     = useState(0);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [alerts, setAlerts]       = useState([]);
  const [loading, setLoading]     = useState(true);

  const [fleetAlerts, setFleetAlerts] = useState({ insurance: [], fines: [] });

  useEffect(() => {
    async function load() {
      const today = new Date().toISOString().slice(0, 10);
      const d15   = new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10);

      const [vRes, tRes, pRes, iRes, fRes] = await Promise.all([
        supabase.from('vehicles').select('id, status, plate, model'),
        supabase.from('tenants').select('id, paid_status').then(r => ({
          ...r, data: (r.data ?? []).map(t => ({ ...t, paid: t.paid_status }))
        })),
        supabase.from('payments').select('id, paid_status, value_amount'),
        supabase.from('insurance')
          .select('id, expiry_date, insurer, vehicles(plate, brand, model)')
          .lte('expiry_date', d15)
          .gte('expiry_date', today)
          .order('expiry_date'),
        supabase.from('fines')
          .select('id, amount, description, due_date, vehicles(plate, brand, model)')
          .eq('status', 'pendente'),
      ]);

      const v = vRes.data ?? [];
      const t = tRes.data ?? [];
      const p = pRes.data ?? [];

      const paidThisWeek = p.filter(x => x.paid_status).reduce((s, x) => s + (x.value_amount || 0), 0);
      const expenses     = p.filter(x => !x.paid_status).reduce((s, x) => s + (x.value_amount || 0), 0);

      setVehicles(v);
      setTenants(t);
      setWeekRev(paidThisWeek);
      setTotalExpenses(expenses);
      setAlerts([]);
      setFleetAlerts({ insurance: iRes.data ?? [], fines: fRes.data ?? [] });
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <div className="loading"><div className="spinner"/> Carregando...</div>;

  return (
    <div className="page">
      <Dashboard vehicles={vehicles} tenants={tenants} alerts={alerts} weekRev={weekRev} totalExpenses={totalExpenses} fleetAlerts={fleetAlerts} onNavigate={onNavigate} />
    </div>
  );
}
