import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { PillTabs, exportCSV, fmt } from '../lib/shared';
import { AlertTriangle, Download, RefreshCw, CheckCircle2, Clock, XCircle } from 'lucide-react';

const G = {
  card: { background: '#FFF', borderRadius: 24, padding: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid #F1F5F9' },
  btn: (primary = false) => ({
    display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 12, border: primary ? 'none' : '1.5px solid #E2E8F0',
    background: primary ? '#102A57' : '#FFF', color: primary ? '#FFF' : '#102A57', fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s', outline: 'none'
  }),
  statLabel: { fontSize: 11, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 },
  statValue: { fontSize: 22, fontWeight: 900, color: '#102A57', letterSpacing: '-0.5px' },
  bdg: (color) => ({ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8, fontSize: 11, fontWeight: 900, background: `${color}15`, color: color, textTransform: 'uppercase', letterSpacing: '0.05em' }),
};

const STATUS_META = {
  pendente: { label: 'Pendente', color: '#F59E0B', bg: '#FFF7ED', icon: Clock },
  indicacao_feita: { label: 'Indicação Feita', color: '#5B58EC', bg: '#F3F2FF', icon: RefreshCw },
  pago: { label: 'Pago', color: '#10B981', bg: '#F0FDF4', icon: CheckCircle2 },
  contestado: { label: 'Contestado', color: '#EF4444', bg: '#FFF1F1', icon: XCircle },
};

const TABS = [
  ['all', 'Todos'],
  ['pendente', 'Pendentes'],
  ['indicacao_feita', 'Indicação'],
  ['pago', 'Pagas'],
];

function StatusBadge({ status }) {
  const m = STATUS_META[status] ?? STATUS_META.pendente;
  return (
    <span style={G.bdg(m.color)}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: m.color }} />
      {m.label}
    </span>
  );
}

function ptDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export default function Fines() {
  const [fines, setFines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('all');
  const [updating, setUpdating] = useState(null);
  const [error, setError] = useState(null);

  const load = async () => {
    setLoading(true);
    const { data, error: err } = await supabase
      .from('fines')
      .select(`
        *,
        vehicles!fines_vehicle_id_fkey (id, plate, brand, model),
        tenants!fines_tenant_id_fkey   (id, name, cpf, cnh, phone)
      `)
      .order('infraction_date', { ascending: false });

    if (err) setError(err.message);
    else setFines(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleStatus = async (id, newStatus) => {
    setUpdating(id);
    const { error: err } = await supabase
      .from('fines')
      .update({ status: newStatus })
      .eq(id === 'all' ? 'id' : 'id', id); // Just a trick to use id safely

    if (!err) {
      setFines(f => f.map(x => x.id === id ? { ...x, status: newStatus } : x));
    } else {
      setError(err.message);
    }
    setUpdating(null);
  };

  const visible = tab === 'all' ? fines : fines.filter(f => f.status === tab);

  const totals = {
    pendente: fines.filter(f => f.status === 'pendente').length,
    pago: fines.filter(f => f.status === 'pago').length,
    total_valor: fines.reduce((s, f) => s + Number(f.amount || 0), 0),
  };

  const doExport = () => {
    exportCSV('multas_lunara.csv',
      ['Placa', 'Veículo', 'Data', 'Descrição', 'Valor R$', 'Locatário', 'Status'],
      visible.map(f => [
        f.vehicles?.plate ?? '—',
        `${f.vehicles?.brand ?? ''} ${f.vehicles?.model ?? ''}`.trim() || '—',
        ptDateTime(f.infraction_date),
        f.description ?? '—',
        fmt(f.amount),
        f.tenants?.name ?? '—',
        STATUS_META[f.status]?.label ?? f.status,
      ])
    );
  };

  if (loading) return <div className="loading"><div className="spinner" /> Sincronizando multas...</div>;

  return (
    <div className="page" style={{ padding: '20px 0', fontFamily: 'Helvetica, sans-serif' }}>
      {/* ── HEADER ── */}
      <div style={{ marginBottom: 48, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
        <h1 style={{ fontSize: 32, fontWeight: 900, color: '#102A57', margin: 0, letterSpacing: '-1.5px' }}>Central de Multas</h1>
        <p style={{ color: '#94A3B8', fontSize: 16, fontWeight: 700, margin: '8px 0 0' }}>Gestão de condutores e economia via SNE</p>
        <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
          <button style={G.btn()} onClick={load}><RefreshCw size={18} /> SINCRONIZAR</button>
          <button style={G.btn(true)} onClick={doExport}><Download size={18} /> EXPORTAR</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 24, marginBottom: 32 }}>
        {[
          { label: 'Total Registrado', value: fines.length, color: '#102A57' },
          { label: 'Aguardando Indicação', value: totals.pendente, color: '#F59E0B' },
          { label: 'Volume Financeiro', value: `R$ ${fmt(totals.total_valor)}`, color: '#EF4444' },
          { label: 'Multas Pagas', value: totals.pago, color: '#10B981' },
        ].map((s, i) => (
          <div key={i} style={G.card}>
            <div style={G.statLabel}>{s.label}</div>
            <div style={{ ...G.statValue, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ background: '#FFF', padding: '8px', borderRadius: 16, border: '1px solid #F1F5F9', marginBottom: 32, display: 'inline-block' }}>
        <PillTabs tabs={TABS} active={tab} onChange={setTab} />
      </div>

      {visible.length === 0 ? (
        <div style={{ ...G.card, textAlign: 'center', padding: '80px 20px' }}>
          <AlertTriangle size={48} style={{ margin: '0 auto 16px', color: '#E2E8F0' }} />
          <h3 style={{ color: '#102A57', fontSize: 18, fontWeight: 800, margin: 0 }}>Nenhuma multa encontrada</h3>
          <p style={{ marginTop: 8, color: '#94A3B8', fontSize: 14, fontWeight: 500 }}>Sua frota está limpa. Novas infrações aparecerão aqui automaticamente.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {visible.map(f => {
            const m = STATUS_META[f.status] || STATUS_META.pendente;
            return (
              <div key={f.id} style={{ ...G.card, display: 'grid', gridTemplateColumns: '1.2fr 1.5fr 1fr 1.2fr 1fr', gap: 24, alignItems: 'center', transition: 'transform 0.2s' }}>
                <div>
                  <div style={G.statLabel}>Veículo</div>
                  <div style={{ fontSize: 16, fontWeight: 900, color: '#102A57' }}>{f.vehicles?.plate}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#94A3B8' }}>{f.vehicles?.brand} {f.vehicles?.model}</div>
                </div>

                <div>
                  <div style={G.statLabel}>Infração</div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#102A57' }}>{ptDateTime(f.infraction_date)}</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#64748B', marginTop: 2, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{f.description}</div>
                </div>

                <div>
                  <div style={G.statLabel}>Valor</div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: '#EF4444' }}>R$ {fmt(f.amount)}</div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#10B981' }}>-20% COM SNE</div>
                </div>

                <div>
                  <div style={G.statLabel}>Condutor Responsável</div>
                  {f.tenants ? (
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: '#102A57' }}>{f.tenants.name}</div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8' }}>CNH: {f.tenants.cnh || '—'}</div>
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, fontWeight: 800, color: '#F59E0B' }}>NÃO IDENTIFICADO</div>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
                  <StatusBadge status={f.status} />
                  <div style={{ display: 'flex', gap: 6 }}>
                    {f.status === 'pendente' && (
                      <button style={{ ...G.btn(), padding: '6px 12px', fontSize: 11, background: '#F3F2FF', color: '#5B58EC', border: 'none' }}
                        onClick={() => handleStatus(f.id, 'indicacao_feita')} disabled={updating === f.id}>Indicar</button>
                    )}
                    {f.status !== 'pago' && (
                      <button style={{ ...G.btn(), padding: '6px 12px', fontSize: 11, background: '#F0FDF4', color: '#10B981', border: 'none' }}
                        onClick={() => handleStatus(f.id, 'pago')} disabled={updating === f.id}>Baixar</button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
