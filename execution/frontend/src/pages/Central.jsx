import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import {
  ChevronRight, Video, MessageSquare, Zap, BarChart3,
  TrendingUp, TrendingDown, CheckCircle2,
  Car, AlertTriangle, Calendar, Award
} from 'lucide-react';
import { ptDate, fmt, monthRange } from '../lib/shared';

// ── Design tokens ─────────────────────────────────────────────────────────────
const NAVY  = '#102A57';
const AMBER = '#FFC524';
const BG    = '#F6F6F4';

// ── Helpers ───────────────────────────────────────────────────────────────────
function datePT(d) {
  const options = { weekday: 'short', day: '2-digit', month: 'long', year: 'numeric' };
  return d.toLocaleDateString('pt-BR', options);
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

// ── Priority colour map ───────────────────────────────────────────────────────
const PCOL = {
  danger:  { dot: '#EF4444', bg: '#FEF2F2', text: '#991B1B', border: '#FECACA' },
  warning: { dot: '#F59E0B', bg: '#FFFBEB', text: '#92400E', border: '#FDE68A' },
  info:    { dot: '#3B82F6', bg: '#EFF6FF', text: '#1E40AF', border: '#BFDBFE' },
  maint:   { dot: '#6B7280', bg: '#F9FAFB', text: '#374151', border: '#E5E7EB' },
};

// ── Main component ────────────────────────────────────────────────────────────
export default function Central({ onNavigate }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [d, setD] = useState({
    revenue: 0, revenueExpected: 0, prevRevenue: 0, remaining: 0, progressPct: 0,
    locados: 0, totalVehicles: 0,
    overdueTotal: 0, next7d: 0,
    bestTenant: null,
    priorities: [],
    cars: [],
    score: 0,
    firstName: ''
  });

  const load = useCallback(async () => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const in7   = new Date(Date.now() + 7  * 86400000).toISOString().slice(0, 10);
      const in15  = new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10);
      const in30  = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
      const d7ago = new Date(Date.now() - 7  * 86400000).toISOString().slice(0, 10);

      const [mStart, mEnd] = monthRange();
      const ms  = mStart.toISOString().slice(0, 10);
      const me  = mEnd.toISOString().slice(0, 10);
      const pms = new Date(mStart.getFullYear(), mStart.getMonth() - 1, 1).toISOString().slice(0, 10);
      const pme = new Date(mStart.getFullYear(), mStart.getMonth(),     0).toISOString().slice(0, 10);

      // Multi-query load
      const [vR, tR, iR, chkR, mR, maintR] = await Promise.all([
        supabase.from('vehicles').select('*'),
        supabase.from('tenants').select('*, vehicles!vehicle_id(id,plate,model)').eq('status','ativo'),
        supabase.from('invoices').select('*, tenants(name)').in('status',['pending','overdue']),
        supabase.from('weekly_checks').select('*, tenants(name), vehicles(plate)').eq('status','submitted'),
        supabase.from('weekly_inspections').select('*, tenants(name), vehicles(plate)').eq('status','pending'),
        supabase.from('maintenance').select('*, vehicles(plate)').eq('done', false),
      ]);

      const vehicles     = vR.data    || [];
      const tenants      = tR.data    || [];
      const invoices     = iR.data    || [];
      const wChecks      = chkR.data  || [];
      const wInsp        = mR.data    || [];
      const maintenances = maintR.data || [];

      // Financials
      const [mInvR, pmInvR, n7R, mMaintR, mFinesR] = await Promise.all([
        supabase.from('invoices').select('tenant_id,amount,status,due_date').gte('due_date', ms).lte('due_date', me),
        supabase.from('invoices').select('amount').eq('status','paid').gte('due_date', pms).lte('due_date', pme),
        supabase.from('invoices').select('amount').eq('status', 'pending').gte('due_date', today).lte('due_date', in7),
        supabase.from('maintenance').select('vehicle_id,cost').gte('created_at', ms + 'T00:00:00'),
        supabase.from('fines').select('vehicle_id,amount').eq('status','pago').gte('created_at', ms + 'T00:00:00'),
      ]);

      const mInv   = mInvR.data    || [];
      const revenue  = mInv.filter(i => i.status === 'paid').reduce((s, i) => s + (i.amount || 0), 0);
      const revExp   = mInv.reduce((s, i) => s + (i.amount || 0), 0);
      const prevRev  = (pmInvR.data || []).reduce((s, i) => s + (i.amount || 0), 0);
      const next7d   = (n7R.data   || []).reduce((s, i) => s + (i.amount || 0), 0);
      const mMaint   = mMaintR.data || [];
      const mFines   = mFinesR.data || [];

      const locados      = vehicles.filter(v => v.status === 'locado').length;
      const overdueInv   = invoices.filter(i => i.due_date < today);
      const overdueTotal = overdueInv.reduce((s, i) => s + (i.amount || 0), 0);

      // Best Tenant
      const bestTenant = tenants.reduce((b, t) => {
        const v = Number(t.rent_weekly || t.rent_amount || 0);
        return (!b || v > b.v) ? { name: t.name, v } : b;
      }, null);

      // Rentabilidade
      const activeCars = vehicles.filter(v => v.status === 'locado');
      const cars = activeCars.map(v => {
        const linked = tenants.find(t => t.vehicle_id === v.id || (Array.isArray(t.vehicles) && t.vehicles.some(x => x.id === v.id)));
        const receita = linked
          ? mInv.filter(i => i.tenant_id === linked.id && i.status === 'paid').reduce((s, i) => s + (i.amount || 0), 0)
          : 0;
        const custos =
          mMaint.filter(m => m.vehicle_id === v.id).reduce((s, m) => s + (m.cost  || 0), 0) +
          mFines.filter(f => f.vehicle_id === v.id).reduce((s, f) => s + (f.amount || 0), 0);
        return { id: v.id, model: v.model || 'Veículo', plate: v.plate || '', profit: receita - custos };
      }).sort((a, b) => b.profit - a.profit);

      // Fleet Score calculation
      const totalVehicles = vehicles.length;
      const ocupacaoScore = totalVehicles > 0 ? (locados / totalVehicles) * 100 : 0;
      const adimplenciaScore = mInv.length > 0 ? ((mInv.filter(i => i.status === 'paid').length) / mInv.length) * 100 : 100;
      const docPenalty = vehicles.filter(v => v.docs_seguro && v.docs_seguro <= in30).length + 
                         tenants.filter(t => t.cnh_expiry && t.cnh_expiry <= in30).length;
      const documentacaoScore = Math.max(0, 100 - (docPenalty * 15));
      const checkinsScore = tenants.length > 0 ? (wChecks.length / tenants.length) * 100 : 100;
      
      const score = Math.round(
        ocupacaoScore * 0.35 +
        adimplenciaScore * 0.35 +
        documentacaoScore * 0.20 +
        checkinsScore * 0.10
      );

      // Priorities
      const pList = [];
      overdueInv.filter(i => i.due_date <= d7ago).forEach(i => pList.push({
        id: `inv-${i.id}`, type: 'danger', urgency: 100,
        title: `Débito crítico — ${i.tenants?.name || 'Motorista'}`,
        desc: `Venceu em ${ptDate(i.due_date)}`, amount: i.amount, nav: 'payments',
      }));
      vehicles.forEach(v => {
        if (v.docs_seguro && v.docs_seguro <= in15) pList.push({
          id: `seg-${v.id}`, type: 'warning', urgency: 80,
          title: `Seguro vencendo — ${v.plate}`,
          desc: `Vence em ${ptDate(v.docs_seguro)}`, nav: 'vehicles',
        });
      });
      tenants.forEach(t => {
        if (t.cnh_expiry && t.cnh_expiry <= in15) pList.push({
          id: `cnh-${t.id}`, type: 'warning', urgency: 75,
          title: `CNH vencendo — ${t.name}`,
          desc: `Vence em ${ptDate(t.cnh_expiry)}`, nav: 'tenants',
        });
      });
      wChecks.forEach(c => pList.push({
        id: `chk-${c.id}`, type: 'info', urgency: 60,
        title: `Vídeo para revisar — ${c.tenants?.name || 'Motorista'}`,
        desc: c.vehicles?.plate || '', nav: 'automacao',
      }));
      wInsp.forEach(i => pList.push({
        id: `ins-${i.id}`, type: 'info', urgency: 50,
        title: `Vistoria pendente — ${i.tenants?.name || 'Motorista'}`,
        desc: i.vehicles?.plate || '', nav: 'vehicles',
      }));
      maintenances.forEach(m => pList.push({
        id: `mnt-${m.id}`, type: 'maint', urgency: 40,
        title: `Manutenção — ${m.vehicles?.plate || ''}`,
        desc: m.description || 'Revisão necessária', nav: 'maintenance',
      }));

      // User name
      const firstName = user?.email?.split('@')[0]?.split('.')[0]?.split('_')[0] || 'Willy';

      setD({
        revenue, revenueExpected: revExp, prevRevenue: prevRev,
        remaining: Math.max(revExp - revenue, 0),
        progressPct: revExp > 0 ? Math.min((revenue / revExp) * 100, 100) : 0,
        locados, totalVehicles,
        overdueTotal, next7d, bestTenant,
        priorities: pList.sort((a, b) => b.urgency - a.urgency).slice(0, 6),
        cars: cars.slice(0, 4),
        score,
        firstName
      });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [user, supabase]);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center',
                  justifyContent:'center', minHeight:'60vh', gap:12, color:'#94A3B8' }}>
      <div style={{ width:32, height:32, border:'3px solid #E2E8F0',
                    borderTopColor: NAVY, borderRadius:'50%', animation:'spin 1s linear infinite' }} />
      <span style={{ fontSize:13, fontWeight:600 }}>Sincronizando Frota...</span>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  const scoreColor = d.score >= 80 ? '#10B981' : d.score >= 60 ? AMBER : '#EF4444';
  const scoreLabel = d.score >= 80 ? 'Operação Saudável' : d.score >= 60 ? 'Atenção Necessária' : 'Problemas Críticos';

  return (
    <div style={{ background: BG, minHeight:'100vh', fontFamily:'Inter, system-ui, sans-serif' }}>
      <div style={{ maxWidth:740, margin:'0 auto', paddingBottom: 120 }}>
        
        {/* ZONA 0 — HEADER NAVY */}
        <div style={{ background: NAVY, padding: '40px 24px 30px', color: 'white' }}>
          <div style={{ fontSize: 24, fontWeight: 900, display: 'flex', alignItems: 'center', gap: 8 }}>
            {getGreeting()}, {d.firstName} 👋
          </div>
          <div style={{ fontSize: 13, opacity: 0.6, marginTop: 4, fontWeight: 600 }}>
            {datePT(new Date())}
          </div>
          
          <div style={{ marginTop: 28 }}>
            <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 99, height: 8 }}>
              <div style={{ width: `${d.score}%`, height: '100%', background: scoreColor, borderRadius: 99, transition: 'width 1.5s ease' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
              <span style={{ fontSize: 13, color: scoreColor, fontWeight: 800 }}>Score {d.score}/100 — {scoreLabel}</span>
              <span style={{ fontSize: 11, opacity: 0.4 }}>atualizado agora</span>
            </div>
          </div>
        </div>

        <div style={{ padding: '24px 16px' }}>
          
          {/* ZONA 1 — HERO CARD — RECEITA DO MÊS */}
          <div style={{ background:'white', borderRadius:24, padding:'24px', marginBottom:16,
                        boxShadow:'0 4px 20px rgba(0,0,0,0.03)', border:'1px solid #F1F5F9' }}>
            <p style={{ fontSize:11, fontWeight:800, color:'#94A3B8', textTransform:'uppercase', letterSpacing:'0.1em', margin:0 }}>
              Receita do Mês
            </p>
            <div style={{ display:'flex', alignItems:'baseline', gap:10, marginTop:10 }}>
              <span style={{ fontSize:42, fontWeight:1000, color: NAVY, letterSpacing:'-1.5px' }}>
                R$ {fmt(d.revenue)}
              </span>
              {d.prevRevenue > 0 && (
                <span style={{ fontSize:14, fontWeight:800, color: d.revenue >= d.prevRevenue ? '#10B981' : '#EF4444', display:'flex', alignItems:'center', gap:3 }}>
                  {d.revenue >= d.prevRevenue ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                  {Math.abs(Math.round(((d.revenue - d.prevRevenue) / d.prevRevenue) * 100))}%
                </span>
              )}
            </div>
            
            <div style={{ margin: '20px 0 8px' }}>
              <div style={{ background: '#F1F5F9', borderRadius: 99, height: 8 }}>
                <div style={{ width: `${d.progressPct}%`, height: '100%', background: d.progressPct >= 90 ? '#10B981' : d.progressPct >= 60 ? AMBER : '#EF4444', borderRadius: 99, transition: 'width 1.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                <span style={{ fontSize: 12, color: '#64748B', fontWeight: 500 }}>
                  {Math.round(d.progressPct)}% de R$ {fmt(d.revenueExpected)} esperado
                </span>
                {d.remaining > 0 && (
                  <span style={{ fontSize: 12, color: AMBER, fontWeight: 800 }}>
                    R$ {fmt(d.remaining)} a receber
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* ZONA 2 — KPIs SECUNDÁRIOS — SCROLL HORIZONTAL */}
          <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 10, marginBottom: 16, scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {[
              { icon: <Car size={20} />, label: 'Ocupação', value: `${d.locados}/${d.totalVehicles}`, color: d.locados/d.totalVehicles >= 0.8 ? '#10B981' : AMBER, onClick: () => onNavigate('vehicles') },
              { icon: <AlertTriangle size={20} />, label: 'Em atraso', value: d.overdueTotal > 0 ? `R$ ${fmt(d.overdueTotal)}` : '✓ Zero', color: d.overdueTotal > 0 ? '#EF4444' : '#10B981', onClick: () => onNavigate('payments') },
              { icon: <Calendar size={20} />, label: 'Próximos 7d', value: `R$ ${fmt(d.next7d)}`, color: NAVY, onClick: () => onNavigate('payments') },
              { icon: <Award size={20} />, label: 'Top Motorista', value: d.bestTenant?.name?.split(' ')[0] || '—', color: '#7C3AED', onClick: () => onNavigate('tenants') }
            ].map((k, i) => (
              <div key={i} onClick={k.onClick} style={{ background: 'white', borderRadius: 18, padding: '16px', minWidth: 125, flexShrink: 0, cursor: 'pointer', boxShadow: '0 2px 10px rgba(0,0,0,0.02)', border: '1px solid #F1F5F9' }}>
                <div style={{ color: k.color }}>{k.icon}</div>
                <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 800, textTransform: 'uppercase', marginTop: 10, letterSpacing: '0.05em' }}>{k.label}</div>
                <div style={{ fontSize: 16, fontWeight: 900, color: k.color, marginTop: 4 }}>{k.value}</div>
              </div>
            ))}
          </div>

          {/* ZONA 3 — PRIORIDADES */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14 }}>
              <p style={{ fontSize:15, fontWeight:900, color: NAVY, margin:0 }}>O que fazer agora</p>
              {d.priorities.length > 0 && (
                <span style={{ fontSize:11, background:'#FEF3C7', color:'#92400E', padding:'2px 9px', borderRadius:99, fontWeight:900 }}>{d.priorities.length}</span>
              )}
            </div>
            
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {d.priorities.map(p => {
                const c = PCOL[p.type] || PCOL.info;
                return (
                  <div key={p.id} onClick={() => onNavigate(p.nav)} style={{ background: 'white', borderRadius: 18, borderLeft: `5px solid ${c.dot}`, padding: '16px', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', boxShadow: '0 2px 10px rgba(0,0,0,0.02)', border: '1px solid #F1F5F9', borderLeftColor: c.dot }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: '#102A57' }}>{p.title}</div>
                      <div style={{ fontSize: 12, color: '#64748B', fontWeight: 500, marginTop: 2 }}>{p.desc}</div>
                    </div>
                    {p.amount > 0 && (
                      <div style={{ background: `${c.dot}15`, color: c.dot, fontSize: 12, fontWeight: 900, padding: '6px 12px', borderRadius: 10, whiteSpace: 'nowrap' }}>
                        R$ {fmt(p.amount)}
                      </div>
                    )}
                    <ChevronRight size={18} color="#CBD5E1" />
                  </div>
                );
              })}
            </div>
          </div>

          {/* ZONA 4 — RENTABILIDADE POR CARRO */}
          {d.cars.length > 0 && (
            <div style={{ background: 'white', borderRadius: 24, padding: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid #F1F5F9' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 900, color: NAVY }}>Rentabilidade por Carro</div>
                  <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 2, fontWeight: 500 }}>receita menos custos este mês</div>
                </div>
                <button onClick={() => onNavigate('vehicles')} style={{ fontSize: 12, color: AMBER, fontWeight: 900, background: 'none', border: 'none', cursor: 'pointer' }}>ver todos →</button>
              </div>

              {d.cars.map(c => {
                const maxProfit = Math.max(...d.cars.map(x => x.profit), 1);
                const pct = Math.max(0, (c.profit / maxProfit) * 100);
                const barColor = c.profit > 400 ? '#10B981' : c.profit > 200 ? AMBER : '#EF4444';
                const status = c.profit > 400 ? 'Excelente' : c.profit > 200 ? 'Bom' : 'Atenção!';

                return (
                  <div key={c.id} style={{ marginBottom: 18 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 800, color: '#102A57' }}>{c.model} <span style={{ color: '#94A3B8', fontWeight: 500 }}>{c.plate}</span></span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 14, fontWeight: 900, color: NAVY }}>R$ {fmt(c.profit)}/mês</span>
                        <span style={{ fontSize: 10, fontWeight: 900, color: barColor, background: `${barColor}15`, padding: '3px 8px', borderRadius: 8 }}>{status}</span>
                      </div>
                    </div>
                    <div style={{ background: '#F1F5F9', borderRadius: 99, height: 8 }}>
                      <div style={{ width: `${pct}%`, height: '100%', borderRadius: 99, background: barColor, transition: 'width 1s ease' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </div>
      </div>

      {/* FLOATING BOTTOM NAV */}
      <div style={{ position:'fixed', bottom:24, left:'50%', transform:'translateX(-50%)', background:'rgba(16,42,87,0.95)', backdropFilter:'blur(12px)', borderRadius:28, padding:'8px 6px', display:'flex', gap:4, alignItems:'center', boxShadow:'0 12px 32px rgba(16,42,87,0.35)', zIndex:1000, border:'1px solid rgba(255,255,255,0.08)' }}>
        {[
          { icon: <Video size={20} />, label: 'Vídeos', nav: 'automacao', p: { tab: 'video' } },
          { icon: <MessageSquare size={20} />, label: 'Bot', nav: 'automacao', p: { tab: 'bot' } },
          { icon: <Zap size={20} />, label: 'Motor', nav: 'automacao', p: { tab: 'motor' } },
          { icon: <BarChart3 size={20} />, label: 'Dados', nav: 'dashboard' }
        ].map((b, i) => (
          <button key={i} onClick={() => onNavigate(b.nav, b.p)} style={{ background:'transparent', border:'none', color:'rgba(255,255,255,0.7)', display:'flex', flexDirection:'column', alignItems:'center', gap:4, cursor:'pointer', padding:'8px 18px', borderRadius:20, transition:'all 0.2s' }} onMouseEnter={e => { e.currentTarget.style.background='rgba(255,255,255,0.1)'; e.currentTarget.style.color='white'; }} onMouseLeave={e => { e.currentTarget.style.background='transparent'; e.currentTarget.style.color='rgba(255,255,255,0.7)'; }}>
            {b.icon}
            <span style={{ fontSize:10, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.05em' }}>{b.label}</span>
          </button>
        ))}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  );
}
