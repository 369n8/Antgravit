import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { generateContractPDF } from '../components/ContractGenerator';

export default function Tenants() {
  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('tenants')
      .select('*, vehicles(plate, brand, model)')
      .order('created_at', { ascending: false })
      .then(({ data }) => { setRows(data ?? []); setLoading(false); });
  }, []);

  if (loading) return <div className="loading"><div className="spinner"/> Carregando...</div>;

  return (
    <div className="page">
      <div className="page-header">
        <h1>Locatários</h1>
        <p>{rows.length} locatário{rows.length !== 1 ? 's' : ''} cadastrado{rows.length !== 1 ? 's' : ''}</p>
      </div>

      <div className="table-wrap">
        {rows.length === 0 ? (
          <div className="empty">
            <strong>Nenhum locatário cadastrado</strong>
            <p>Adicione locatários via bot do Telegram ou diretamente no banco.</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>CPF</th>
                <th>Telefone</th>
                <th>CNH</th>
                <th>Validade CNH</th>
                <th>App</th>
                <th>Veículo</th>
                <th>Aluguel / sem.</th>
                <th>Status</th>
                <th>Blacklist</th>
                <th>Contrato</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(t => (
                <tr key={t.id}>
                  <td><strong>{t.name}</strong></td>
                  <td style={{ fontFamily: 'monospace', fontSize: 13 }}>{t.cpf ?? '—'}</td>
                  <td>{t.phone ?? '—'}</td>
                  <td>{t.cnh ?? '—'}</td>
                  <td><DateCell value={t.cnh_expiry} /></td>
                  <td>{t.app_used ?? '—'}</td>
                  <td>
                    {t.vehicles
                      ? <span style={{ fontSize: 13 }}>{t.vehicles.plate} · {[t.vehicles.brand, t.vehicles.model].filter(Boolean).join(' ')}</span>
                      : <span style={{ color: 'var(--muted)' }}>—</span>}
                  </td>
                  <td>{t.rent_weekly != null ? `R$ ${Number(t.rent_weekly).toFixed(2).replace('.', ',')}` : '—'}</td>
                  <td>
                    <span className={`badge ${t.status === 'ativo' ? 'badge-green' : 'badge-gray'}`}>
                      {t.status === 'ativo' ? 'Ativo' : 'Encerrado'}
                    </span>
                  </td>
                  <td>
                    {t.blacklisted
                      ? <span className="badge badge-red">Blacklist</span>
                      : <span style={{ color: 'var(--muted)', fontSize: 13 }}>—</span>}
                  </td>
                  <td>
                    <button
                      onClick={() => generateContractPDF(t, t.vehicles)}
                      style={{ padding:'5px 12px', borderRadius:6, border:'1px solid var(--border)', background:'transparent', color:'var(--accent)', fontSize:12, cursor:'pointer', whiteSpace:'nowrap' }}
                    >
                      PDF
                    </button>
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

function DateCell({ value }) {
  if (!value) return <span style={{ color: 'var(--muted)' }}>—</span>;
  const d    = new Date(value);
  const diff = Math.ceil((d - new Date()) / 86400000);
  const color = diff < 0 ? 'var(--red)' : diff < 60 ? 'var(--orange)' : 'var(--muted)';
  return <span style={{ color, fontSize: 13 }}>{d.toLocaleDateString('pt-BR')}</span>;
}
