import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import DashboardV2 from '../components/DashboardV2';

export default function DashboardPage({ onNavigate }) {
  const [vehicles, setVehicles] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [allActiveTenants, setAllActiveTenants] = useState([]);
  const [pendingInspections, setPendingInspections] = useState([]);
  const [weekInvoices, setWeekInvoices] = useState({});
  const [weekRev, setWeekRev] = useState(0);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fleetAlerts, setFleetAlerts] = useState({ insurance: [], fines: [] });
  const [monthlyData, setMonthlyData] = useState([]);
  const [overdueInvoices, setOverdueInvoices] = useState([]);
  const [criticalExpiries, setCriticalExpiries] = useState([]);

  const loadInvoices = async () => {
    const now = new Date();
    const day = now.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const mon = new Date(now);
    mon.setDate(now.getDate() + diff);
    mon.setHours(0, 0, 0, 0);
    const { data } = await supabase
      .from('invoices')
      .select('id, tenant_id, status, payment_url, amount, week_label, due_date, paid_at')
      .gte('created_at', mon.toISOString())
      .neq('status', 'cancelled');
    const map = {};
    for (const inv of (data ?? [])) map[inv.tenant_id] = inv;
    setWeekInvoices(map);
  };

  useEffect(() => {
    async function load() {
      const today = new Date().toISOString().slice(0, 10);
      const d15 = new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10);
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
      sixMonthsAgo.setDate(1);
      const histStart = sixMonthsAgo.toISOString().slice(0, 10);

      const [vRes, tRes, pRes, iRes, fRes, hRes, ovRes, atRes, wiRes] = await Promise.all([
        supabase.from('vehicles').select('id, status, plate, model'),
        supabase.from('tenants').select('id, paid_status, contract_signature_url').then(r => ({
          ...r, data: (r.data ?? []).map(t => ({ ...t, paid: t.paid_status }))
        })),
        supabase.from('payments').select('id, paid_status, value_amount'),
        supabase.from('insurance')
          .select('id, expiry_date, insurer, vehicles(plate, brand, model)')
          .lte('expiry_date', d15).gte('expiry_date', today).order('expiry_date'),
        supabase.from('fines')
          .select('id, amount, description, due_date, status, vehicles(plate, brand, model), tenants!fines_tenant_id_fkey(id, name, phone)')
          .eq('status', 'pendente'),
        supabase.from('payments')
          .select('paid_date, value_amount, paid_status')
          .gte('paid_date', histStart).eq('paid_status', true).order('paid_date'),
        supabase.from('invoices')
          .select('id, tenant_id, amount, week_label, due_date, status, tenants(id, name, phone)')
          .in('status', ['pending', 'overdue'])
          .lt('due_date', today)
          .order('due_date', { ascending: true }),
        supabase.from('tenants')
          .select('id, name, phone, rent_weekly, billing_day, paid_status, status, vehicles!vehicle_id(plate, model, brand)')
          .eq('status', 'ativo'),
        supabase.from('weekly_inspections')
          .select('id, tenant_id, status, current_km, created_at, vehicle_id')
          .eq('status', 'pending'),
      ]);

      const v = vRes.data ?? [];
      const t = tRes.data ?? [];
      const p = pRes.data ?? [];

      const paidThisWeek = p.filter(x => x.paid_status).reduce((s, x) => s + (x.value_amount || 0), 0);
      const expenses = p.filter(x => !x.paid_status).reduce((s, x) => s + (x.value_amount || 0), 0);

      const pendingSignatures = t.filter(x => !x.contract_signature_url);

      const histPayments = hRes.data ?? [];
      const months = {};
      const MONTH_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      for (let i = 0; i < 6; i++) {
        const d = new Date();
        d.setMonth(d.getMonth() - (5 - i));
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        months[key] = { label: MONTH_LABELS[d.getMonth()], total: 0 };
      }
      for (const hp of histPayments) {
        if (!hp.paid_date) continue;
        const key = hp.paid_date.slice(0, 7);
        if (months[key]) months[key].total += (hp.value_amount || 0);
      }

      setVehicles(v);
      setTenants(t);
      setWeekRev(paidThisWeek);
      setTotalExpenses(expenses);
      setAlerts([]);
      setFleetAlerts({ insurance: iRes.data ?? [], fines: fRes.data ?? [], pendingSignatures });
      setMonthlyData(Object.values(months));
      setOverdueInvoices(ovRes.data ?? []);
      setAllActiveTenants(atRes.data ?? []);
      setPendingInspections(wiRes.data ?? []);

      // Vencimentos críticos (<= 7 dias) para banner
      const in7 = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
      const criticalList = [];

      const { data: critVehs } = await supabase.from('vehicles')
        .select('id, plate, model, brand, docs_seguro, docs_ipva')
        .or(`docs_seguro.lte.${in7},docs_ipva.lte.${in7}`);

      for (const v of critVehs ?? []) {
        if (v.docs_seguro && v.docs_seguro <= in7 && v.docs_seguro >= today)
          criticalList.push({ type: 'seguro', label: `Seguro: ${v.brand} ${v.model} (${v.plate})`, date: v.docs_seguro });
        if (v.docs_ipva && v.docs_ipva <= in7 && v.docs_ipva >= today)
          criticalList.push({ type: 'ipva', label: `IPVA: ${v.brand} ${v.model} (${v.plate})`, date: v.docs_ipva });
      }

      const { data: critTenants } = await supabase.from('tenants')
        .select('id, name, cnh_expiry')
        .eq('status', 'ativo')
        .gte('cnh_expiry', today)
        .lte('cnh_expiry', in7);

      for (const t of critTenants ?? []) {
        if (t.cnh_expiry)
          criticalList.push({ type: 'cnh', label: `CNH: ${t.name}`, date: t.cnh_expiry });
      }

      setCriticalExpiries(criticalList);
      setLoading(false);
    }
    load();
    loadInvoices();
  }, []);

  if (loading) return <div className="loading"><div className="spinner" /> Carregando...</div>;

  return (
    <div className="page">
      <DashboardV2
        vehicles={vehicles}
        tenants={tenants}
        weekRev={weekRev}
        totalExpenses={totalExpenses}
        fleetAlerts={fleetAlerts}
        monthlyData={monthlyData}
        overdueInvoices={overdueInvoices}
        allActiveTenants={allActiveTenants}
        pendingInspections={pendingInspections}
        criticalExpiries={criticalExpiries}
        onNavigate={onNavigate}
      />
    </div>
  );
}
