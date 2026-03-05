import { useState } from 'react';
import { supabase } from '../lib/supabase';

export default function Login() {
  const [mode, setMode]       = useState('login'); // 'login' | 'signup'
  const [email, setEmail]     = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { error: err } =
      mode === 'login'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });

    if (err) setError(err.message);
    setLoading(false);
  }

  return (
    <div className="login-wrap">
      <div className="login-box">
        <h1>FrotaApp</h1>
        <p>{mode === 'login' ? 'Entre na sua conta para acessar o painel.' : 'Crie uma conta para começar.'}</p>

        <form onSubmit={handleSubmit}>
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
              required
            />
          </div>

          <button className="btn-primary" type="submit" disabled={loading}>
            {loading ? 'Aguarde...' : mode === 'login' ? 'Entrar' : 'Criar conta'}
          </button>

          {error && <p className="error-msg">{error}</p>}
        </form>

        <div className="mode-toggle">
          {mode === 'login' ? (
            <>Não tem conta?{' '}
              <button onClick={() => { setMode('signup'); setError(''); }}>Cadastre-se</button>
            </>
          ) : (
            <>Já tem conta?{' '}
              <button onClick={() => { setMode('login'); setError(''); }}>Entrar</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
