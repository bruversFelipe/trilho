import { useEffect, useRef, useState } from 'react';
import { checkSlug, login, register, saveSession } from '../api/api.js';

const SLUG_CHECK_DELAY = 350;

export default function AuthModal({ onAuthenticated }) {
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [identifier, setIdentifier] = useState(''); // "usuario" on login, "nome" on register
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [slugInfo, setSlugInfo] = useState(null); // { slug, available } | null
  const [checkingSlug, setCheckingSlug] = useState(false);
  const latestQueryRef = useRef('');

  // Live-check the derived username as the person types their name at signup.
  useEffect(() => {
    if (mode !== 'register') {
      setSlugInfo(null);
      return undefined;
    }

    const name = identifier.trim();
    if (!name) {
      setSlugInfo(null);
      setCheckingSlug(false);
      return undefined;
    }

    latestQueryRef.current = name;
    setCheckingSlug(true);
    const handle = setTimeout(() => {
      checkSlug(name)
        .then((result) => {
          if (latestQueryRef.current === name) setSlugInfo(result);
        })
        .catch(() => {
          if (latestQueryRef.current === name) setSlugInfo(null);
        })
        .finally(() => {
          if (latestQueryRef.current === name) setCheckingSlug(false);
        });
    }, SLUG_CHECK_DELAY);

    return () => clearTimeout(handle);
  }, [identifier, mode]);

  function switchMode() {
    setMode((m) => (m === 'login' ? 'register' : 'login'));
    setIdentifier('');
    setPassword('');
    setError('');
    setSlugInfo(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    const value = identifier.trim();
    if (!value || !password) {
      setError(mode === 'login' ? 'Preencha usuario e senha.' : 'Preencha seu nome e uma senha.');
      return;
    }
    if (mode === 'register' && !slugInfo?.available) {
      setError('Escolha um nome cujo usuario ainda esteja disponivel.');
      return;
    }

    setSubmitting(true);
    try {
      const data = mode === 'login' ? await login(value, password) : await register(value, password);
      saveSession(data);
      onAuthenticated(data.user);
    } catch (err) {
      setError(err.message || 'Nao foi possivel continuar.');
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit =
    identifier.trim() && password && (mode === 'login' || (slugInfo?.available && !checkingSlug));

  return (
    <div className="modal-overlay auth-overlay">
      <div className="modal-panel">
        <div className="auth-hero">
          <img src="/logo.svg" alt="" className="auth-logo" />
          <span className="auth-brand-name">Trilho</span>
        </div>

        <div className="auth-heading">
          <h2>{mode === 'login' ? 'Bem-vindo de volta' : 'Vamos comecar'}</h2>
          <p className="auth-subtitle">
            {mode === 'login'
              ? 'Entre para ver os compromissos da sua semana.'
              : 'Leva menos de um minuto - sua agenda ja comeca com alguns exemplos.'}
          </p>
        </div>

        <form className="task-form" onSubmit={handleSubmit}>
          <label className="field">
            <span>{mode === 'login' ? 'Usuario' : 'Seu nome'}</span>
            <input
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder={mode === 'login' ? 'seu usuario' : 'como podemos te chamar?'}
              autoFocus
              autoComplete={mode === 'login' ? 'username' : 'name'}
            />
          </label>

          {mode === 'register' && identifier.trim() && (
            <>
              {(checkingSlug || !slugInfo?.slug || !slugInfo.available) && (
                <p className={`slug-hint${!checkingSlug && slugInfo?.slug ? ' is-taken' : ''}`}>
                  {checkingSlug
                    ? 'Verificando...'
                    : !slugInfo?.slug
                      ? 'Digite um nome valido.'
                      : `"${slugInfo.slug}" ja existe - tente outro nome`}
                </p>
              )}

              {!checkingSlug && slugInfo?.available && (
                <div className="slug-preview">
                  <span className="slug-preview-label">Seu usuario de login será</span>
                  <span className="slug-preview-value">@{slugInfo.slug}</span>
                  <span className="slug-preview-note">
                    Guarde esse usuario - é com ele que voce vai entrar da proxima vez, nao com seu nome.
                  </span>
                </div>
              )}
            </>
          )}

          <label className="field">
            <span>Senha</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === 'login' ? 'sua senha' : 'crie uma senha'}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </label>

          {error && <p className="auth-error">{error}</p>}

          <div className="modal-actions">
            <button type="submit" className="primary-btn" disabled={submitting || !canSubmit}>
              {submitting ? 'Aguarde...' : mode === 'login' ? 'Entrar' : 'Criar minha conta'}
            </button>
          </div>
        </form>

        <button type="button" className="link-btn auth-switch" onClick={switchMode}>
          {mode === 'login' ? 'Ainda nao tem conta? Criar uma agora' : 'Ja tem conta? Fazer login'}
        </button>
      </div>
    </div>
  );
}
