import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const STATUS_MAP = {
  locado:      { label: 'Locado',     cls: 'badge-green'  },
  disponivel:  { label: 'Disponível', cls: 'badge-blue'   },
  manutencao:  { label: 'Manutenção', cls: 'badge-orange' },
};

export default function Vehicles() {
  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('vehicles')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => { setRows(data ?? []); setLoading(false); });
  }, []);

  if (loading) return <div className="loading"><div className="spinner"/> Carregando...</div>;

  return (
    <div className="page">
      <div className="page-header">
        <h1>Veículos</h1>
        <p>{rows.length} veículo{rows.length !== 1 ? 's' : ''} cadastrado{rows.length !== 1 ? 's' : ''}</p>
      </div>

      <div className="table-wrap">
        {rows.length === 0 ? (
          <div className="empty">
            <strong>Nenhum veículo cadastrado</strong>
            <p>Adicione veículos via bot do Telegram ou diretamente no banco.</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Placa</th>
                <th>Veículo</th>
                <th>Tipo</th>
                <th>Ano</th>
                <th>KM</th>
                <th>Combustível</th>
                <th>Aluguel / sem.</th>
                <th>IPVA</th>
                <th>Seguro</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(v => {
                const st = STATUS_MAP[v.status] ?? { label: v.status, cls: 'badge-gray' };
                return (
                  <tr key={v.id}>
                    <td><strong>{v.plate ?? '—'}</strong></td>
                    <td>{[v.brand, v.model].filter(Boolean).join(' ') || '—'}</td>
                    <td style={{ textTransform: 'capitalize' }}>{v.type}</td>
                    <td>{v.year ?? '—'}</td>
                    <td>{v.km != null ? `${Number(v.km).toLocaleString('pt-BR')} km` : '—'}</td>
                    <td>
                      <FuelBar level={v.fuel_level} />
                    </td>
                    <td>{v.rent_weekly != null ? `R$ ${Number(v.rent_weekly).toFixed(2).replace('.', ',')}` : '—'}</td>
                    <td><DateCell value={v.docs_ipva} /></td>
                    <td><DateCell value={v.docs_seguro} /></td>
                    <td><span className={`badge ${st.cls}`}>{st.label}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function FuelBar({ level }) {
  if (level == null) return <span style={{ color: 'var(--muted)' }}>—</span>;
  const color = level > 50 ? 'var(--green)' : level > 20 ? 'var(--orange)' : 'var(--red)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ width: 60, height: 6, background: 'var(--border)', borderRadius: 99 }}>
        <div style={{ height: '100%', width: `${level}%`, background: color, borderRadius: 99 }} />
      </div>
      <span style={{ fontSize: 12, color: 'var(--muted)' }}>{level}%</span>
    </div>
  );
}

function DateCell({ value }) {
  if (!value) return <span style={{ color: 'var(--muted)' }}>—</span>;
  const d     = new Date(value);
  const today = new Date();
  const diff  = Math.ceil((d - today) / 86400000);
  const color = diff < 0 ? 'var(--red)' : diff < 30 ? 'var(--orange)' : 'var(--muted)';
  return <span style={{ color, fontSize: 13 }}>{d.toLocaleDateString('pt-BR')}</span>;
}
