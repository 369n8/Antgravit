import { useState } from 'react';
import { supabase } from '../lib/supabase';

const STEPS = ['Identificacao', 'Habilitacao & App', 'Endereco & Emergencia'];

const inp = {
  background: '#F6F6F4',
  border: '2px solid transparent',
  borderRadius: 16,
  padding: '16px 20px',
  color: '#111827',
  fontFamily: 'inherit',
  fontSize: 15,
  width: '100%',
  outline: 'none',
  boxSizing: 'border-box',
  fontWeight: 600,
  WebkitAppearance: 'none',
  transition: 'border-color 0.15s',
};

const lbl = {
  fontSize: 12,
  color: '#9CA3AF',
  marginBottom: 8,
  display: 'block',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

const BLANK = {
  name: '', cpf: '', rg: '', birth_date: '', phone: '', email: '',
  cnh: '', cnh_category: 'B', app_used: 'Uber', app_rating: '',
  address: '', bairro: '', cidade: '', estado: 'SP', cep: '',
  emergency_name: '', emergency_phone: '', emergency_relation: '',
};

export default function Cadastro() {
  const params = new URLSearchParams(window.location.search);
  const clientId = params.get('ref');

  const [step, setStep] = useState(0);
  const [form, setForm] = useState(BLANK);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(null);

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const nextStep = () => {
    setError(null);
    if (step === 0 && !form.name.trim()) { setError('Por favor, informe seu nome completo.'); return; }
    if (step === 0 && !form.phone.trim()) { setError('Por favor, informe seu telefone.'); return; }
    setStep(s => s + 1);
  };

  const handleSubmit = async () => {
    if (!form.cnh.trim()) { setError('Por favor, informe o numero da CNH.'); return; }
    setSaving(true);
    setError(null);

    const payload = {
      client_id: clientId || null,
      name: form.name.trim(),
      cpf: form.cpf || null,
      rg: form.rg || null,
      birth_date: form.birth_date || null,
      phone: form.phone || null,
      email: form.email || null,
      cnh: form.cnh || null,
      cnh_category: form.cnh_category || null,
      app_used: form.app_used || null,
      app_rating: form.app_rating || null,
      address: form.address || null,
      bairro: form.bairro || null,
      cidade: form.cidade || null,
      estado: form.estado || null,
      cep: form.cep || null,
      emergency_name: form.emergency_name || null,
      emergency_phone: form.emergency_phone || null,
      emergency_relation: form.emergency_relation || null,
      status: 'pendente',
      blacklisted: false,
    };

    const { error: err } = await supabase.from('tenants').insert(payload);
    setSaving(false);
    if (err) { setError('Erro ao enviar. Tente novamente.'); return; }
    setDone(true);
  };

  if (!clientId) return (
    <div style={wrap}>
      <div style={card}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>⚠️</div>
        <h2 style={h2}>Link invalido</h2>
        <p style={sub}>Este link de cadastro nao e valido. Solicite um novo link ao seu gestor de frota.</p>
      </div>
    </div>
  );

  if (done) return (
    <div style={wrap}>
      <div style={card}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#FFC524', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', fontSize: 32 }}>
          ✓
        </div>
        <h2 style={{ ...h2, marginBottom: 12 }}>Cadastro enviado!</h2>
        <p style={{ ...sub, marginBottom: 0 }}>
          Seus dados foram recebidos com sucesso. Seu gestor de frota vai analisar e entrar em contato em breve para confirmar seu contrato.
        </p>
      </div>
    </div>
  );

  return (
    <div style={wrap}>
      <div style={{ maxWidth: 480, margin: '0 auto', width: '100%' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#FFC524', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontWeight: 800, fontSize: 22, color: '#111827' }}>
            M
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#111827', margin: '0 0 6px', letterSpacing: '-0.5px' }}>Cadastro de Motorista</h1>
          <p style={{ fontSize: 14, color: '#9CA3AF', margin: 0, fontWeight: 500 }}>Preencha seus dados para ingressar na frota</p>
        </div>

        {/* Progress */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 28 }}>
          {STEPS.map((label, i) => (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ height: 4, borderRadius: 99, background: i <= step ? '#FFC524' : '#E5E7EB', transition: 'background 0.3s' }} />
              <div style={{ fontSize: 10, fontWeight: 700, color: i === step ? '#111827' : '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'center' }}>
                {label}
              </div>
            </div>
          ))}
        </div>

        {/* Card do step */}
        <div style={card}>

          {/* Step 0: Identificacao */}
          {step === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={lbl}>Nome Completo *</label>
                <input
                  style={inp} placeholder="Joao da Silva"
                  value={form.name} onChange={e => f('name', e.target.value)}
                  onFocus={e => e.target.style.borderColor = '#FFC524'}
                  onBlur={e => e.target.style.borderColor = 'transparent'}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={lbl}>CPF</label>
                  <input style={inp} placeholder="000.000.000-00" value={form.cpf} onChange={e => f('cpf', e.target.value)}
                    onFocus={e => e.target.style.borderColor = '#FFC524'} onBlur={e => e.target.style.borderColor = 'transparent'} />
                </div>
                <div>
                  <label style={lbl}>RG</label>
                  <input style={inp} placeholder="00.000.000-0" value={form.rg} onChange={e => f('rg', e.target.value)}
                    onFocus={e => e.target.style.borderColor = '#FFC524'} onBlur={e => e.target.style.borderColor = 'transparent'} />
                </div>
              </div>
              <div>
                <label style={lbl}>Data de Nascimento</label>
                <input style={inp} type="date" value={form.birth_date} onChange={e => f('birth_date', e.target.value)}
                  onFocus={e => e.target.style.borderColor = '#FFC524'} onBlur={e => e.target.style.borderColor = 'transparent'} />
              </div>
              <div>
                <label style={lbl}>Telefone (WhatsApp) *</label>
                <input style={inp} placeholder="(11) 99999-9999" type="tel" value={form.phone} onChange={e => f('phone', e.target.value)}
                  onFocus={e => e.target.style.borderColor = '#FFC524'} onBlur={e => e.target.style.borderColor = 'transparent'} />
              </div>
              <div>
                <label style={lbl}>E-mail</label>
                <input style={inp} placeholder="email@exemplo.com" type="email" value={form.email} onChange={e => f('email', e.target.value)}
                  onFocus={e => e.target.style.borderColor = '#FFC524'} onBlur={e => e.target.style.borderColor = 'transparent'} />
              </div>
            </div>
          )}

          {/* Step 1: CNH & App */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={lbl}>Numero da CNH *</label>
                <input style={inp} placeholder="00000000000" value={form.cnh} onChange={e => f('cnh', e.target.value)}
                  onFocus={e => e.target.style.borderColor = '#FFC524'} onBlur={e => e.target.style.borderColor = 'transparent'} />
              </div>
              <div>
                <label style={lbl}>Categoria da CNH</label>
                <select style={{ ...inp, cursor: 'pointer' }} value={form.cnh_category} onChange={e => f('cnh_category', e.target.value)}>
                  {['A', 'B', 'AB', 'C', 'D', 'E'].map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Aplicativo que usa</label>
                <select style={{ ...inp, cursor: 'pointer' }} value={form.app_used} onChange={e => f('app_used', e.target.value)}>
                  {['Uber', '99', 'InDriver', 'Lyft', 'Outro'].map(a => <option key={a}>{a}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Sua avaliacao no app</label>
                <input style={inp} placeholder="ex: 4.87" type="number" step="0.01" min="1" max="5" value={form.app_rating} onChange={e => f('app_rating', e.target.value)}
                  onFocus={e => e.target.style.borderColor = '#FFC524'} onBlur={e => e.target.style.borderColor = 'transparent'} />
              </div>
              <div style={{ background: '#F6F6F4', borderRadius: 16, padding: 16 }}>
                <p style={{ fontSize: 13, color: '#6B7280', margin: 0, lineHeight: 1.6 }}>
                  Sua CNH sera verificada pelo gestor antes da aprovacao. Certifique-se de que os dados estao corretos.
                </p>
              </div>
            </div>
          )}

          {/* Step 2: Endereco & Emergencia */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginBottom: 4 }}>Seu Endereco</div>
              <div>
                <label style={lbl}>Rua e Numero</label>
                <input style={inp} placeholder="Rua das Flores, 123" value={form.address} onChange={e => f('address', e.target.value)}
                  onFocus={e => e.target.style.borderColor = '#FFC524'} onBlur={e => e.target.style.borderColor = 'transparent'} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={lbl}>Bairro</label>
                  <input style={inp} placeholder="Vila Mariana" value={form.bairro} onChange={e => f('bairro', e.target.value)}
                    onFocus={e => e.target.style.borderColor = '#FFC524'} onBlur={e => e.target.style.borderColor = 'transparent'} />
                </div>
                <div>
                  <label style={lbl}>CEP</label>
                  <input style={inp} placeholder="00000-000" value={form.cep} onChange={e => f('cep', e.target.value)}
                    onFocus={e => e.target.style.borderColor = '#FFC524'} onBlur={e => e.target.style.borderColor = 'transparent'} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px', gap: 12 }}>
                <div>
                  <label style={lbl}>Cidade</label>
                  <input style={inp} placeholder="Sao Paulo" value={form.cidade} onChange={e => f('cidade', e.target.value)}
                    onFocus={e => e.target.style.borderColor = '#FFC524'} onBlur={e => e.target.style.borderColor = 'transparent'} />
                </div>
                <div>
                  <label style={lbl}>Estado</label>
                  <input style={inp} placeholder="SP" maxLength={2} value={form.estado} onChange={e => f('estado', e.target.value.toUpperCase())}
                    onFocus={e => e.target.style.borderColor = '#FFC524'} onBlur={e => e.target.style.borderColor = 'transparent'} />
                </div>
              </div>

              <div style={{ borderTop: '1px solid #EBEBEB', paddingTop: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginBottom: 12 }}>Contato de Emergencia</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <label style={lbl}>Nome</label>
                    <input style={inp} placeholder="Maria da Silva" value={form.emergency_name} onChange={e => f('emergency_name', e.target.value)}
                      onFocus={e => e.target.style.borderColor = '#FFC524'} onBlur={e => e.target.style.borderColor = 'transparent'} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label style={lbl}>Parentesco</label>
                      <input style={inp} placeholder="Mae" value={form.emergency_relation} onChange={e => f('emergency_relation', e.target.value)}
                        onFocus={e => e.target.style.borderColor = '#FFC524'} onBlur={e => e.target.style.borderColor = 'transparent'} />
                    </div>
                    <div>
                      <label style={lbl}>Telefone</label>
                      <input style={inp} placeholder="(11) 99999-9999" type="tel" value={form.emergency_phone} onChange={e => f('emergency_phone', e.target.value)}
                        onFocus={e => e.target.style.borderColor = '#FFC524'} onBlur={e => e.target.style.borderColor = 'transparent'} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Erro */}
          {error && (
            <div style={{ marginTop: 16, background: '#FEE2E2', borderRadius: 12, padding: '12px 16px', fontSize: 13, color: '#991B1B', fontWeight: 600 }}>
              {error}
            </div>
          )}

          {/* Navegacao */}
          <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
            {step > 0 && (
              <button
                onClick={() => { setStep(s => s - 1); setError(null); }}
                style={{ flex: 1, padding: '16px', borderRadius: 999, border: '1.5px solid #E5E7EB', background: '#FFF', fontSize: 15, fontWeight: 700, color: '#6B7280', cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Voltar
              </button>
            )}
            {step < 2 ? (
              <button
                onClick={nextStep}
                style={{ flex: 2, padding: '16px', borderRadius: 999, border: 'none', background: '#FFC524', fontSize: 15, fontWeight: 800, color: '#111827', cursor: 'pointer', fontFamily: 'inherit', transition: 'opacity 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.opacity = '0.88'}
                onMouseLeave={e => e.currentTarget.style.opacity = '1'}
              >
                Continuar →
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={saving}
                style={{ flex: 2, padding: '16px', borderRadius: 999, border: 'none', background: saving ? '#E5E7EB' : '#111827', fontSize: 15, fontWeight: 800, color: saving ? '#9CA3AF' : '#FFF', cursor: saving ? 'wait' : 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}
              >
                {saving ? 'Enviando...' : 'Enviar Cadastro'}
              </button>
            )}
          </div>
        </div>

        <p style={{ textAlign: 'center', fontSize: 12, color: '#9CA3AF', marginTop: 20, lineHeight: 1.6 }}>
          Seus dados ficam protegidos e so serao usados pela gestao da frota.
        </p>
      </div>
    </div>
  );
}

const wrap = {
  minHeight: '100vh',
  background: '#F6F6F4',
  padding: '40px 20px 60px',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, sans-serif',
  WebkitFontSmoothing: 'antialiased',
};

const card = {
  background: '#FFF',
  borderRadius: 28,
  padding: '28px 24px',
  boxShadow: '0 4px 40px rgba(0,0,0,0.04)',
};

const h2 = {
  fontSize: 22,
  fontWeight: 800,
  color: '#111827',
  margin: '0 0 8px',
  letterSpacing: '-0.3px',
};

const sub = {
  fontSize: 14,
  color: '#9CA3AF',
  lineHeight: 1.6,
  margin: 0,
};
