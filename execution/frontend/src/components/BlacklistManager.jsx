/**
 * BlacklistManager
 * Extraído de frotas-app (1).jsx + conectado ao Supabase.
 *
 * Uso:
 *   import BlacklistManager from './components/BlacklistManager';
 *   <BlacklistManager onClose={() => setShowBlack(false)} />
 *
 * O componente busca e persiste dados diretamente no Supabase.
 * Blacklist = tenants com blacklisted = true.
 */

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

// ── Estilos (idênticos ao original frotas-app) ────────────────────────────
const S = {
  ovl:  { position:'fixed', inset:0, background:'rgba(0,0,0,.9)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:200, padding:16 },
  mbox: { background:'#0f172a', border:'1px solid #334155', borderRadius:20, padding:24, width:'100%', maxWidth:580, maxHeight:'92vh', overflowY:'auto' },
  card: { background:'linear-gradient(135deg,#0f172a,#1e293b)', border:'1px solid #334155', borderRadius:16, padding:20 },
  inp:  { background:'#0a0f1e', border:'1px solid #334155', borderRadius:8, padding:'9px 12px', color:'#e2e8f0', fontFamily:'inherit', fontSize:13, width:'100%', outline:'none', boxSizing:'border-box' },
  lbl:  { fontSize:11, color:'#64748b', letterSpacing:'.08em', textTransform:'uppercase', marginBottom:5, display:'block' },
  btn:  (v='p') => ({ padding:'9px 17px', borderRadius:10, border:'none', background: v==='p'?'linear-gradient(135deg,#6366f1,#8b5cf6)':v==='d'?'linear-gradient(135deg,#ef4444,#dc2626)':'#1e293b', color:'#fff', fontFamily:'inherit', fontSize:13, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', gap:8 }),
  bdg:  (c) => ({ display:'inline-flex', alignItems:'center', padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:700, background:`${c}20`, color:c, border:`1px solid ${c}40`, letterSpacing:'.05em', textTransform:'uppercase', whiteSpace:'nowrap' }),
  row:  { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'11px 0', borderBottom:'1px solid #1e293b' },
  spin: { width:18, height:18, border:'2px solid #334155', borderTopColor:'#6366f1', borderRadius:'50%', animation:'spin .7s linear infinite', display:'inline-block' },
};

const today = new Date().toISOString().split('T')[0];

export default function BlacklistManager({ onClose }) {
  const [list, setList]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [nome, setNome]       = useState('');
  const [cpf,  setCpf]        = useState('');
  const [motivo, setMotivo]   = useState('');

  // ── Buscar blacklist do Supabase ────────────────────────────────────────
  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('tenants')
        .select('id, name, cpf, notes, created_at')
        .eq('blacklisted', true)
        .order('created_at', { ascending: false });

      if (error) { console.error('[Blacklist] load:', error.message); }
      setList(
        (data || []).map(t => ({
          id:     t.id,
          name:   t.name,
          cpf:    t.cpf || '',
          motivo: t.notes || '',
          data:   t.created_at?.split('T')[0] || today,
        }))
      );
      setLoading(false);
    }
    load();
  }, []);

  // ── Adicionar à blacklist ───────────────────────────────────────────────
  async function addToBlacklist() {
    if (!nome.trim()) return;
    setSaving(true);

    // Verifica se já existe um tenant com esse CPF
    let tenantId = null;
    if (cpf.trim()) {
      const { data: existing } = await supabase
        .from('tenants')
        .select('id')
        .eq('cpf', cpf.trim())
        .maybeSingle();

      if (existing) {
        // Apenas marca o existente
        await supabase
          .from('tenants')
          .update({ blacklisted: true, notes: motivo || existing.notes })
          .eq('id', existing.id);
        tenantId = existing.id;
      }
    }

    if (!tenantId) {
      // Cria entrada mínima de blacklist
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('tenants')
        .insert({
          client_id:   user.id,
          name:        nome.trim(),
          cpf:         cpf.trim() || null,
          notes:       motivo.trim() || null,
          blacklisted: true,
          status:      'encerrado',
          rent_weekly: 0,
          deposits:    0,
        })
        .select('id')
        .single();

      if (error) { console.error('[Blacklist] insert:', error.message); setSaving(false); return; }
      tenantId = data.id;
    }

    setList(l => [{ id: tenantId, name: nome.trim(), cpf: cpf.trim(), motivo: motivo.trim(), data: today }, ...l]);
    setNome(''); setCpf(''); setMotivo('');
    setSaving(false);
  }

  // ── Remover da blacklist ────────────────────────────────────────────────
  async function removeFromBlacklist(id) {
    const { error } = await supabase
      .from('tenants')
      .update({ blacklisted: false })
      .eq('id', id);

    if (error) { console.error('[Blacklist] remove:', error.message); return; }
    setList(l => l.filter(b => b.id !== id));
  }

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div style={S.ovl} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={S.mbox}>

        {/* Cabeçalho */}
        <div style={{ fontSize:18, fontWeight:700, marginBottom:4, color:'#e2e8f0' }}>
          Blacklist de Locatários
        </div>
        <div style={{ color:'#64748b', fontSize:13, marginBottom:16 }}>
          Pessoas com histórico problemático. Consulte antes de fechar um contrato.
        </div>

        {/* Formulário de adição */}
        <div style={{ ...S.card, marginBottom:14, border:'1px solid #ef444430' }}>
          <div style={{ fontSize:12, fontWeight:700, color:'#ef4444', marginBottom:10 }}>
            + Adicionar à Blacklist
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:9, marginBottom:9 }}>
            <div>
              <label style={S.lbl}>Nome *</label>
              <input style={S.inp} placeholder="Nome completo" value={nome} onChange={e => setNome(e.target.value)} />
            </div>
            <div>
              <label style={S.lbl}>CPF</label>
              <input style={S.inp} placeholder="000.000.000-00" value={cpf} onChange={e => setCpf(e.target.value)} />
            </div>
            <div style={{ gridColumn:'1/-1' }}>
              <label style={S.lbl}>Motivo</label>
              <input style={S.inp} placeholder="Ex: Inadimplência, danos ao veículo..." value={motivo} onChange={e => setMotivo(e.target.value)} />
            </div>
          </div>
          <button style={{ ...S.btn('d'), fontSize:12 }} disabled={saving || !nome.trim()} onClick={addToBlacklist}>
            {saving ? <span style={S.spin}/> : null}
            Adicionar
          </button>
        </div>

        {/* Lista */}
        {loading && (
          <div style={{ textAlign:'center', padding:30, color:'#64748b' }}>
            <span style={S.spin}/> Carregando...
          </div>
        )}

        {!loading && list.length === 0 && (
          <div style={{ ...S.card, textAlign:'center', padding:30, color:'#64748b' }}>
            Blacklist vazia — ótima notícia!
          </div>
        )}

        {!loading && list.map(b => (
          <div
            key={b.id}
            style={{ ...S.card, marginBottom:8, border:'1px solid #ef444430', display:'flex', justifyContent:'space-between', alignItems:'center' }}
          >
            <div>
              <div style={{ fontWeight:700, fontSize:14, color:'#ef4444' }}>{b.name}</div>
              <div style={{ fontSize:12, color:'#64748b', marginTop:2 }}>
                {b.cpf && `CPF: ${b.cpf} • `}Adicionado: {b.data ? new Date(b.data).toLocaleDateString('pt-BR') : '—'}
              </div>
              {b.motivo && (
                <div style={{ fontSize:12, color:'#94a3b8', marginTop:2 }}>{b.motivo}</div>
              )}
            </div>
            <button
              style={{ ...S.btn('g'), padding:'5px 11px', fontSize:12 }}
              onClick={() => removeFromBlacklist(b.id)}
            >
              Remover
            </button>
          </div>
        ))}

        {/* Fechar */}
        <button style={{ ...S.btn('g'), marginTop:12 }} onClick={onClose}>
          Fechar
        </button>
      </div>
    </div>
  );
}
