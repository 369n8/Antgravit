import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { api } from '../services/api';

export default function SuperAdmin() {
    const { user } = useAuth();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        async function loadMetrics() {
            try {
                setLoading(true);
                const res = await api.getSuperAdminMetrics();
                setData(res);
            } catch (err) {
                console.error('Super Admin Error:', err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        }
        loadMetrics();
    }, []);

    if (loading) return (
        <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: '#F9F9F8' }}>
            <div className="spinner" style={{ width: 40, height: 40, borderWidth: 3 }} />
        </div>
    );

    if (error) return (
        <div style={{ padding: 40, textAlign: 'center', color: '#E06B65' }}>
            <h2>Acesso Bloqueado ou Falha</h2>
            <p>{error}</p>
        </div>
    );

    // Validação estrita de Super Admin
    if (user?.email !== 'teste@frotaapp.com') {
        return (
            <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: '#F9F9F8', color: '#C62828', flexDirection: 'column' }}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 16 }}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="m9 12 2 2 4-4" /></svg>
                <h1 style={{ margin: '0 0 8px 0' }}>Acesso Restrito</h1>
                <p style={{ margin: 0, color: '#737367' }}>Esta área é exclusiva para a administração global do sistema.</p>
                <div style={{ marginTop: 24 }}>
                    <button
                        onClick={() => window.location.href = '/'}
                        style={{ padding: '10px 20px', borderRadius: 999, border: '1px solid #E6E6DF', background: '#fff', cursor: 'pointer', fontWeight: 600 }}
                    >
                        Voltar em segurança
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div style={{ minHeight: '100vh', background: '#F5F5F0', padding: '40px 60px', fontFamily: 'Inter, system-ui' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 40 }}>
                <div>
                    <h1 style={{ fontSize: 28, color: '#1A1A1A', margin: '0 0 8px 0', fontWeight: 700 }}>Painel Super Admin</h1>
                    <p style={{ color: '#737367', margin: 0, fontSize: 15 }}>Gestão Global de Locadoras (SaaS B2B)</p>
                </div>
                <div style={{ padding: '8px 16px', background: '#1A1A1A', color: '#fff', borderRadius: 999, fontSize: 13, fontWeight: 600 }}>
                    SaaS Engine Active
                </div>
            </div>

            {/* KPIs Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 24, marginBottom: 40 }}>
                <div style={{ background: '#fff', padding: 24, borderRadius: 24, boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
                    <p style={{ color: '#737367', fontSize: 13, textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 12px 0', fontWeight: 600 }}>MRR Global</p>
                    <h2 style={{ fontSize: 36, margin: 0, color: '#1A1A1A' }}>
                        R$ {data?.metrics?.total_mrr?.toLocaleString('pt-BR')}
                    </h2>
                </div>

                <div style={{ background: '#fff', padding: 24, borderRadius: 24, boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
                    <p style={{ color: '#737367', fontSize: 13, textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 12px 0', fontWeight: 600 }}>Locadoras Ativas</p>
                    <h2 style={{ fontSize: 36, margin: 0, color: '#1A1A1A' }}>
                        {data?.metrics?.total_active_clients} <span style={{ fontSize: 18, color: '#8C8C82' }}>/ {data?.metrics?.total_clients}</span>
                    </h2>
                </div>

                <div style={{ background: '#fff', padding: 24, borderRadius: 24, boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
                    <p style={{ color: '#737367', fontSize: 13, textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 12px 0', fontWeight: 600 }}>Total de Veículos</p>
                    <h2 style={{ fontSize: 36, margin: 0, color: '#1A1A1A' }}>
                        {data?.metrics?.total_global_vehicles}
                    </h2>
                </div>

                <div style={{ background: '#fff', padding: 24, borderRadius: 24, boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
                    <p style={{ color: '#737367', fontSize: 13, textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 12px 0', fontWeight: 600 }}>Receita de Multas (SaaS)</p>
                    <h2 style={{ fontSize: 36, margin: 0, color: '#1A1A1A' }}>
                        R$ {data?.metrics?.saas_fine_revenue?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) ?? '0,00'}
                    </h2>
                    <p style={{ margin: '8px 0 0 0', fontSize: 13, color: '#8C8C82' }}>R$ 2,50 / multa processada</p>
                </div>

                <div style={{ background: 'linear-gradient(135deg, #1A1A1A 0%, #2D2D2D 100%)', padding: 24, borderRadius: 24, boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
                    <p style={{ color: '#9CA3AF', fontSize: 13, textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 12px 0', fontWeight: 600 }}>ROI Total da Plataforma</p>
                    <h2 style={{ fontSize: 36, margin: 0, color: '#4ADE80' }}>
                        R$ {data?.metrics?.total_saas_roi?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) ?? '0,00'}
                    </h2>
                    <p style={{ margin: '8px 0 0 0', fontSize: 13, color: '#6B7280' }}>MRR + Receita de Multas</p>
                </div>
            </div>

            {/* DRE Financeiro do SaaS */}
            <div style={{ marginBottom: 40 }}>
                <h3 style={{ fontSize: 18, color: '#1A1A1A', margin: '0 0 24px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
                    DRE da Plataforma (Live)
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: 24, background: '#1A1A1A', borderRadius: 24, padding: 32, color: '#fff' }}>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 32, borderBottom: '1px solid #333', paddingBottom: 32 }}>
                        <div>
                            <p style={{ color: '#9CA3AF', fontSize: 13, textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 8px 0', fontWeight: 600 }}>Receita Recorrente (MRR)</p>
                            <h2 style={{ fontSize: 40, margin: 0, color: '#fff', fontWeight: 500 }}>
                                R$ {data?.metrics?.total_mrr?.toLocaleString('pt-BR')}
                            </h2>
                            <p style={{ margin: '8px 0 0 0', fontSize: 13, color: '#4ADE80' }}>+ R$ 499/locadora ativa</p>
                        </div>
                        <div>
                            <p style={{ color: '#9CA3AF', fontSize: 13, textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 8px 0', fontWeight: 600 }}>Multas Processadas (SaaS)</p>
                            <h2 style={{ fontSize: 40, margin: 0, color: '#FBBF24', fontWeight: 500 }}>
                                R$ {data?.metrics?.saas_fine_revenue?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) ?? '0,00'}
                            </h2>
                            <p style={{ margin: '8px 0 0 0', fontSize: 13, color: '#FBBF24' }}>R$ 2,50 por multa detectada</p>
                        </div>
                        <div>
                            <p style={{ color: '#9CA3AF', fontSize: 13, textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 8px 0', fontWeight: 600 }}>Lucro Líquido Estimado</p>
                            <h2 style={{ fontSize: 40, margin: 0, color: '#4ADE80', fontWeight: 500 }}>
                                R$ {Math.max(0, (data?.metrics?.total_saas_roi || 0) - 178)?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </h2>
                            <p style={{ margin: '8px 0 0 0', fontSize: 13, color: '#9CA3AF' }}>MRR + Multas - Custos</p>
                        </div>
                    </div>

                    <div style={{ paddingTop: 8 }}>
                        <h4 style={{ color: '#E5E7EB', fontSize: 15, margin: '0 0 16px 0', fontWeight: 500 }}>Detalhamento de Gastos (Billing Project)</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#27272A', padding: '16px 20px', borderRadius: 16 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <div style={{ width: 8, height: 8, borderRadius: 4, background: '#3ABF7C' }}></div>
                                    <span style={{ fontWeight: 500 }}>Supabase Pro Plan</span>
                                    <span style={{ fontSize: 12, color: '#9CA3AF', background: '#3F3F46', padding: '2px 8px', borderRadius: 999 }}>Banco SQL + Auth + Edge Functions</span>
                                </div>
                                <span style={{ fontWeight: 600 }}>$25 USD (R$ 138,00)</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#27272A', padding: '16px 20px', borderRadius: 16 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <div style={{ width: 8, height: 8, borderRadius: 4, background: '#6366F1' }}></div>
                                    <span style={{ fontWeight: 500 }}>Google Gemini 2.0 API</span>
                                    <span style={{ fontSize: 12, color: '#9CA3AF', background: '#3F3F46', padding: '2px 8px', borderRadius: 999 }}>Tokens da IA Gestora e Reconhecimento</span>
                                </div>
                                <span style={{ fontWeight: 600 }}>~$5 USD (R$ 28,00)</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#27272A', padding: '16px 20px', borderRadius: 16 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <div style={{ width: 8, height: 8, borderRadius: 4, background: '#0EA5E9' }}></div>
                                    <span style={{ fontWeight: 500 }}>Vercel Hosting</span>
                                    <span style={{ fontSize: 12, color: '#9CA3AF', background: '#3F3F46', padding: '2px 8px', borderRadius: 999 }}>Frontend CDN Edge</span>
                                </div>
                                <span style={{ fontWeight: 600 }}>$0 USD (Free Tier limits)</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#27272A', padding: '16px 20px', borderRadius: 16 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <div style={{ width: 8, height: 8, borderRadius: 4, background: '#EAB308' }}></div>
                                    <span style={{ fontWeight: 500 }}>Domínio (myfrot.ai)</span>
                                    <span style={{ fontSize: 12, color: '#9CA3AF', background: '#3F3F46', padding: '2px 8px', borderRadius: 999 }}>Anual rateado ($24/ano)</span>
                                </div>
                                <span style={{ fontWeight: 600 }}>~$2 USD (R$ 12,00)</span>
                            </div>
                        </div>
                    </div>

                </div>
            </div>

            {/* Tabela de Clientes */}
            <div style={{ background: '#fff', borderRadius: 24, padding: '32px', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
                <h3 style={{ fontSize: 18, color: '#1A1A1A', margin: '0 0 24px 0' }}>Locadoras Cadastradas</h3>

                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid #E6E6DF', color: '#737367', fontSize: 13, textTransform: 'uppercase' }}>
                            <th style={{ padding: '0 16px 16px 0', fontWeight: 600 }}>Cliente</th>
                            <th style={{ padding: '0 16px 16px 16px', fontWeight: 600 }}>Email</th>
                            <th style={{ padding: '0 16px 16px 16px', fontWeight: 600 }}>Assinatura (SaaS)</th>
                            <th style={{ padding: '0 16px 16px 16px', fontWeight: 600 }}>Stripe Connect</th>
                            <th style={{ padding: '0 16px 16px 16px', fontWeight: 600, textAlign: 'right' }}>Frota / MRR</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data?.clients?.map(client => (
                            <tr key={client.id} style={{ borderBottom: '1px solid #F5F5F0' }}>
                                <td style={{ padding: '20px 16px 20px 0', color: '#1A1A1A', fontWeight: 500 }}>
                                    {client.name || 'Sem Nome'}
                                </td>
                                <td style={{ padding: '20px 16px', color: '#737367' }}>
                                    {client.email}
                                </td>
                                <td style={{ padding: '20px 16px' }}>
                                    <span style={{
                                        display: 'inline-block',
                                        padding: '6px 14px',
                                        borderRadius: 999,
                                        fontSize: 12,
                                        fontWeight: 600,
                                        background: client.subscription_status === 'active' || client.subscription_status === 'trialing' ? '#E8F5E9' : '#FFEBEE',
                                        color: client.subscription_status === 'active' || client.subscription_status === 'trialing' ? '#2E7D32' : '#C62828'
                                    }}>
                                        {client.subscription_status.toUpperCase()}
                                    </span>
                                </td>
                                <td style={{ padding: '20px 16px' }}>
                                    <span style={{
                                        display: 'inline-block',
                                        padding: '6px 14px',
                                        borderRadius: 999,
                                        fontSize: 12,
                                        fontWeight: 600,
                                        background: client.stripe_connect_status === 'active' ? '#E3F2FD' : client.stripe_connect_status === 'pending' ? '#FFF3E0' : '#F5F5F0',
                                        color: client.stripe_connect_status === 'active' ? '#1565C0' : client.stripe_connect_status === 'pending' ? '#E65100' : '#737367'
                                    }}>
                                        {client.stripe_connect_status.toUpperCase()}
                                    </span>
                                </td>
                                <td style={{ padding: '20px 16px', textAlign: 'right', color: '#1A1A1A', fontWeight: 600 }}>
                                    <div style={{ fontSize: 13, color: '#737367', fontWeight: 500, marginBottom: 4 }}>{client.total_vehicles} carros</div>
                                    R$ {client.mrr}
                                </td>
                            </tr>
                        ))}
                        {(!data?.clients || data.clients.length === 0) && (
                            <tr>
                                <td colSpan={5} style={{ padding: 40, textAlign: 'center', color: '#8C8C82' }}>Nenhuma locadora conectada ainda.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
