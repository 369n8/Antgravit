import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function Payments() {
  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState('all'); // 'all' | 'pending' | 'paid'

  useEffect(() => {
    supabase
      .from('payments')
      .select('*, tenants(name)')
      .order('due_date', { ascending: false })
      .then(({ data }) => { setRows(data ?? []); setLoading(false); });
  }, []);

  if (loading) return <div className="loading"><div className="spinner"/> Carregando...</div>;

  const filtered = rows.filter(r => {
    if (filter === 'pending') return !r.paid_status;
    if (filter === 'paid')    return  r.paid_status;
    return true;
  });

  const totalPending = rows.filter(r => !r.paid_status).reduce((s, r) => s + (r.value_amount || 0), 0);
  const totalPaid    = rows.filter(r =>  r.paid_status).reduce((s, r) => s + (r.value_amount || 0), 0);

  return (
    <div className="page">
      <div className="page-header">
        <h1>Pagamentos</h1>
        <p>{rows.length} registro{rows.length !== 1 ? 's' : ''}</p>
      </div>

      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', maxWidth: 600 }}>
        <div className="stat-card">
          <div className="label">Total</div>
          <div className="value">{rows.length}</div>
        </div>
        <div className="stat-card">
          <div className="label">Pendente</div>
          <div className="value" style={{ color: 'var(--red)' }}>
            R$ {totalPending.toFixed(2).replace('.', ',')}
          </div>
        </div>
        <div className="stat-card">
          <div className="label">Recebido</div>
          <div className="value" style={{ color: 'var(--green)' }}>
            R$ {totalPaid.toFixed(2).replace('.', ',')}
          </div>
        </div>
      </div>

      <div className="section-header">
        <h2>Registros</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          {['all', 'pending', 'paid'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '5px 14px',
                borderRadius: 99,
                border: '1px solid var(--border)',
                background: filter === f ? 'var(--accent)' : 'transparent',
                color: filter === f ? '#fff' : 'var(--muted)',
                fontSize: 13,
              }}
            >
              {{ all: 'Todos', pending: 'Pendentes', paid: 'Pagos' }[f]}
            </button>
          ))}
        </div>
      </div>

      <div className="table-wrap">
        {filtered.length === 0 ? (
          <div className="empty">
            <strong>Nenhum pagamento encontrado</strong>
            <p>Registros aparecem aqui conforme forem adicionados.</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Locatário</th>
                <th>Semana</th>
                <th>Vencimento</th>
                <th>Pagamento</th>
                <th>Valor</th>
                <th>Método</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id}>
                  <td><strong>{p.tenants?.name ?? '—'}</strong></td>
                  <td style={{ fontSize: 13, color: 'var(--muted)' }}>{p.week_label ?? '—'}</td>
                  <td><DateCell value={p.due_date} past={!p.paid_status} /></td>
                  <td style={{ fontSize: 13, color: 'var(--muted)' }}>
                    {p.paid_date ? new Date(p.paid_date).toLocaleDateString('pt-BR') : '—'}
                  </td>
                  <td><strong>R$ {Number(p.value_amount).toFixed(2).replace('.', ',')}</strong></td>
                  <td style={{ fontSize: 13 }}>{p.payment_method ?? '—'}</td>
                  <td>
                    {p.paid_status
                      ? <span className="badge badge-green">Pago</span>
                      : <span className="badge badge-red">Pendente</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function DateCell({ value, past }) {
  if (!value) return <span style={{ color: 'var(--muted)' }}>—</span>;
  const d    = new Date(value);
  const diff = Math.ceil((d - new Date()) / 86400000);
  const color = past && diff < 0 ? 'var(--red)' : diff < 3 ? 'var(--orange)' : 'var(--muted)';
  return <span style={{ color, fontSize: 13 }}>{d.toLocaleDateString('pt-BR')}</span>;
}
