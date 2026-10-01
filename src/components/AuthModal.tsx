import { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '../store/authStore';

interface Props {
  onSuccess: () => void;
  onClose: () => void;
}

export default function AuthModal({ onSuccess, onClose }: Props) {
  const { signIn, signUp } = useAuthStore();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [signupDone, setSignupDone] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  // Escape closes; focus moves into the dialog and returns to the opener on close.
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    (emailRef.current ?? dialogRef.current)?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCloseRef.current(); };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      opener?.focus?.();
    };
  }, []);

  const submit = async () => {
    if (!email || !password) { setError('We need an email and a password to let you in.'); return; }
    setLoading(true);
    setError(null);
    const err = mode === 'signin'
      ? await signIn(email, password)
      : await signUp(email, password);
    setLoading(false);
    if (err) { setError(err); return; }
    if (mode === 'signup') { setSignupDone(true); return; }
    onSuccess();
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', minHeight: 44, padding: '0 var(--rs-space-3)', borderRadius: 'var(--rs-radius-md)',
    border: 'var(--rs-border-thin)', background: 'var(--rs-paper)', color: 'var(--rs-ink)',
    font: '500 var(--rs-text-md) var(--rs-font-body)', boxSizing: 'border-box',
  };
  const labelStyle: React.CSSProperties = {
    display: 'flex', flexDirection: 'column', gap: 'var(--rs-space-1)',
    font: '800 var(--rs-text-xs) var(--rs-font-body)', color: 'var(--rs-ink)',
  };
  const linkBtn: React.CSSProperties = { minHeight: 44, margin: 0, fontSize: 'var(--rs-text-sm)' };

  return (
    /* Backdrop */
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'var(--rs-space)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 'var(--rs-space-4)',
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
        aria-describedby="auth-modal-desc"
        tabIndex={-1}
        onClick={e => e.stopPropagation()}
        className="rs-paper"
        style={{
          position: 'relative', width: 380, maxWidth: '100%', boxSizing: 'border-box',
          padding: 'var(--rs-space-5)', fontFamily: 'var(--rs-font-body)',
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close sign-in"
          className="game-button game-button-dark"
          style={{ position: 'absolute', top: 'var(--rs-space-3)', right: 'var(--rs-space-3)', width: 44, padding: 0 }}
        >
          <span aria-hidden="true">×</span>
        </button>
        <h2 id="auth-modal-title" style={{
          fontFamily: 'var(--rs-font-display)', fontWeight: 700, fontSize: 'var(--rs-text-xl)',
          lineHeight: 1, margin: '0 0 var(--rs-space-2)', paddingRight: 'var(--rs-space-7)',
        }}>
          {mode === 'signin' ? 'Sign in' : 'Create an account'}
        </h2>
        <p id="auth-modal-desc" style={{ color: 'var(--rs-muted-on-paper)', fontSize: 'var(--rs-text-sm)', lineHeight: 1.45, margin: '0 0 var(--rs-space-5)' }}>
          {mode === 'signin'
            ? 'Sign in to take over a country and fork the world.'
            : 'Make an account and get a parallel universe of your very own.'}
        </p>

        {signupDone ? (
          <div role="status" style={{ textAlign: 'center' }}>
            <h3 style={{ fontFamily: 'var(--rs-font-display)', fontSize: 'var(--rs-text-lg)', margin: '0 0 var(--rs-space-2)' }}>
              Check your email
            </h3>
            <p style={{ color: 'var(--rs-muted-on-paper)', fontSize: 'var(--rs-text-sm)', lineHeight: 1.45, margin: 0 }}>
              We sent a confirmation link to <strong style={{ color: 'var(--rs-ink)' }}>{email}</strong>.
              Click it, then come back and sign in.
            </p>
            <button
              type="button"
              onClick={() => { setSignupDone(false); setMode('signin'); }}
              className="game-button game-button-dark"
              style={{ marginTop: 'var(--rs-space-4)' }}
            >
              Back to sign in
            </button>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--rs-space-3)', marginBottom: 'var(--rs-space-4)' }}>
              <label style={labelStyle}>
                Email
                <input
                  ref={emailRef}
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && submit()}
                  style={inputStyle}
                />
              </label>
              <label style={labelStyle}>
                Password
                <input
                  type="password"
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && submit()}
                  style={inputStyle}
                />
              </label>
            </div>

            {error && (
              <p role="alert" style={{
                color: 'var(--rs-bad)', fontSize: 'var(--rs-text-sm)', fontWeight: 700, margin: '0 0 var(--rs-space-3)',
                border: 'var(--rs-border-thin)', borderColor: 'var(--rs-bad)', borderRadius: 'var(--rs-radius-sm)',
                padding: 'var(--rs-space-2) var(--rs-space-3)',
              }}>
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={submit}
              disabled={loading}
              className="game-button rs-button-lg"
              style={{ width: '100%' }}
            >
              {loading ? (mode === 'signin' ? 'Signing you in…' : 'Creating your account…') : mode === 'signin' ? 'Sign in!' : 'Create account!'}
            </button>

            <p style={{ textAlign: 'center', margin: 'var(--rs-space-3) 0 0', fontSize: 'var(--rs-text-sm)', color: 'var(--rs-muted-on-paper)' }}>
              {mode === 'signin' ? (
                <>No account yet?{' '}
                  <button type="button" className="game-link" style={linkBtn} onClick={() => { setMode('signup'); setError(null); }}>
                    Create one
                  </button>
                </>
              ) : (
                <>Already have one?{' '}
                  <button type="button" className="game-link" style={linkBtn} onClick={() => { setMode('signin'); setError(null); }}>
                    Sign in
                  </button>
                </>
              )}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
