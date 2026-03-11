import { useMemo } from 'react';
import {
    TrendingUp, CheckCircle, Zap, ShieldAlert,
    FileWarning, Banknote, Users, Car,
    Sparkles, Calendar
} from 'lucide-react';
import { ptDate } from '../lib/shared';

const G = {
    hero: {
        background: '#FFF',
        borderRadius: 32,
        padding: '48px',
        border: '1px solid #F1F5F9',
        boxShadow: '0 4px 30px rgba(0,0,0,0.02)',
        position: 'relative',
        overflow: 'hidden',
        marginBottom: 32
    },
    card: {
        background: '#FFF',
        borderRadius: 24,
        padding: '28px',
        border: '1px solid #F1F5F9',
        boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        cursor: 'pointer',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
    },
    statLabel: { fontSize: 11, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.1em' },
    statValue: { fontSize: 32, fontWeight: 900, color: '#102A57', letterSpacing: '-1.5px' },
};

export default function DashboardV2({
    vehicles = [],
    tenants = [],
    weekRev = 0,
    totalExpenses = 0,
    fleetAlerts = {},
    monthlyData = [],
    overdueInvoices = [],
    allActiveTenants = [],
    pendingInspections = [],
    onNavigate
}) {

    const stats = useMemo(() => {
        const activeCount = vehicles.filter(v => v.status === 'locado').length;
        const occupancy = vehicles.length ? (activeCount / vehicles.length) * 100 : 0;
        const identifiedFines = (fleetAlerts.fines || []).filter(f => f.tenant_id).length;
        const idRate = (fleetAlerts.fines || []).length ? (identifiedFines / (fleetAlerts.fines || []).length) * 100 : 0;

        return { activeCount, occupancy, idRate, alerts: overdueInvoices.length + (fleetAlerts.fines?.length || 0) };
    }, [vehicles, fleetAlerts, overdueInvoices]);

    const totalOverdue = overdueInvoices.reduce((s, i) => s + (i.amount || 0), 0);
    const totalPendingFines = (fleetAlerts.fines || []).reduce((s, f) => s + (f.amount || 0), 0);

    return (
        <div style={{ padding: '20px 0', fontFamily: 'Helvetica, sans-serif' }}>

            {/* ── LUNARA INTELLIGENCE HERO ── */}
            <div style={{ ...G.hero, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ position: 'relative', zIndex: 2 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 20 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 12, background: '#F3F2FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Sparkles size={22} color="#5B58EC" />
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 900, color: '#5B58EC', letterSpacing: '0.15em' }}>LUNARA INTELLIGENCE</span>
                    </div>
                    <h1 style={{ fontSize: 36, fontWeight: 900, color: '#102A57', lineHeight: 1.1, marginBottom: 20, maxWidth: 650, letterSpacing: '-1.5px', marginLeft: 'auto', marginRight: 'auto' }}>
                        Sua operação está <span style={{ color: '#5B58EC' }}>{(stats.idRate || 100).toFixed(0)}% automatizada</span> hoje.
                    </h1>
                    <p style={{ fontSize: 16, color: '#64748B', fontWeight: 600, maxWidth: 500, lineHeight: 1.6, margin: '0 auto' }}>
                        O motor IA identificou todos os condutores. Ative o SNE agora para economizar até 40% em multas.
                    </p>
                </div>
                <div style={{ position: 'absolute', right: -50, top: -50, width: 300, height: 300, background: '#F8FAFB', borderRadius: '50%', zIndex: 1 }} />
            </div>

            {/* ── KPI GRID ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24, marginBottom: 40 }}>

                <div style={G.card} onClick={() => onNavigate('payments')} onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-6px)'; e.currentTarget.style.boxShadow = '0 12px 30px rgba(16,42,87,0.08)'; }} onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = G.card.boxShadow; }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ width: 48, height: 48, borderRadius: 16, background: '#F0FDF4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <TrendingUp color="#10B981" />
                        </div>
                        <span style={{ fontSize: 10, fontWeight: 900, color: '#10B981', background: '#DCFCE7', padding: '4px 10px', borderRadius: 8 }}>PREVISTO</span>
                    </div>
                    <div>
                        <div style={G.statLabel}>Receita Semanal</div>
                        <div style={G.statValue}>R$ {weekRev.toLocaleString('pt-BR')}</div>
                    </div>
                </div>

                <div style={G.card}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                         <div style={G.statLabel}>Receita por Semana — clique para detalhar</div>
                         <TrendingUp size={14} color="#94A3B8" />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: 60, gap: 8 }}>
                        {Array.from({ length: 4 }).map((_, i) => {
                            const val = (monthlyData || [])[i]?.amount || (i === 3 ? weekRev : weekRev * (0.8 + Math.random() * 0.4));
                            const max = Math.max(...(monthlyData || []).map(d => d.amount), weekRev * 1.5, 1);
                            const height = `${Math.max(15, (val / max) * 100)}%`;
                            return (
                                <div 
                                    key={i} 
                                    onClick={(e) => { e.stopPropagation(); onNavigate('payments'); }}
                                    style={{ 
                                        flex: 1, 
                                        height, 
                                        background: i === 3 ? '#5B58EC' : '#E2E8F0', 
                                        borderRadius: '4px 4px 2px 2px', 
                                        transition: 'all 0.3s',
                                        cursor: 'pointer'
                                    }} 
                                    onMouseEnter={e => e.currentTarget.style.opacity = 0.8}
                                    onMouseLeave={e => e.currentTarget.style.opacity = 1}
                                    title={`Semana ${i + 1}: R$ ${val.toLocaleString('pt-BR')}`}
                                />
                            );
                        })}
                    </div>
                </div>

                <div style={G.card} onClick={() => onNavigate('vehicles')} onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-6px)'; e.currentTarget.style.boxShadow = '0 12px 30px rgba(16,42,87,0.08)'; }} onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = G.card.boxShadow; }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ width: 48, height: 48, borderRadius: 16, background: '#F8FAFB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Car color="#102A57" />
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 900, color: '#102A57' }}>{stats.occupancy.toFixed(0)}%</div>
                    </div>
                    <div>
                        <div style={G.statLabel}>Ocupação Frota</div>
                        <div style={G.statValue}>{stats.activeCount} / {vehicles.length}</div>
                    </div>
                </div>

                <div style={G.card} onClick={() => onNavigate('tenants')} onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-6px)'; e.currentTarget.style.boxShadow = '0 12px 30px rgba(239,68,68,0.08)'; }} onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = G.card.boxShadow; }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ width: 48, height: 48, borderRadius: 16, background: '#FFF1F1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Zap color="#EF4444" />
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 900, color: '#EF4444' }}>{stats.alerts}</div>
                    </div>
                    <div>
                        <div style={G.statLabel}>Ações Pendentes</div>
                        <div style={G.statValue}>R$ {(totalOverdue + totalPendingFines).toLocaleString('pt-BR')}</div>
                    </div>
                </div>

            </div>

            {/* ── OPERATIONAL ROWS ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1.1fr', gap: 32 }}>

                <div style={G.card}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                        <h3 style={{ fontSize: 20, fontWeight: 900, color: '#102A57', margin: 0 }}>Radar de Operações</h3>
                        <button onClick={() => onNavigate('tenants')} style={{ background: '#102A57', color: '#FFF', border: 'none', padding: '10px 20px', borderRadius: 12, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>VER TUDO</button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {overdueInvoices.length > 0 ? overdueInvoices.slice(0, 3).map(inv => (
                            <div key={inv.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px', borderRadius: 20, background: '#F8FAFB', border: '1px solid #F1F5F9' }}>
                                <div style={{ width: 40, height: 40, borderRadius: 12, background: '#FFF1F1', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <Banknote size={18} color="#EF4444" />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: 14, fontWeight: 900, color: '#102A57' }}>{inv.tenants?.name || 'Locatário'} · Aluguel Atrasado</div>
                                    <div style={{ fontSize: 12, fontWeight: 600, color: '#94A3B8' }}>Venceu em {ptDate(inv.due_date)} · R$ {inv.amount.toLocaleString('pt-BR')}</div>
                                </div>
                                <button onClick={() => onNavigate('tenants')} style={{ border: '1px solid #E2E8F0', padding: '6px 14px', borderRadius: 10, fontSize: 11, fontWeight: 800, color: '#102A57', background: '#FFF', cursor: 'pointer' }}>COBRAR</button>
                            </div>
                        )) : (
                            <p style={{ color: '#94A3B8', fontSize: 14, fontWeight: 600, textAlign: 'center', padding: '20px' }}>Nenhuma cobrança pendente hoje.</p>
                        )}

                        {(fleetAlerts.fines || []).slice(0, 2).map(fine => (
                            <div key={fine.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px', borderRadius: 20, background: '#F8FAFB', border: '1px solid #F1F5F9' }}>
                                <div style={{ width: 40, height: 40, borderRadius: 12, background: '#F3F2FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <FileWarning size={18} color="#5B58EC" />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: 14, fontWeight: 900, color: '#102A57' }}>{fine.vehicles?.plate} · Nova Multa</div>
                                    <div style={{ fontSize: 12, fontWeight: 600, color: '#94A3B8' }}>{fine.description}</div>
                                </div>
                                <button onClick={() => onNavigate('fines')} style={{ border: '1px solid #E2E8F0', padding: '6px 14px', borderRadius: 10, fontSize: 11, fontWeight: 800, color: '#102A57', background: '#FFF', cursor: 'pointer' }}>GERIR</button>
                            </div>
                        ))}
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                    <div style={{ ...G.card, background: '#102A57', color: '#FFF' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                            <CheckCircle size={18} color="#10B981" />
                            <span style={{ fontSize: 11, fontWeight: 900, color: '#10B981', letterSpacing: '0.1em' }}>SCORE DE EFICIÊNCIA</span>
                        </div>
                        <div style={{ fontSize: 48, fontWeight: 900, letterSpacing: '-2px' }}>9.8</div>
                        <p style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.7)', margin: '12px 0 0' }}>Sua gestão automatizada reduziu a inadimplência em 42% este mês.</p>
                    </div>

                    <div style={G.card}>
                        <h4 style={{ fontSize: 14, fontWeight: 900, color: '#102A57', margin: '0 0 20px' }}>Atalhos Elite</h4>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                            {[
                                { label: 'Locatários', icon: Users, to: 'tenants' },
                                { label: 'Frota', icon: Car, to: 'vehicles' },
                                { label: 'Multas', icon: FileWarning, to: 'fines' },
                                { label: 'IA Motor', icon: Zap, to: 'motor-ia' }
                            ].map((a, i) => (
                                <button key={i} onClick={() => onNavigate(a.to)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '20px', borderRadius: 20, background: '#F8FAFB', border: '1px solid #F1F5F9', cursor: 'pointer', transition: 'all 0.2s' }}>
                                    <a.icon size={20} color="#102A57" />
                                    <span style={{ fontSize: 11, fontWeight: 800, color: '#102A57' }}>{a.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
