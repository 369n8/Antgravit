import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const CATEGORY_COLORS = {
  'Manutenção': 'badge-orange',
  'Pneu':       'badge-orange',
  'Seguro':     'badge-blue',
  'Revisão':    'badge-blue',
  'Multa':      'badge-red',
};

export default function Maintenance() {
  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [type, setType]       = useState('all'); // 'all' | 'expense' | 'schedule'

  useEffect(() => {
    supabase
      .from('maintenance')
      .select('*, vehicles(plate, brand, model)')
      .order('date', { ascending: false })
      .then(({ data }) => { setRows(data ?? []); setLoading(false); });
  }, []);

  if (loading) return <div className="loading"><div className="spinner"/> Carregando...</div>;

  const filtered = rows.filter(r => type === 'all' || r.event_type === type);
  const totalExpenses = rows
    .filter(r => r.event_type === 'expense')
    .reduce((s, r) => s + (r.value_amount || 0), 0);

  return (
    <div className="page">
      <div className="page-header">
        <h1>Manutenção</h1>
        <p>Despesas e agenda de manutenções</p>
      </div>

      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', maxWidth: 600 }}>
        <div className="stat-card">
          <div className="label">Total de eventos</div>
          <div className="value">{rows.length}</div>
        </div>
        <div className="stat-card">
          <div className="label">Agendamentos pendentes</div>
          <div className="value" style={{ color: 'var(--orange)' }}>
            {rows.filter(r => r.event_type === 'schedule' && !r.done).length}
          </div>
        </div>
        <div className="stat-card">
          <div className="label">Total em despesas</div>
          <div className="value" style={{ color: 'var(--red)' }}>
            R$ {totalExpenses.toFixed(2).replace('.', ',')}
          </div>
        </div>
      </div>

      <div className="section-header">
        <h2>Eventos</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          {['all', 'expense', 'schedule'].map(f => (
            <button
              key={f}
              onClick={() => setType(f)}
              style={{
                padding: '5px 14px',
                borderRadius: 99,
                border: '1px solid var(--border)',
                background: type === f ? 'var(--accent)' : 'transparent',
                color: type === f ? '#fff' : 'var(--muted)',
                fontSize: 13,
              }}
            >
              {{ all: 'Todos', expense: 'Despesas', schedule: 'Agendamentos' }[f]}
            </button>
          ))}
        </div>
      </div>

      <div className="table-wrap">
        {filtered.length === 0 ? (
          <div className="empty">
            <strong>Nenhum evento de manutenção</strong>
            <p>Registros aparecem aqui conforme forem adicionados.</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Veículo</th>
                <th>Tipo</th>
                <th>Categoria</th>
                <th>Data</th>
                <th>Descrição</th>
                <th>Valor</th>
                <th>Situação</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(m => {
                const badgeCls = CATEGORY_COLORS[m.category] ?? 'badge-gray';
                return (
                  <tr key={m.id}>
                    <td>
                      {m.vehicles
                        ? <strong>{m.vehicles.plate} · {[m.vehicles.brand, m.vehicles.model].filter(Boolean).join(' ')}</strong>
                        : <span style={{ color: 'var(--muted)' }}>—</span>}
                    </td>
                    <td>
                      <span className={`badge ${m.event_type === 'expense' ? 'badge-red' : 'badge-blue'}`}>
                        {m.event_type === 'expense' ? 'Despesa' : 'Agendamento'}
                      </span>
                    </td>
                    <td>
                      {m.category
                        ? <span className={`badge ${badgeCls}`}>{m.category}</span>
                        : <span style={{ color: 'var(--muted)' }}>—</span>}
                    </td>
                    <td style={{ fontSize: 13, color: 'var(--muted)' }}>
                      {m.date ? new Date(m.date).toLocaleDateString('pt-BR') : '—'}
                    </td>
                    <td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {m.description ?? '—'}
                    </td>
                    <td>
                      {m.value_amount != null && m.value_amount > 0
                        ? <strong>R$ {Number(m.value_amount).toFixed(2).replace('.', ',')}</strong>
                        : <span style={{ color: 'var(--muted)' }}>—</span>}
                    </td>
                    <td>
                      {m.done
                        ? <span className="badge badge-green">Concluído</span>
                        : <span className="badge badge-orange">Pendente</span>}
                    </td>
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
