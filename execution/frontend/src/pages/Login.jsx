import { useState } from 'react';
import { supabase } from '../lib/supabase';

export default function Login() {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    if (mode === 'login') {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err) setError(err.message);
    } else {
      const { data, error: err } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name: companyName || email.split('@')[0] } }
      });
      if (err) {
        setError(err.message);
      } else if (data?.user?.identities?.length === 0) {
        setError('Este e-mail já está cadastrado. Tente fazer login.');
      } else {
        setSuccess('Conta criada com sucesso! Verifique seu e-mail para confirmar, ou faça login agora.');
        setMode('login');
      }
    }
    setLoading(false);
  }

  return (
    <div className="login-wrap">
      <div className="login-box">
        <h1>FrotaApp</h1>
        <p>{mode === 'login' ? 'Entre na sua conta para acessar o painel.' : 'Crie uma conta para começar.'}</p>

        <form onSubmit={handleSubmit}>
          {mode === 'signup' && (
            <div className="field">
              <label>Nome da Locadora</label>
              <input
                type="text"
                value={companyName}
                onChange={e => setCompanyName(e.target.value)}
                placeholder="Ex: Locadora Premium Auto"
                required
              />
            </div>
          )}
          <div className="field">
            <label>E-mail</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="seu@email.com"
              required
            />
          </div>
          <div className="field">
            <label>Senha</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              minLength={6}
              required
            />
          </div>

          <button className="btn-primary" type="submit" disabled={loading}>
            {loading ? 'Aguarde...' : mode === 'login' ? 'Entrar' : 'Criar conta'}
          </button>

          {error && <p className="error-msg">{error}</p>}
          {success && <p style={{ color: '#2E7D32', fontSize: 13, marginTop: 12, textAlign: 'center' }}>{success}</p>}
        </form>

        <div className="mode-toggle">
          {mode === 'login' ? (
            <>Não tem conta?{' '}
              <button onClick={() => { setMode('signup'); setError(''); setSuccess(''); }}>Cadastre-se</button>
            </>
          ) : (
            <>Já tem conta?{' '}
              <button onClick={() => { setMode('login'); setError(''); setSuccess(''); }}>Entrar</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
