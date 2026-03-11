// DEPRECATED — usar DashboardV2.jsx (em components/) via pages/Dashboard.jsx
// Este arquivo não está roteado no App.jsx. Mantido apenas para referência histórica.
import { useState, useMemo } from 'react';
import { TrendingUp, CheckCircle, ArrowUpRight, MessageCircle, Zap, Copy, ShieldAlert, FileWarning, ClipboardCheck, Banknote, Wrench } from 'lucide-react';
import { S, daysUntil, ptDate } from '../lib/shared';
import { api } from '../services/api';

const bdg = S.bdg;

/* ── WhatsApp link builder ── */
function waMsg(phone, msg) {
  const num = (phone ?? '').replace(/\D/g, '');
  if (!num) return null;
  return `https://wa.me/55${num}?text=${encodeURIComponent(msg)}`;
}

/* ── Executive Summary: consolidates all critical actions ── */
function useExecutiveSummary({ overdueInvoices = [], fines = [], pendingInspections = [], allActiveTenants = [], fleetAlerts = {} }) {
  return useMemo(() => {
    const alerts = [];
    const tenantMap = Object.fromEntries(allActiveTenants.map(t => [t.id, t]));

    // 1. Faturas em atraso (financeiro crítico)
    for (const inv of overdueInvoices) {
      const tenant = inv.tenants ?? tenantMap[inv.tenant_id];
      const days = inv.due_date ? Math.floor((Date.now() - new Date(inv.due_date)) / 86400000) : 0;
      alerts.push({
        id: `inv-${inv.id}`,
        type: 'financial',
        priority: days >= 7 ? 0 : 1,
        icon: Banknote,
        color: '#DC2626',
        bg: '#FEF2F2',
        label: 'FINANCEIRO',
        title: `${tenant?.name ?? 'Motorista'} — fatura atrasada`,
        detail: `${inv.week_label ?? 'Semana'} · R$ ${Number(inv.amount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} · ${days}d em atraso`,
        phone: tenant?.phone,
        waText: `Olá ${tenant?.name?.split(' ')[0] ?? ''}! Sua fatura de R$ ${Number(inv.amount || 0).toFixed(2)} está em atraso. Acesse o link para regularizar e manter seu veículo ativo.`,
        navPage: 'tenants',
      });
    }

    // 2. Multas pendentes (jurídico)
    for (const fine of fines) {
      const tenant = fine.tenants;
      const veh = fine.vehicles;
      alerts.push({
        id: `fine-${fine.id}`,
        type: 'legal',
        priority: 1,
        icon: FileWarning,
        color: '#9333EA',
        bg: '#FAF5FF',
        label: 'MULTA',
        title: `${veh ? `${veh.brand ?? ''} ${veh.model ?? ''} · ${veh.plate ?? ''}`.trim() : 'Veículo'} — infração`,
        detail: `R$ ${Number(fine.amount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}${fine.description ? ` · ${fine.description.slice(0, 50)}` : ''}${tenant ? ` · Resp: ${tenant.name}` : ''}`,
        phone: tenant?.phone,
        waText: tenant ? `Olá ${tenant.name?.split(' ')[0] ?? ''}! Há uma multa de R$ ${Number(fine.amount).toFixed(2)} atrelada ao seu período de locação. Entre em contato conosco para indicação do condutor.` : null,
        navPage: 'fines',
        fineId: fine.id,
      });
    }

    // 3. Vistorias pendentes de aprovação
    for (const insp of pendingInspections) {
      const tenant = tenantMap[insp.tenant_id];
      alerts.push({
        id: `insp-${insp.id}`,
        type: 'inspection',
        priority: 2,
        icon: ClipboardCheck,
        color: '#2563EB',
        bg: '#EFF6FF',
        label: 'VISTORIA',
        title: `${tenant?.name ?? 'Motorista'} — vistoria enviada`,
        detail: `${new Date(insp.created_at).toLocaleDateString('pt-BR')} · ${insp.current_km ? insp.current_km.toLocaleString('pt-BR') + ' km' : '—'}`,
        navPage: 'tenants',
        inspectionId: insp.id,
      });
    }

    // 4. Contratos não assinados
    for (const t of (fleetAlerts.pendingSignatures ?? [])) {
      alerts.push({
        id: `sig-${t.id}`,
        type: 'contract',
        priority: 2,
        icon: ShieldAlert,
        color: '#D97706',
        bg: '#FFFBEB',
        label: 'CONTRATO',
        title: `${t.name} — assinatura pendente`,
        detail: 'Locatário ainda não assinou o contrato digital',
        navPage: 'tenants',
      });
    }

    // 5. Seguros vencendo
    for (const ins of (fleetAlerts.insurance ?? [])) {
      const veh = ins.vehicles;
      const d = ins.expiry_date ? Math.ceil((new Date(ins.expiry_date) - Date.now()) / 86400000) : null;
      alerts.push({
        id: `ins-${ins.id}`,
        type: 'fleet',
        priority: d !== null && d <= 3 ? 0 : 2,
        icon: Wrench,
        color: d !== null && d <= 3 ? '#DC2626' : '#D97706',
        bg: d !== null && d <= 3 ? '#FEF2F2' : '#FFFBEB',
        label: 'SEGURO',
        title: `${veh ? `${veh.brand ?? ''} ${veh.model ?? ''} · ${veh.plate ?? ''}`.trim() : 'Veículo'} — seguro vence em ${d ?? '?'}d`,
        detail: `${ins.insurer ?? 'Seguradora'} · Vence ${ptDate(ins.expiry_date)}`,
        navPage: 'maintenance',
      });
    }

    alerts.sort((a, b) => a.priority - b.priority);
    return alerts;
  }, [overdueInvoices, fines, pendingInspections, allActiveTenants, fleetAlerts]);
}

/* ── Intelligence Panel ── */
function IntelligencePanel({ alerts, onNavigate, onDismissAlert }) {
  const [actioning, setActioning] = useState({});
  const [done, setDone] = useState({});

  const markDone = (id) => setDone(p => ({ ...p, [id]: true }));

  const handleApproveInspection = async (alert) => {
    setActioning(p => ({ ...p, [alert.id]: true }));
    try {
      await supabase.from('weekly_inspections').update({ status: 'approved' }).eq('id', alert.inspectionId);
      markDone(alert.id);
    } catch (e) { alert('Erro: ' + e.message); }
    finally { setActioning(p => ({ ...p, [alert.id]: false })); }
  };

  const handleMarkFineIndicated = async (alert) => {
    setActioning(p => ({ ...p, [alert.id]: true }));
    try {
      await supabase.from('fines').update({ status: 'indicacao_feita' }).eq('id', alert.fineId);
      markDone(alert.id);
    } catch (e) { alert('Erro: ' + e.message); }
    finally { setActioning(p => ({ ...p, [alert.id]: false })); }
  };

  const visible = alerts.filter(a => !done[a.id]);
  const critical = visible.filter(a => a.priority === 0).length;

  if (visible.length === 0) {
    return (
      <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-lg)', padding: '32px 40px', display: 'flex', alignItems: 'center', gap: 20 }}>
        <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <CheckCircle size={26} color="#16A34A" />
        </div>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.5px' }}>Operação limpa</div>
          <div style={{ fontSize: 14, color: 'var(--muted)', fontWeight: 500, marginTop: 4 }}>Nenhuma ação crítica pendente. Aproveite para escalar a frota.</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
      {/* Header bar */}
      <div style={{
        background: critical > 0
          ? 'linear-gradient(135deg, #1A0505 0%, #2D0A0A 100%)'
          : 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
        padding: '24px 32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 44, height: 44, borderRadius: 14, background: critical > 0 ? '#DC2626' : '#3B82F6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ShieldAlert size={22} color="#fff" />
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', letterSpacing: '-0.5px' }}>Centro de Comando</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', fontWeight: 500, marginTop: 2 }}>
              {visible.length} ação{visible.length !== 1 ? 'ões' : ''} pendente{visible.length !== 1 ? 's' : ''}
              {critical > 0 && <span style={{ marginLeft: 8, color: '#FCA5A5', fontWeight: 700 }}>· {critical} crítica{critical !== 1 ? 's' : ''}</span>}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {['financial', 'legal', 'inspection', 'contract', 'fleet'].map(type => {
            const count = visible.filter(a => a.type === type).length;
            if (!count) return null;
            const labels = { financial: '💸', legal: '⚖️', inspection: '📋', contract: '📄', fleet: '🛡️' };
            return (
              <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,0.08)', borderRadius: 999, padding: '6px 12px' }}>
                <span>{labels[type]}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.8)' }}>{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Alert list */}
      <div style={{ display: 'flex', flexDirection: 'column', divide: 'y' }}>
        {visible.map((alert, idx) => {
          const Icon = alert.icon;
          const isLast = idx === visible.length - 1;
          const isActioning = actioning[alert.id];
          const wa = alert.phone && alert.waText ? waMsg(alert.phone, alert.waText) : null;

          return (
            <div
              key={alert.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '4px auto 1fr auto',
                gap: 0,
                borderBottom: isLast ? 'none' : '1px solid var(--bg)',
                background: 'var(--surface)',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
              onMouseLeave={e => e.currentTarget.style.background = 'var(--surface)'}
            >
              {/* Priority stripe */}
              <div style={{ background: alert.color, borderRadius: '0px', alignSelf: 'stretch' }} />

              {/* Icon */}
              <div style={{ padding: '20px 16px 20px 20px', display: 'flex', alignItems: 'flex-start', paddingTop: 22 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: alert.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={18} color={alert.color} strokeWidth={2} />
                </div>
              </div>

              {/* Content */}
              <div style={{ padding: '20px 16px 20px 0', display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.08em', color: alert.color, background: alert.bg, padding: '2px 7px', borderRadius: 20 }}>
                    {alert.label}
                  </span>
                  {alert.priority === 0 && (
                    <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.06em', color: '#fff', background: '#DC2626', padding: '2px 7px', borderRadius: 20 }}>
                      CRÍTICO
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.2px', lineHeight: 1.3 }}>{alert.title}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500, marginTop: 3, lineHeight: 1.4 }}>{alert.detail}</div>
              </div>

              {/* Actions */}
              <div style={{ padding: '16px 24px 16px 8px', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                {/* WhatsApp */}
                {wa && (
                  <a
                    href={wa} target="_blank" rel="noopener noreferrer"
                    title="Cobrar via WhatsApp"
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 999, background: '#DCFCE7', color: '#15803D', textDecoration: 'none', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', transition: 'all 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#16A34A'; e.currentTarget.style.color = '#fff'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = '#DCFCE7'; e.currentTarget.style.color = '#15803D'; }}
                  >
                    <MessageCircle size={13} strokeWidth={2.5} />
                    Cobrar
                  </a>
                )}

                {/* Approve inspection */}
                {alert.type === 'inspection' && (
                  <button
                    onClick={() => handleApproveInspection(alert)}
                    disabled={isActioning}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 999, background: '#DBEAFE', color: '#1D4ED8', border: 'none', cursor: isActioning ? 'wait' : 'pointer', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', opacity: isActioning ? 0.6 : 1, transition: 'all 0.15s' }}
                    onMouseEnter={e => { if (!isActioning) { e.currentTarget.style.background = '#2563EB'; e.currentTarget.style.color = '#fff'; } }}
                    onMouseLeave={e => { e.currentTarget.style.background = '#DBEAFE'; e.currentTarget.style.color = '#1D4ED8'; }}
                  >
                    <CheckCircle size={13} strokeWidth={2.5} />
                    {isActioning ? '...' : 'Aprovar'}
                  </button>
                )}

                {/* Indicate fine driver */}
                {alert.type === 'legal' && alert.fineId && (
                  <button
                    onClick={() => handleMarkFineIndicated(alert)}
                    disabled={isActioning}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 999, background: '#FAF5FF', color: '#7C3AED', border: 'none', cursor: isActioning ? 'wait' : 'pointer', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', opacity: isActioning ? 0.6 : 1, transition: 'all 0.15s' }}
                    onMouseEnter={e => { if (!isActioning) { e.currentTarget.style.background = '#7C3AED'; e.currentTarget.style.color = '#fff'; } }}
                    onMouseLeave={e => { e.currentTarget.style.background = '#FAF5FF'; e.currentTarget.style.color = '#7C3AED'; }}
                  >
                    <Zap size={13} strokeWidth={2.5} />
                    {isActioning ? '...' : 'Indicar Condutor'}
                  </button>
                )}

                {/* Navigate */}
                {alert.navPage && (
                  <button
                    onClick={() => onNavigate?.(alert.navPage)}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: '50%', background: 'var(--bg)', color: 'var(--muted)', border: 'none', cursor: 'pointer', transition: 'all 0.15s', flexShrink: 0 }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--text)'; e.currentTarget.style.color = '#fff'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg)'; e.currentTarget.style.color = 'var(--muted)'; }}
                    title="Ver detalhes"
                  >
                    <ArrowUpRight size={14} strokeWidth={2.5} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Radial Chart ── */
const RadialChart = ({ percent, color, label, size = 180, strokeWidth = 16 }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percent / 100) * circumference;
  return (
    <div style={{ position: 'relative', width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="var(--bg)" strokeWidth={strokeWidth} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={radius} stroke={color} strokeWidth={strokeWidth} fill="none"
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1.5s cubic-bezier(0.16, 1, 0.3, 1)' }} />
      </svg>
      <div style={{ position: 'absolute', textAlign: 'center' }}>
        <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--text)', letterSpacing: '-2px', lineHeight: 1 }}>{Math.round(percent)}%</div>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginTop: 4, letterSpacing: '.05em', textTransform: 'uppercase' }}>{label}</div>
      </div>
    </div>
  );
};

/* ── Bar Chart ── */
const BarChart = ({ data = [], height = 200 }) => {
  const max = Math.max(...data.map(d => d.total), 1);
  const barWidth = 40, gap = 20, padding = 40;
  const chartWidth = data.length * (barWidth + gap);
  return (
    <div style={{ overflowX: 'auto' }}>
      <svg width={Math.max(chartWidth + padding, 300)} height={height + 50} style={{ display: 'block' }}>
        {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => (
          <g key={i}>
            <line x1={padding} y1={height - pct * height + 10} x2={chartWidth + padding} y2={height - pct * height + 10}
              stroke="var(--border)" strokeWidth="1" strokeDasharray={pct > 0 ? "4,4" : "0"} opacity={0.5} />
            <text x={2} y={height - pct * height + 14} fill="var(--muted)" fontSize="10" fontWeight="600" fontFamily="inherit">
              {(max * pct / 1000).toFixed(1)}k
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const barH = (d.total / max) * height;
          const x = padding + i * (barWidth + gap);
          const y = height - barH + 10;
          const isLast = i === data.length - 1;
          return (
            <g key={i}>
              <rect x={x} y={10} width={barWidth} height={height} rx={8} fill="var(--bg)" opacity={0.5} />
              <rect x={x} y={y} width={barWidth} height={barH} rx={8}
                fill={isLast ? 'var(--accent)' : 'var(--accent-green)'} opacity={isLast ? 1 : 0.6}
                style={{ transition: 'height 1s ease, y 1s ease' }} />
              {d.total > 0 && (
                <text x={x + barWidth / 2} y={y - 6} textAnchor="middle" fill="var(--text)" fontSize="11" fontWeight="700" fontFamily="inherit">
                  {(d.total / 1000).toFixed(1)}k
                </text>
              )}
              <text x={x + barWidth / 2} y={height + 30} textAnchor="middle" fill="var(--muted)" fontSize="12" fontWeight="600" fontFamily="inherit">
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

/* ── Constantes de dias ── */
const DAYS = [
  { key: 'monday', short: 'Seg', full: 'Segunda-feira' },
  { key: 'tuesday', short: 'Ter', full: 'Terça-feira' },
  { key: 'wednesday', short: 'Qua', full: 'Quarta-feira' },
  { key: 'thursday', short: 'Qui', full: 'Quinta-feira' },
  { key: 'friday', short: 'Sex', full: 'Sexta-feira' },
  { key: 'saturday', short: 'Sáb', full: 'Sábado' },
  { key: 'sunday', short: 'Dom', full: 'Domingo' },
];
const TODAY_KEY = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][new Date().getDay()];

/* ── WhatsApp cobrar ── */
function waLink(phone, name, value) {
  const num = (phone ?? '').replace(/\D/g, '');
  const msg = encodeURIComponent(`Olá ${name}! Seu pagamento semanal de R$${value} vence hoje. Faça o Pix para manter seu veículo ativo. Obrigado!`);
  return `https://wa.me/55${num}?text=${msg}`;
}

/* ── WeeklyCalendar ── */
function WeeklyCalendar({ allActiveTenants, pendingInspections, weekInvoices, onRefreshInvoices, onNavigate }) {
  const [selectedDay, setSelectedDay] = useState(TODAY_KEY);
  const [invoiceLoading, setInvoiceLoading] = useState({}); // tenant_id → bool
  const [invoiceCopied, setInvoiceCopied] = useState({}); // tenant_id → bool

  const handleGenerateInvoice = async (tenantId) => {
    setInvoiceLoading(p => ({ ...p, [tenantId]: true }));
    try {
      const data = await api.createInvoice(tenantId);
      if (data?.payment_url) {
        await navigator.clipboard.writeText(data.payment_url).catch(() => { });
        setInvoiceCopied(p => ({ ...p, [tenantId]: true }));
        setTimeout(() => setInvoiceCopied(p => ({ ...p, [tenantId]: false })), 3000);
      }
      onRefreshInvoices?.();
    } catch (err) {
      alert('Erro ao gerar fatura: ' + err.message);
    } finally {
      setInvoiceLoading(p => ({ ...p, [tenantId]: false }));
    }
  };

  const handleCopyInvoice = async (tenantId, url) => {
    await navigator.clipboard.writeText(url).catch(() => { });
    setInvoiceCopied(p => ({ ...p, [tenantId]: true }));
    setTimeout(() => setInvoiceCopied(p => ({ ...p, [tenantId]: false })), 3000);
  };

  // Agrupar locatários por billing_day — O(n), zero re-fetch
  const tenantsByDay = useMemo(() => {
    const map = {};
    for (const t of allActiveTenants) {
      const d = t.billing_day ?? 'monday';
      if (!map[d]) map[d] = [];
      map[d].push(t);
    }
    return map;
  }, [allActiveTenants]);

  // Inspeções por tenant_id
  const inspsByTenant = useMemo(() => {
    const map = {};
    for (const i of pendingInspections) {
      if (!map[i.tenant_id]) map[i.tenant_id] = [];
      map[i.tenant_id].push(i);
    }
    return map;
  }, [pendingInspections]);

  const dayTenants = tenantsByDay[selectedDay] ?? [];
  const unpaid = dayTenants.filter(t => !t.paid_status);
  const paid = dayTenants.filter(t => t.paid_status);

  // Pendências do passado: locatários de OUTROS dias com paid_status false
  const pastOverdue = useMemo(() => {
    if (selectedDay !== TODAY_KEY) return [];
    return allActiveTenants.filter(t =>
      t.billing_day !== TODAY_KEY && !t.paid_status
    );
  }, [selectedDay, allActiveTenants]);

  const totalExpected = dayTenants.reduce((s, t) => s + Number(t.rent_weekly || 0), 0);
  const totalCollected = paid.reduce((s, t) => s + Number(t.rent_weekly || 0), 0);
  const isClean = unpaid.length === 0 && pastOverdue.length === 0;

  // Badge por dia
  const badgeForDay = (key) => {
    const ts = tenantsByDay[key] ?? [];
    const u = ts.filter(t => !t.paid_status).length;
    const ins = ts.reduce((s, t) => s + (inspsByTenant[t.id]?.length ?? 0), 0);
    return u + ins;
  };

  const isToday = (key) => key === TODAY_KEY;
  const isSelected = (key) => key === selectedDay;

  return (
    <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
      {/* ── Header ── */}
      <div style={{
        padding: '28px 32px 20px',
        background: isClean
          ? 'var(--surface)'
          : 'linear-gradient(135deg, #FFF5F5 0%, #FEF0F0 100%)',
        borderBottom: '2px solid var(--bg)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.5px' }}>
              Central de Operações
            </div>
            <div style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 500, marginTop: 4 }}>
              {DAYS.find(d => d.key === selectedDay)?.full} · {dayTenants.length} locatário{dayTenants.length !== 1 ? 's' : ''}
              {isToday(selectedDay) && <span style={{ marginLeft: 8, background: 'var(--accent)', color: 'var(--text)', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}>Hoje</span>}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-1.5px', color: isClean ? 'var(--accent-green)' : '#DC2626' }}>
              R$ {totalExpected.toLocaleString('pt-BR')}
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>
              {totalCollected > 0 ? `R$ ${totalCollected.toLocaleString('pt-BR')} recebido` : 'esperado hoje'}
            </div>
          </div>
        </div>

        {/* ── Day Tabs ── */}
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
          {DAYS.map(({ key, short }) => {
            const badge = badgeForDay(key);
            const sel = isSelected(key);
            const today = isToday(key);
            const hasAlert = badge > 0;

            return (
              <button
                key={key}
                onClick={() => setSelectedDay(key)}
                style={{
                  flexShrink: 0,
                  padding: '10px 16px',
                  borderRadius: 'var(--radius-pill)',
                  border: today && !sel ? '2px solid var(--accent)' : '2px solid transparent',
                  background: sel
                    ? (hasAlert ? '#DC2626' : 'var(--text)')
                    : today
                      ? 'var(--bg)'
                      : 'transparent',
                  color: sel ? '#fff' : today ? 'var(--text)' : hasAlert ? '#DC2626' : 'var(--muted)',
                  fontFamily: 'inherit',
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  transition: 'all 0.18s ease',
                  position: 'relative',
                }}
              >
                {short}
                {badge > 0 && (
                  <span style={{
                    minWidth: 18, height: 18,
                    borderRadius: 999,
                    background: sel ? 'rgba(255,255,255,0.3)' : hasAlert ? '#DC2626' : 'var(--muted)',
                    color: '#fff',
                    fontSize: 10,
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0 4px',
                  }}>
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Content ── */}
      <div style={{ padding: '24px 32px 32px' }}>

        {/* Estado limpo */}
        {isClean && dayTenants.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>✓</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>Caixa limpo</div>
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>Nenhum vencimento para este dia. Aproveite para escalar a frota.</div>
          </div>
        )}

        {isClean && dayTenants.length > 0 && (
          <div style={{ background: '#F0FDF4', borderRadius: 16, padding: '14px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
            <CheckCircle size={18} style={{ color: '#16A34A', flexShrink: 0 }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: '#15803D' }}>Todos os {dayTenants.length} pagamentos recebidos. Dia limpo! 🎉</span>
          </div>
        )}

        {/* Pendências do Passado (só quando hoje está selecionado) */}
        {pastOverdue.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#DC2626' }} />
              <span style={{ fontSize: 12, fontWeight: 800, color: '#DC2626', textTransform: 'uppercase', letterSpacing: '.08em' }}>
                Calotes de dias anteriores ({pastOverdue.length})
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {pastOverdue.map(t => (
                <TenantCard key={`past-${t.id}`} tenant={t} inspections={inspsByTenant[t.id] ?? []}
                  invoice={weekInvoices[t.id]}
                  invoiceLoading={invoiceLoading[t.id]}
                  invoiceCopied={invoiceCopied[t.id]}
                  onGenerateInvoice={handleGenerateInvoice}
                  onCopyInvoice={handleCopyInvoice}
                  urgent onNavigate={onNavigate} />
              ))}
            </div>
          </div>
        )}

        {/* Cobranças do Dia — Não pagas */}
        {unpaid.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#F59E0B' }} />
              <span style={{ fontSize: 12, fontWeight: 800, color: '#B45309', textTransform: 'uppercase', letterSpacing: '.08em' }}>
                Cobranças pendentes ({unpaid.length})
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {unpaid.map(t => (
                <TenantCard key={t.id} tenant={t} inspections={inspsByTenant[t.id] ?? []}
                  invoice={weekInvoices[t.id]}
                  invoiceLoading={invoiceLoading[t.id]}
                  invoiceCopied={invoiceCopied[t.id]}
                  onGenerateInvoice={handleGenerateInvoice}
                  onCopyInvoice={handleCopyInvoice}
                  urgent={false} onNavigate={onNavigate} />
              ))}
            </div>
          </div>
        )}

        {/* Cobranças do Dia — Pagas */}
        {paid.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22C55E' }} />
              <span style={{ fontSize: 12, fontWeight: 800, color: '#15803D', textTransform: 'uppercase', letterSpacing: '.08em' }}>
                Recebidos ({paid.length})
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {paid.map(t => (
                <TenantCard key={t.id} tenant={t} inspections={inspsByTenant[t.id] ?? []}
                  invoice={weekInvoices[t.id]}
                  invoiceLoading={false} invoiceCopied={false}
                  onGenerateInvoice={handleGenerateInvoice}
                  onCopyInvoice={handleCopyInvoice}
                  paid onNavigate={onNavigate} />
              ))}
            </div>
          </div>
        )}

        {/* Vistorias sem cobrança no dia */}
        {(() => {
          const inspWithoutBilling = pendingInspections.filter(i =>
            !dayTenants.find(t => t.id === i.tenant_id)
          );
          if (inspWithoutBilling.length === 0) return null;
          return (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#6366F1' }} />
                <span style={{ fontSize: 12, fontWeight: 800, color: '#4F46E5', textTransform: 'uppercase', letterSpacing: '.08em' }}>
                  Vistorias aguardando aprovação ({inspWithoutBilling.length})
                </span>
              </div>
              <div style={{ background: 'var(--bg)', borderRadius: 16, padding: '14px 18px', fontSize: 13, color: 'var(--muted)' }}>
                {inspWithoutBilling.length} vistoria{inspWithoutBilling.length !== 1 ? 's' : ''} enviada{inspWithoutBilling.length !== 1 ? 's' : ''} por locatários aguardando sua aprovação.
                <button onClick={() => onNavigate?.('tenants')} style={{ ...S.btn(), padding: '6px 14px', fontSize: 11, marginLeft: 12, display: 'inline-flex' }}>
                  Revisar
                </button>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}

/* ── Invoice Status Badge ── */
function InvoiceBadge({ invoice }) {
  if (!invoice) return null;
  const meta = {
    paid: { label: '✓ Fatura Paga', bg: '#DCFCE7', color: '#15803D' },
    pending: { label: '⏳ Fatura Enviada', bg: '#DBEAFE', color: '#1D4ED8' },
    overdue: { label: '⚠ Fatura Atrasada', bg: '#FEE2E2', color: '#DC2626' },
  }[invoice.status] ?? { label: invoice.status, bg: 'var(--bg)', color: 'var(--muted)' };
  return (
    <span style={{ fontSize: 10, fontWeight: 800, color: meta.color, background: meta.bg, padding: '2px 8px', borderRadius: 20, whiteSpace: 'nowrap' }}>
      {meta.label}
    </span>
  );
}

/* ── Tenant Card dentro do calendário ── */
function TenantCard({ tenant, inspections = [], invoice, invoiceLoading, invoiceCopied, onGenerateInvoice, onCopyInvoice, urgent = false, paid = false, onNavigate }) {
  const veh = tenant.vehicles;
  const hasPendingInsp = inspections.length > 0;
  const phone = tenant.phone;
  const invoicePaid = invoice?.status === 'paid';

  const cardBg = (paid || invoicePaid)
    ? 'var(--bg)'
    : urgent ? '#FEF2F2' : '#FFFBEB';

  const borderColor = (paid || invoicePaid)
    ? 'transparent'
    : urgent ? '#FECACA' : '#FDE68A';

  return (
    <div style={{
      background: cardBg,
      border: `1.5px solid ${borderColor}`,
      borderRadius: 16,
      padding: '14px 18px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      transition: 'transform 0.15s',
    }}>
      {/* Left: avatar + info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0, cursor: 'pointer' }}
        onClick={() => onNavigate?.('tenants')}>
        <div style={{
          width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
          background: (paid || invoicePaid) ? 'var(--accent-green)' : urgent ? '#FCA5A5' : 'var(--accent)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16, fontWeight: 800, color: (paid || invoicePaid) ? '#fff' : 'var(--text)',
        }}>
          {tenant.name?.charAt(0).toUpperCase() ?? '?'}
        </div>

        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap' }}>
              {tenant.name}
            </span>
            {(paid || invoicePaid) && (
              <span style={{ fontSize: 10, fontWeight: 800, color: '#16A34A', background: '#DCFCE7', padding: '2px 8px', borderRadius: 20 }}>✓ PAGO</span>
            )}
            {urgent && !(paid || invoicePaid) && (
              <span style={{ fontSize: 10, fontWeight: 800, color: '#DC2626', background: '#FEE2E2', padding: '2px 8px', borderRadius: 20 }}>ATRASADO</span>
            )}
            {hasPendingInsp && (
              <span style={{ fontSize: 10, fontWeight: 800, color: '#6366F1', background: '#EEF2FF', padding: '2px 8px', borderRadius: 20 }}>VISTORIA</span>
            )}
            <InvoiceBadge invoice={invoice} />
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {veh ? `${veh.brand ?? ''} ${veh.model ?? ''}`.trim() + (veh.plate ? ` · ${veh.plate}` : '') : phone ?? '—'}
          </div>
        </div>
      </div>

      {/* Right: value + actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <div style={{ textAlign: 'right', marginRight: 4 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: (paid || invoicePaid) ? '#15803D' : urgent ? '#DC2626' : 'var(--text)', letterSpacing: '-0.5px' }}>
            R$ {Number(tenant.rent_weekly || 0).toLocaleString('pt-BR')}
          </div>
          <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 600 }}>/sem</div>
        </div>

        {/* WhatsApp cobrar */}
        {!(paid || invoicePaid) && phone && (
          <a href={waLink(phone, tenant.name, Number(tenant.rent_weekly || 0).toLocaleString('pt-BR'))}
            target="_blank" rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            title="Cobrar via WhatsApp"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, borderRadius: '50%', background: urgent ? '#DC2626' : '#25D366', color: '#fff', textDecoration: 'none', transition: 'transform 0.15s', flexShrink: 0 }}
            onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
            <MessageCircle size={15} strokeWidth={2.5} />
          </a>
        )}

        {/* Gerar / Copiar Fatura */}
        {!(paid || invoicePaid) && (
          invoice?.payment_url ? (
            <button
              onClick={e => { e.stopPropagation(); onCopyInvoice?.(tenant.id, invoice.payment_url); }}
              title={invoiceCopied ? 'Link copiado!' : 'Copiar link de pagamento'}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, borderRadius: '50%', background: invoiceCopied ? '#DCFCE7' : '#DBEAFE', color: invoiceCopied ? '#15803D' : '#1D4ED8', border: 'none', cursor: 'pointer', transition: 'all 0.15s', flexShrink: 0 }}>
              {invoiceCopied ? <CheckCircle size={15} /> : <Copy size={15} />}
            </button>
          ) : (
            <button
              onClick={e => { e.stopPropagation(); onGenerateInvoice?.(tenant.id); }}
              disabled={invoiceLoading}
              title="Gerar fatura PIX/Cartão"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, borderRadius: '50%', background: invoiceLoading ? 'var(--bg)' : '#111827', color: invoiceLoading ? 'var(--muted)' : '#fff', border: 'none', cursor: invoiceLoading ? 'wait' : 'pointer', transition: 'all 0.15s', flexShrink: 0 }}>
              {invoiceLoading ? <div className="spinner" style={{ width: 12, height: 12, borderWidth: 2 }} /> : <Zap size={15} />}
            </button>
          )
        )}
      </div>
    </div>
  );
}

/* ── Dashboard Principal ── */
export default function Dashboard({
  vehicles = [], tenants = [], alerts = [],
  weekRev = 0, totalExpenses = 0,
  fleetAlerts = { insurance: [], fines: [], pendingSignatures: [] },
  monthlyData = [],
  overdueInvoices = [],
  allActiveTenants = [], pendingInspections = [],
  weekInvoices = {}, onRefreshInvoices,
  onNavigate,
}) {
  const nav = (page) => onNavigate && onNavigate(page);

  const locados = vehicles.filter(v => v.status === 'locado').length;
  const totalVehicles = vehicles.length || 1;
  const occupancyRate = (locados / totalVehicles) * 100;

  const inadimplentes = tenants.filter(t => !t.paid).length;
  const totalTenants = tenants.length || 1;
  const complianceRate = ((totalTenants - inadimplentes) / totalTenants) * 100;
  const inadimplenciaRate = 100 - complianceRate;

  const lucroEstimado = Math.max(0, (weekRev * 4) - totalExpenses);

  const lastMonth = monthlyData.length >= 2 ? monthlyData[monthlyData.length - 2]?.total : 0;
  const currentMonth = monthlyData.length >= 1 ? monthlyData[monthlyData.length - 1]?.total : 0;
  const growth = lastMonth > 0 ? Math.round(((currentMonth - lastMonth) / lastMonth) * 100) : 0;

  const execAlerts = useExecutiveSummary({
    overdueInvoices,
    fines: fleetAlerts.fines ?? [],
    pendingInspections,
    allActiveTenants,
    fleetAlerts,
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Row 1: Receita + Radiais */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(400px, 2fr) minmax(300px, 1fr)', gap: 24, alignItems: 'stretch' }}>
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-lg)', padding: 48, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <div style={{ width: 48, height: 48, borderRadius: 16, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <TrendingUp size={24} color="var(--text)" />
            </div>
            <div>
              <div style={{ fontSize: 14, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.1em' }}>Receita Mensal</div>
              <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: 500 }}>Projeção baseada na semana atual</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, marginBottom: 12 }}>
            <div style={{ fontSize: 72, fontWeight: 800, color: 'var(--text)', letterSpacing: '-3px', lineHeight: 1 }}>
              <span style={{ fontSize: 32, verticalAlign: 'top', opacity: 0.5, marginRight: 8 }}>R$</span>
              {(weekRev * 4).toLocaleString('pt-BR')}
            </div>
            {growth !== 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: growth > 0 ? '#DCFCE7' : '#FEE2E2', padding: '8px 16px', borderRadius: 999, color: growth > 0 ? '#166534' : '#991B1B', fontWeight: 700, fontSize: 15, marginBottom: 8 }}>
                {growth > 0 ? <ArrowUpRight size={18} strokeWidth={3} /> : null}
                {growth > 0 ? '+' : ''}{growth}%
              </div>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginTop: 40, borderTop: '2px solid var(--bg)', paddingTop: 32 }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 8 }}>Lucro Estimado Mensal</div>
              <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--text)', letterSpacing: '-1.5px' }}>
                <span style={{ fontSize: 20, opacity: 0.5, marginRight: 4 }}>R$</span>{lucroEstimado.toLocaleString('pt-BR')}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 8 }}>Gastos (Total)</div>
              <div style={{ fontSize: 36, fontWeight: 800, color: '#991B1B', letterSpacing: '-1.5px', opacity: 0.8 }}>
                <span style={{ fontSize: 20, opacity: 0.5, marginRight: 4 }}>R$</span>{totalExpenses.toLocaleString('pt-BR')}
              </div>
            </div>
          </div>
        </div>

        <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-lg)', padding: 48, display: 'flex', flexDirection: 'column', gap: 32, justifyContent: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }} onClick={() => nav('vehicles')}>
            <RadialChart percent={occupancyRate} color="var(--accent)" label="Ocupação" size={100} strokeWidth={10} />
            <div style={{ flex: 1, paddingLeft: 24 }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)', letterSpacing: '-1px' }}>{locados} / {vehicles.length}</div>
              <div style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 600 }}>Veículos locados</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }} onClick={() => nav('tenants')}>
            <RadialChart percent={complianceRate} color="var(--accent-green)" label="Compliance" size={100} strokeWidth={10} />
            <div style={{ flex: 1, paddingLeft: 24 }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)', letterSpacing: '-1px' }}>{inadimplentes} <span style={{ fontSize: 14, color: '#ef4444' }}>abertos</span></div>
              <div style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 600 }}>Pagamentos</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }} onClick={() => nav('payments')}>
            <RadialChart percent={inadimplenciaRate} color={inadimplenciaRate > 20 ? '#ef4444' : '#f59e0b'} label="Inadimpl." size={100} strokeWidth={10} />
            <div style={{ flex: 1, paddingLeft: 24 }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: inadimplenciaRate > 20 ? '#DC2626' : 'var(--text)', letterSpacing: '-1px' }}>{inadimplentes} <span style={{ fontSize: 14, color: inadimplenciaRate > 20 ? '#DC2626' : '#f59e0b' }}>devendo</span></div>
              <div style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 600 }}>Inadimplência</div>
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: Gráfico Mensal */}
      <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-lg)', padding: 40 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.5px' }}>Evolução Mensal</div>
            <div style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 500, marginTop: 4 }}>Receita recebida nos últimos 6 meses</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>
              <div style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--accent-green)', opacity: 0.6 }} /> Anterior
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
              <div style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--accent)' }} /> Mês Atual
            </div>
          </div>
        </div>
        <BarChart data={monthlyData} height={180} />
      </div>

      {/* Row 3: Centro de Comando — Inteligência Operacional */}
      <IntelligencePanel alerts={execAlerts} onNavigate={nav} />

      {/* Row 4: Central de Operações Semanais */}
      <WeeklyCalendar
        allActiveTenants={allActiveTenants}
        pendingInspections={pendingInspections}
        weekInvoices={weekInvoices}
        onRefreshInvoices={onRefreshInvoices}
        onNavigate={nav}
      />
    </div>
  );
}
