import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import {
  ChevronRight, Video, MessageSquare, Zap, BarChart3,
  AlertCircle, FileWarning, Wrench, ShieldAlert, Car
} from 'lucide-react';
import { ptDate, fmt, monthRange } from '../lib/shared';

const NAVY = '#102A57';
const AMBER = '#FFC524';
const BG = '#F6F6F4';

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

function formatDatePT(date) {
  const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return `${days[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

export default function Central({ onNavigate }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    score: 0,
    revenue: 0,
    revenueExpected: 0,
    prevMonthRevenue: 0,
    locados: 0,
    totalVehicles: 0,
    overdueTotal: 0,
    next7dRevenue: 0,
    bestTenant: null,
    priorities: [],
    vehiclesProfitability: [],
  });

  useEffect(() => {
    async function loadCentralData() {
      try {
        const today = new Date().toISOString().slice(0, 10);
        const in7 = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
        const in15 = new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10);
        const in30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

        const [mStart, mEnd] = monthRange();
        const monthStart = mStart.toISOString().slice(0, 10);
        const monthEnd = mEnd.toISOString().slice(0, 10);

        const prevMStart = new Date(mStart.getFullYear(), mStart.getMonth() - 1, 1);
        const prevMEnd = new Date(mStart.getFullYear(), mStart.getMonth(), 0, 23, 59, 59);
        const prevMonthStart = prevMStart.toISOString().slice(0, 10);
        const prevMonthEnd = prevMEnd.toISOString().slice(0, 10);

        const weekStart = (() => {
          const now = new Date();
          const day = now.getDay();
          const diff = day === 0 ? -6 : 1 - day;
          const mon = new Date(now);
          mon.setDate(now.getDate() + diff);
          return mon.toISOString().slice(0, 10);
        })();

        const [vRes, tRes, iRes, fRes, insRes, checkRes, maintRes] = await Promise.all([
          supabase.from('vehicles').select('*'),
          supabase.from('tenants').select('*, vehicles!vehicle_id(id, plate, model)').eq('status', 'ativo'),
          supabase.from('invoices').select('*, tenants(name)').in('status', ['pending', 'overdue']),
          supabase.from('fines').select('*, vehicles(plate), tenants(name)').eq('status', 'pendente'),
          supabase.from('weekly_inspections').select('*, tenants(name), vehicles(plate)').eq('status', 'pending'),
          supabase.from('weekly_checks').select('*, tenants(name), vehicles(plate)').eq('status', 'submitted'),
          supabase.from('maintenance').select('*, vehicles(plate)').eq('done', false)
        ]);

        const vehicles = vRes.data || [];
        const tenants = tRes.data || [];
        const invoices = iRes.data || [];
        const fines = fRes.data || [];
        const inspections = insRes.data || [];
        const checks = checkRes.data || [];
        const maintenance = maintRes.data || [];

        // Month financials — bulk queries
        const [monthInvRes, prevMonthInvRes, next7dRes, monthMaintRes, monthFinesPaidRes] = await Promise.all([
          supabase.from('invoices')
            .select('tenant_id, amount, status, due_date')
            .gte('due_date', monthStart)
            .lte('due_date', monthEnd),
          supabase.from('invoices')
            .select('amount')
            .eq('status', 'paid')
            .gte('due_date', prevMonthStart)
            .lte('due_date', prevMonthEnd),
          supabase.from('invoices')
            .select('amount')
            .in('status', ['pending'])
            .gte('due_date', today)
            .lte('due_date', in7),
          supabase.from('maintenance')
            .select('vehicle_id, cost')
            .gte('created_at', monthStart + 'T00:00:00'),
          supabase.from('fines')
            .select('vehicle_id, amount')
            .eq('status', 'pago')
            .gte('created_at', monthStart + 'T00:00:00'),
        ]);

        const monthInvoices = monthInvRes.data || [];
        const revenue = monthInvoices.filter(i => i.status === 'paid').reduce((s, i) => s + (i.amount || 0), 0);
        const revenueExpected = monthInvoices.reduce((s, i) => s + (i.amount || 0), 0);
        const prevMonthRevenue = (prevMonthInvRes.data || []).reduce((s, i) => s + (i.amount || 0), 0);
        const next7dRevenue = (next7dRes.data || []).reduce((s, i) => s + (i.amount || 0), 0);
        const monthMaint = monthMaintRes.data || [];
        const monthFinesPaid = monthFinesPaidRes.data || [];

        // KPIs base
        const locados = vehicles.filter(v => v.status === 'locado').length;
        const overdueInv = invoices.filter(inv => inv.due_date < today);
        const overdueTotal = overdueInv.reduce((s, i) => s + (i.amount || 0), 0);
        const overdueCount = overdueInv.length;

        // Fleet score
        const ocupacaoScore = vehicles.length > 0 ? (locados / vehicles.length) * 100 : 100;
        const paidCount = monthInvoices.filter(i => i.status === 'paid').length;
        const totalInvCount = monthInvoices.length;
        const adimplenciaScore = totalInvCount > 0
          ? ((totalInvCount - overdueCount) / totalInvCount) * 100
          : 100;
        const vencimentos30d =
          vehicles.filter(v => (v.docs_seguro && v.docs_seguro <= in30) || (v.docs_ipva && v.docs_ipva <= in30)).length +
          tenants.filter(t => t.cnh_expiry && t.cnh_expiry <= in30).length;
        const documentacaoScore = Math.max(0, 100 - vencimentos30d * 15);
        const weekChecksRes = await supabase.from('weekly_checks')
          .select('id', { count: 'exact' })
          .gte('week_start', weekStart);
        const receivedCheckins = weekChecksRes.count || 0;
        const expectedCheckins = tenants.length || 1;
        const checkinsScore = (receivedCheckins / expectedCheckins) * 100;
        const score = Math.round(
          ocupacaoScore * 0.35 +
          adimplenciaScore * 0.35 +
          documentacaoScore * 0.20 +
          Math.min(checkinsScore, 100) * 0.10
        );

        // Best tenant (highest monthly value)
        const bestTenant = tenants.reduce((best, t) => {
          const val = Number(t.rent_weekly || t.rent_amount || 0);
          return (!best || val > best.val) ? { name: t.name, val } : best;
        }, null);

        // Per-vehicle profitability
        const activeVehicles = vehicles.filter(v => v.status === 'locado');
        // Build tenant→vehicle map from tenants (vehicle_id FK)
        const vehiclesProfitability = activeVehicles.map(v => {
          const linkedTenant = tenants.find(t => {
            const tv = t.vehicles;
            if (!tv) return false;
            if (Array.isArray(tv)) return tv.some(x => x.id === v.id);
            return tv.id === v.id;
          });
          const tenantId = linkedTenant?.id;
          const receita = tenantId
            ? monthInvoices.filter(i => i.tenant_id === tenantId && i.status === 'paid').reduce((s, i) => s + (i.amount || 0), 0)
            : 0;
          const custos =
            monthMaint.filter(m => m.vehicle_id === v.id).reduce((s, m) => s + (m.cost || 0), 0) +
            monthFinesPaid.filter(f => f.vehicle_id === v.id).reduce((s, f) => s + (f.amount || 0), 0);
          return {
            id: v.id,
            model: v.model || 'Veículo',
            plate: v.plate || '',
            profit: receita - custos,
          };
        }).sort((a, b) => b.profit - a.profit);

        // Priorities
        const priorityList = [];
        const d7Ago = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);

        invoices.filter(inv => inv.due_date <= d7Ago).forEach(inv => {
          priorityList.push({
            id: `inv-${inv.id}`,
            type: 'danger',
            title: `Débito Crítico: ${inv.tenants?.name || 'Motorista'}`,
            desc: `Atrasado desde ${ptDate(inv.due_date)}`,
            action: () => onNavigate('payments'),
            urgency: 100,
            amountAtRisk: inv.amount,
          });
        });

        vehicles.forEach(v => {
          if (v.docs_seguro && v.docs_seguro <= in15) {
            priorityList.push({
              id: `seg-${v.id}`,
              type: 'warning',
              title: `Seguro Vencendo: ${v.plate}`,
              desc: `Vence em ${ptDate(v.docs_seguro)}`,
              action: () => onNavigate('vehicles'),
              urgency: 80,
            });
          }
        });

        tenants.forEach(t => {
          if (t.cnh_expiry && t.cnh_expiry <= in15) {
            priorityList.push({
              id: `cnh-${t.id}`,
              type: 'warning',
              title: `CNH Vencendo: ${t.name}`,
              desc: `Vence em ${ptDate(t.cnh_expiry)}`,
              action: () => onNavigate('tenants'),
              urgency: 75,
            });
          }
        });

        checks.forEach(c => {
          priorityList.push({
            id: `check-${c.id}`,
            type: 'info',
            title: `Vídeo Semanal: ${c.tenants?.name || 'Motorista'}`,
            desc: `Aguardando revisão (${c.vehicles?.plate})`,
            action: () => onNavigate('automacao', { tab: 'video' }),
            urgency: 60,
          });
        });

        inspections.forEach(i => {
          priorityList.push({
            id: `insp-${i.id}`,
            type: 'info',
            title: `Vistoria: ${i.tenants?.name || 'Motorista'}`,
            desc: `Aprovação pendente (${i.vehicles?.plate})`,
            action: () => onNavigate('vehicles'),
            urgency: 50,
          });
        });

        maintenance.forEach(m => {
          priorityList.push({
            id: `maint-${m.id}`,
            type: 'maint',
            title: `Manutenção: ${m.vehicles?.plate}`,
            desc: m.description || 'Revisão necessária',
            action: () => onNavigate('maintenance'),
            urgency: 40,
          });
        });

        setData({
          score,
          revenue,
          revenueExpected,
          prevMonthRevenue,
          locados,
          totalVehicles: vehicles.length,
          overdueTotal,
          next7dRevenue,
          bestTenant,
          priorities: priorityList.sort((a, b) => b.urgency - a.urgency).slice(0, 5),
          vehiclesProfitability,
        });
      } catch (err) {
        console.error('Erro ao carregar Central:', err);
      } finally {
        setLoading(false);
      }
    }
    loadCentralData();
  }, [onNavigate]);

  if (loading) return <div className="loading"><div className="spinner" /> Sincronizando Central...</div>;

  const {
    score, revenue, revenueExpected, prevMonthRevenue,
    locados, totalVehicles, overdueTotal, next7dRevenue,
    bestTenant, priorities, vehiclesProfitability,
  } = data;

  const scoreColor = score >= 80 ? '#059669' : score >= 60 ? '#D97706' : '#DC2626';
  const scoreLabel = score >= 80 ? 'Operação Saudável' : score >= 60 ? 'Atenção Necessária' : 'Problemas Críticos';
  const progressPct = revenueExpected > 0 ? Math.min((revenue / revenueExpected) * 100, 100) : 0;
  const remaining = revenueExpected - revenue;

  const secondaryKpis = [
    {
      icon: '🚗',
      label: 'Ocupação',
      value: `${locados}/${totalVehicles}`,
      color: totalVehicles > 0 && locados / totalVehicles >= 0.8 ? '#059669' : '#D97706',
      onClick: () => onNavigate('vehicles'),
    },
    {
      icon: '⚠️',
      label: 'Em atraso',
      value: overdueTotal > 0 ? `R$ ${fmt(overdueTotal)}` : '✓ Zero',
      color: overdueTotal > 0 ? '#DC2626' : '#059669',
      onClick: () => onNavigate('payments'),
    },
    {
      icon: '📅',
      label: 'Próximos 7d',
      value: `R$ ${fmt(next7dRevenue)}`,
      color: NAVY,
      onClick: () => onNavigate('payments'),
    },
    {
      icon: '🏅',
      label: 'Top motorista',
      value: bestTenant?.name?.split(' ')[0] || '—',
      color: '#7C3AED',
      onClick: () => onNavigate('tenants'),
    },
  ];

  const maxProfit = vehiclesProfitability.length > 0
    ? Math.max(...vehiclesProfitability.map(v => v.profit), 1)
    : 1;

  return (
    <div style={{ background: BG, minHeight: '100vh', fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* ZONA 1: HEADER — Saudação + Score da Frota */}
      <div style={{ background: NAVY, padding: '20px 16px 24px', color: 'white' }}>
        <div style={{ fontSize: 22, fontWeight: 900 }}>
          {getGreeting()}, Willy 👋
        </div>
        <div style={{ fontSize: 12, opacity: 0.6, marginTop: 2 }}>
          {formatDatePT(new Date())}
        </div>
        <div style={{ marginTop: 16, background: 'rgba(255,255,255,0.12)', borderRadius: 8, height: 6 }}>
          <div style={{
            width: `${score}%`, height: '100%', background: scoreColor,
            borderRadius: 8, transition: 'width 1s ease',
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
          <span style={{ fontSize: 12, color: scoreColor, fontWeight: 700 }}>
            Score {score}/100 — {scoreLabel}
          </span>
          <span style={{ fontSize: 11, opacity: 0.5 }}>atualizado agora</span>
        </div>
      </div>

      <div style={{ padding: '20px 16px 110px' }}>

        {/* ZONA 2: HERO CARD — Receita do Mês */}
        <div style={{
          background: 'white', borderRadius: 24, padding: '24px',
          marginBottom: 16, boxShadow: '0 4px 24px rgba(16,42,87,0.08)',
        }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Receita do Mês
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 36, fontWeight: 900, color: NAVY, letterSpacing: '-1px' }}>
              R$ {fmt(revenue)}
            </span>
            {prevMonthRevenue > 0 && (
              <span style={{ fontSize: 13, fontWeight: 700, color: revenue >= prevMonthRevenue ? '#059669' : '#DC2626' }}>
                {revenue >= prevMonthRevenue ? '↑' : '↓'}
                {Math.abs(Math.round(((revenue - prevMonthRevenue) / prevMonthRevenue) * 100))}% vs mês ant.
              </span>
            )}
          </div>
          <div style={{ margin: '16px 0 8px' }}>
            <div style={{ background: '#F1F5F9', borderRadius: 6, height: 8 }}>
              <div style={{
                width: `${progressPct}%`, height: '100%', borderRadius: 6,
                background: progressPct >= 90 ? '#059669' : progressPct >= 60 ? AMBER : '#DC2626',
                transition: 'width 1.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
              }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
              <span style={{ fontSize: 12, color: '#64748B' }}>
                {Math.round(progressPct)}% de R$ {fmt(revenueExpected)} esperado
              </span>
              {remaining > 0 && (
                <span style={{ fontSize: 12, color: AMBER, fontWeight: 700 }}>
                  R$ {fmt(remaining)} a receber
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ZONA 3: KPIs SECUNDÁRIOS — Scroll horizontal */}
        <div style={{
          display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4,
          marginBottom: 20, WebkitOverflowScrolling: 'touch',
        }}>
          {secondaryKpis.map((k, i) => (
            <div key={i} onClick={k.onClick} style={{
              background: 'white', borderRadius: 16, padding: '14px 16px',
              minWidth: 110, flexShrink: 0, cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)', border: '1px solid #F1F5F9',
            }}>
              <div style={{ fontSize: 20 }}>{k.icon}</div>
              <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', marginTop: 8, letterSpacing: '0.05em' }}>
                {k.label}
              </div>
              <div style={{ fontSize: 15, fontWeight: 900, color: k.color, marginTop: 2 }}>
                {k.value}
              </div>
            </div>
          ))}
        </div>

        {/* ZONA 4: PRIORIDADES */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <h2 style={{ fontSize: 14, fontWeight: 800, color: NAVY, margin: 0 }}>
              O que fazer agora
            </h2>
            <span style={{
              fontSize: 11, background: 'white', padding: '2px 8px',
              borderRadius: 12, border: '1px solid #E2E8F0', color: '#64748B',
            }}>
              {priorities.length}
            </span>
          </div>

          {priorities.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {priorities.map(p => <PriorityItem key={p.id} {...p} />)}
            </div>
          ) : (
            <div style={{
              background: 'white', padding: '28px', borderRadius: 20,
              textAlign: 'center', border: '1px solid #E2E8F0',
            }}>
              <span style={{ fontSize: 28 }}>✅</span>
              <p style={{ fontWeight: 700, color: '#059669', margin: '10px 0 0' }}>Tudo em ordem por hoje!</p>
            </div>
          )}
        </div>

        {/* ZONA 5: RENTABILIDADE POR CARRO */}
        {vehiclesProfitability.length > 0 && (
          <div style={{ background: 'white', borderRadius: 24, padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 900, color: NAVY }}>Rentabilidade por Carro</div>
                <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>receita menos custos este mês</div>
              </div>
              <button onClick={() => onNavigate('vehicles')} style={{
                fontSize: 11, color: AMBER, fontWeight: 800, background: 'none', border: 'none', cursor: 'pointer',
              }}>
                Ver todos →
              </button>
            </div>

            {vehiclesProfitability.slice(0, 4).map(v => {
              const pct = maxProfit > 0 ? Math.max((v.profit / maxProfit) * 100, 0) : 0;
              const barColor = v.profit > 400 ? '#059669' : v.profit > 200 ? AMBER : '#DC2626';
              const status = v.profit > 400 ? 'Excelente' : v.profit > 200 ? 'Bom' : 'Atenção!';
              return (
                <div key={v.id} style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, alignItems: 'center' }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>
                      {v.model} <span style={{ color: '#94A3B8', fontWeight: 500 }}>{v.plate}</span>
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 900, color: NAVY }}>R$ {fmt(v.profit)}/mês</span>
                      <span style={{
                        fontSize: 10, fontWeight: 800, color: barColor,
                        background: barColor + '15', padding: '2px 6px', borderRadius: 6,
                      }}>{status}</span>
                    </div>
                  </div>
                  <div style={{ background: '#F1F5F9', borderRadius: 4, height: 6 }}>
                    <div style={{
                      width: `${pct}%`, height: '100%', borderRadius: 4,
                      background: barColor, transition: 'width 1s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* RODAPÉ FIXO */}
      <div style={{
        position: 'fixed', bottom: 20, left: 16, right: 16,
        background: NAVY, borderRadius: 24, padding: '16px',
        display: 'flex', justifyContent: 'space-around', alignItems: 'center',
        boxShadow: '0 12px 40px rgba(16,42,87,0.3)', zIndex: 100,
      }}>
        <ActionButton icon={<Video size={20} />} label="Vídeos" onClick={() => onNavigate('automacao', { tab: 'video' })} />
        <ActionButton icon={<MessageSquare size={20} />} label="Bot" onClick={() => onNavigate('automacao', { tab: 'bot' })} />
        <ActionButton icon={<Zap size={20} />} label="Motor" onClick={() => onNavigate('automacao', { tab: 'motor' })} />
        <ActionButton icon={<BarChart3 size={20} />} label="Dados" onClick={() => onNavigate('dashboard')} />
      </div>
    </div>
  );
}

const priorityColors = {
  danger:  { border: '#DC2626', bg: '#FFF5F5' },
  warning: { border: '#D97706', bg: '#FFFDF0' },
  info:    { border: '#2563EB', bg: '#F0F7FF' },
  maint:   { border: '#6B7280', bg: '#F9FAFB' },
};

function PriorityItem({ title, desc, type, action, amountAtRisk }) {
  const c = priorityColors[type] || priorityColors.info;
  return (
    <div onClick={action} style={{
      background: c.bg, borderRadius: 16, borderLeft: `4px solid ${c.border}`,
      padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: '#0F172A' }}>{title}</div>
        <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>{desc}</div>
      </div>
      {amountAtRisk > 0 && (
        <div style={{
          background: c.border + '20', color: c.border,
          fontSize: 12, fontWeight: 900, padding: '4px 10px', borderRadius: 8, whiteSpace: 'nowrap',
        }}>
          R$ {fmt(amountAtRisk)}
        </div>
      )}
      <ChevronRight size={16} color="#CBD5E1" />
    </div>
  );
}

function ActionButton({ icon, label, onClick }) {
  return (
    <button onClick={onClick} style={{
      background: 'transparent', border: 'none', color: 'white',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
      cursor: 'pointer', opacity: 0.9,
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: 16,
        background: 'rgba(255,255,255,0.08)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {icon}
      </div>
      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.05em' }}>{label.toUpperCase()}</span>
    </button>
  );
}
