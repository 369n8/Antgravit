import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  TrendingUp, Users, Car, AlertCircle, 
  Video, MessageSquare, Zap, BarChart3,
  ChevronRight, Calendar, FileWarning, Wrench, ShieldAlert
} from 'lucide-react';
import { ptDate, fmt, monthRange } from '../lib/shared';

const NAVY = '#102A57';
const AMBER = '#FFC524';
const BG = '#F6F6F4';

export default function Central({ onNavigate }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    kpis: { revenue: 0, revenueExpected: 0, occupancy: '0/0', overdueCount: 0, overdueTotal: 0, alertsCount: 0 },
    priorities: [],
    raw: { vehicles: [], tenants: [], invoices: [], inspections: [], checks: [], maintenance: [], fines: [] }
  });

  useEffect(() => {
    async function loadCentralData() {
      const today = new Date().toISOString().slice(0, 10);
      const in7 = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
      const in15 = new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10);

      const [vRes, tRes, iRes, fRes, insRes, checkRes, maintRes] = await Promise.all([
        supabase.from('vehicles').select('*'),
        supabase.from('tenants').select('*, vehicles(plate, model)').eq('status', 'ativo'),
        supabase.from('invoices').select('*, tenants(name)').in('status', ['pending', 'overdue']),
        supabase.from('fines').select('*, vehicles(plate), tenants(name)').eq('status', 'pendente'),
        supabase.from('weekly_inspections').select('*, tenants(name), vehicles(plate)').eq('status', 'pending'),
        supabase.from('weekly_checks').select('*, tenants(name), vehicles(plate)').eq('status', 'submitted'),
        supabase.from('maintenance').select('*, vehicles(plate)').eq('status', 'pendente')
      ]);

      const vehicles = vRes.data || [];
      const tenants = tRes.data || [];
      const invoices = iRes.data || []; // Note: iRes only got pending/overdue in the first version. Fixing now.
      
      const { start: mStart, end: mEnd } = monthRange();
      const monthInvRes = await supabase.from('invoices')
        .select('amount, status, due_date')
        .gte('due_date', mStart.toISOString().slice(0, 10))
        .lte('due_date', mEnd.toISOString().slice(0, 10));
      
      const monthInvoices = monthInvRes.data || [];
      const revenuePaid = monthInvoices.filter(i => i.status === 'paid').reduce((s, i) => s + (i.amount || 0), 0);
      const revenueExpected = monthInvoices.reduce((s, i) => s + (i.amount || 0), 0);

      const fines = fRes.data || [];
      const inspections = insRes.data || [];
      const checks = checkRes.data || [];
      const maintenance = maintRes.data || [];

      // KPIs
      const locados = vehicles.filter(v => v.status === 'locado').length;
      const overdueInv = invoices.filter(inv => inv.due_date < today && (inv.status === 'pending' || inv.status === 'overdue'));
      const overdueTotal = overdueInv.reduce((s, i) => s + (i.amount || 0), 0);
      const criticalExpiries = [
        ...vehicles.filter(v => (v.docs_seguro && v.docs_seguro <= in7) || (v.docs_ipva && v.docs_ipva <= in7)),
        ...tenants.filter(t => t.cnh_expiry && t.cnh_expiry <= in7)
      ];

      // Prioridades
      const priorityList = [];

      // 1. Pagamentos vencidos > 7 dias (Crítico)
      const d7Ago = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
      invoices.filter(inv => inv.due_date <= d7Ago).forEach(inv => {
        priorityList.push({
          id: `inv-${inv.id}`,
          type: 'danger',
          icon: <AlertCircle size={18} />,
          title: `Débito Crítico: ${inv.tenants?.name || 'Motorista'}`,
          desc: `Atrasado desde ${ptDate(inv.due_date)} · R$ ${fmt(inv.amount)}`,
          action: () => onNavigate('payments'),
          urgency: 100
        });
      });

      // 2. Vencimentos < 15 dias (Avisos)
      vehicles.forEach(v => {
        if (v.docs_seguro && v.docs_seguro <= in15) {
          priorityList.push({
            id: `seg-${v.id}`,
            type: 'warning',
            icon: <ShieldAlert size={18} />,
            title: `Seguro Vencendo: ${v.plate}`,
            desc: `Vence em ${ptDate(v.docs_seguro)}`,
            action: () => onNavigate('vehicles'),
            urgency: 80
          });
        }
      });
      tenants.forEach(t => {
        if (t.cnh_expiry && t.cnh_expiry <= in15) {
          priorityList.push({
            id: `cnh-${t.id}`,
            type: 'warning',
            icon: <FileWarning size={18} />,
            title: `CNH Vencendo: ${t.name}`,
            desc: `Vence em ${ptDate(t.cnh_expiry)}`,
            action: () => onNavigate('tenants'),
            urgency: 75
          });
        }
      });

      // 3. Vistorias/Checks Pendentes
      checks.forEach(c => {
        priorityList.push({
          id: `check-${c.id}`,
          type: 'info',
          icon: <Video size={18} />,
          title: `Novo Vídeo Semanal: ${c.tenants?.name || 'Motorista'}`,
          desc: `Aguardando sua revisão (${c.vehicles?.plate})`,
          action: () => onNavigate('automacao'),
          urgency: 60
        });
      });

      inspections.forEach(i => {
        priorityList.push({
          id: `insp-${i.id}`,
          type: 'info',
          icon: <Car size={18} />,
          title: `Vistoria de Check-in: ${i.tenants?.name || 'Motorista'}`,
          desc: `Aprovação pendente (${i.vehicles?.plate})`,
          action: () => onNavigate('vehicles'),
          urgency: 50
        });
      });

      // 4. Manutenção
      maintenance.forEach(m => {
        priorityList.push({
          id: `maint-${m.id}`,
          type: 'maint',
          icon: <Wrench size={18} />,
          title: `Manutenção Pendente: ${m.vehicles?.plate}`,
          desc: m.description || 'Revisão necessária',
          action: () => onNavigate('maintenance'),
          urgency: 40
        });
      });

      setData({
        kpis: {
          revenue: revenuePaid,
          revenueExpected: revenueExpected,
          occupancy: `${locados}/${vehicles.length}`,
          overdueCount: overdueInv.length,
          overdueTotal,
          alertsCount: criticalExpiries.length + fines.length
        },
        priorities: priorityList.sort((a, b) => b.urgency - a.urgency).slice(0, 5),
        raw: { vehicles, tenants, invoices, inspections, checks, maintenance, fines }
      });
      setLoading(false);
    }

    loadCentralData();
  }, [onNavigate]);

  if (loading) return <div className="loading"><div className="spinner" /> Sincronizando Central...</div>;

  return (
    <div style={{ 
      background: BG, 
      minHeight: '100vh', 
      padding: '24px 16px 100px',
      fontFamily: 'Inter, system-ui, sans-serif'
    }}>
      
      {/* ZONA 1: KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
        <KpiCard 
          label="Ocupação" 
          value={data.kpis.occupancy} 
          icon={<Car size={20} color={NAVY} />} 
          onClick={() => onNavigate('vehicles')}
        />
        <KpiCard 
          label="Inadimplência" 
          value={`R$ ${fmt(data.kpis.overdueTotal)}`} 
          subValue={`${data.kpis.overdueCount} atrasados`}
          icon={<AlertCircle size={20} color="#DC2626" />} 
          color="#DC2626"
          onClick={() => onNavigate('payments')}
        />
        <KpiCard 
          label="Alertas Médios" 
          value={data.kpis.alertsCount} 
          icon={<Zap size={20} color={AMBER} />} 
          onClick={() => onNavigate('fines')}
        />
        <KpiCard 
          label="Receita Mês" 
          value={`R$ ${fmt(data.kpis.revenue)}`} 
          subValue={`Esperado: R$ ${fmt(data.kpis.revenueExpected)}`}
          icon={<TrendingUp size={20} color="#059669" />} 
          onClick={() => onNavigate('payments')}
        />
      </div>

      {/* ZONA 2: Prioridades do Dia */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: NAVY, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          Prioridades do Dia
          <span style={{ fontSize: 12, background: 'white', padding: '2px 8px', borderRadius: 12, border: '1px solid #E2E8F0' }}>{data.priorities.length}</span>
        </h2>
        
        {data.priorities.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {data.priorities.map(p => (
              <PriorityItem key={p.id} {...p} />
            ))}
          </div>
        ) : (
          <div style={{ 
            background: 'white', padding: '32px', borderRadius: 24, textAlign: 'center',
            border: '1px solid #E2E8F0'
          }}>
            <span style={{ fontSize: 32 }}>✅</span>
            <p style={{ fontWeight: 700, color: '#059669', marginTop: 12 }}>Tudo em ordem por hoje!</p>
          </div>
        )}
      </div>

      {/* ZONA 3: Ações Rápidas (Floating Footer) */}
      <div style={{
        position: 'fixed', bottom: 20, left: 16, right: 16,
        background: NAVY, borderRadius: 24, padding: '16px',
        display: 'flex', justifyContent: 'space-around', alignItems: 'center',
        boxShadow: '0 12px 40px rgba(16,42,87,0.3)',
        zIndex: 100
      }}>
        <ActionButton icon={<Video size={20} />} label="Vídeos" onClick={() => onNavigate('automacao')} />
        <ActionButton icon={<MessageSquare size={20} />} label="Bot" onClick={() => onNavigate('automacao')} />
        <ActionButton icon={<Zap size={20} />} label="Motor" onClick={() => onNavigate('automacao')} />
        <ActionButton icon={<BarChart3 size={20} />} label="Dados" onClick={() => onNavigate('dashboard')} />
      </div>

    </div>
  );
}

function KpiCard({ label, value, subValue, icon, color = NAVY, onClick }) {
  return (
    <div onClick={onClick} style={{
      background: 'white', padding: '20px', borderRadius: 24,
      border: '1px solid #F1F5F9', boxShadow: '0 4px 12px rgba(0,0,0,0.02)',
      cursor: 'pointer'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: `${color}10`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {icon}
        </div>
        <ChevronRight size={16} color="#94A3B8" />
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 900, color: NAVY, marginTop: 4 }}>{value}</div>
      {subValue && <div style={{ fontSize: 11, color: color, fontWeight: 600, marginTop: 2 }}>{subValue}</div>}
    </div>
  );
}

function PriorityItem({ icon, title, desc, type, action }) {
  const colors = {
    danger: { bg: '#FEF2F2', border: '#FEE2E2', icon: '#DC2626' },
    warning: { bg: '#FFFBEB', border: '#FEF3C7', icon: '#D97706' },
    info: { bg: '#EFF6FF', border: '#DBEAFE', icon: '#2563EB' },
    maint: { bg: '#F8FAFB', border: '#F1F5F9', icon: NAVY }
  };

  const c = colors[type] || colors.info;

  return (
    <div onClick={action} style={{
      background: 'white', border: '1px solid #F1F5F9', borderRadius: 20,
      padding: '16px', display: 'flex', alignItems: 'center', gap: 16,
      cursor: 'pointer', transition: 'transform 0.2s',
      boxShadow: '0 2px 6px rgba(0,0,0,0.01)'
    }}>
      <div style={{ 
        width: 44, height: 44, borderRadius: 14, 
        background: c.bg, border: `1px solid ${c.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0
      }}>
        {icon}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: NAVY }}>{title}</div>
        <div style={{ fontSize: 12, color: '#64748B', fontWeight: 500, marginTop: 2 }}>{desc}</div>
      </div>
      <ChevronRight size={18} color="#CBD5E1" />
    </div>
  );
}

function ActionButton({ icon, label, onClick }) {
  return (
    <button onClick={onClick} style={{
      background: 'transparent', border: 'none', color: 'white',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
      cursor: 'pointer', opacity: 0.9
    }}>
      <div style={{ 
        width: 44, height: 44, borderRadius: 16, 
        background: 'rgba(255,255,255,0.08)',
        display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}>
        {icon}
      </div>
      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.05em' }}>{label.toUpperCase()}</span>
    </button>
  );
}
