import { useState } from 'react';
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

  const submit = async () => {
    if (!email || !password) { setError('Email and password required'); return; }
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
    width: '100%', padding: '10px 12px', borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.15)',
    background: 'rgba(255,255,255,0.06)', color: '#fff',
    fontSize: 14, outline: 'none', boxSizing: 'border-box',
  };

  return (
    /* Backdrop */
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.75)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      {/* Modal */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 360, background: '#0d0d1a',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 14, padding: 28, color: '#fff',
        }}
      >
        <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>
          {mode === 'signin' ? 'Sign In' : 'Create Account'}
        </div>
        <div style={{ color: '#6b7280', fontSize: 13, marginBottom: 20 }}>
          {mode === 'signin'
            ? 'Sign in to take over a country and fork the simulation.'
            : 'Create an account to start your own parallel universe.'}
        </div>

        {signupDone ? (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>📧</div>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Check your email</div>
            <div style={{ color: '#9ca3af', fontSize: 13 }}>
              We sent a confirmation link to <strong>{email}</strong>.
              Confirm it then sign in.
            </div>
            <button
              onClick={() => { setSignupDone(false); setMode('signin'); }}
              style={{
                marginTop: 16, padding: '8px 20px', borderRadius: 8, border: 'none',
                background: 'rgba(255,255,255,0.1)', color: '#fff', cursor: 'pointer',
              }}
            >
              Back to Sign In
            </button>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
              <input
                type="email"
                placeholder="email@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && submit()}
                style={inputStyle}
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && submit()}
                style={inputStyle}
              />
            </div>

            {error && (
              <div style={{
                color: '#f87171', fontSize: 12, marginBottom: 12,
                background: 'rgba(248,113,113,0.1)', padding: '8px 12px', borderRadius: 6,
              }}>
                {error}
              </div>
            )}

            <button
              onClick={submit}
              disabled={loading}
              style={{
                width: '100%', padding: '11px 0', borderRadius: 8, border: 'none',
                background: loading ? 'rgba(255,255,255,0.1)' : 'rgba(99,102,241,0.8)',
                color: '#fff', fontSize: 14, fontWeight: 600, cursor: loading ? 'default' : 'pointer',
              }}
            >
              {loading ? 'Please wait…' : mode === 'signin' ? 'Sign In' : 'Create Account'}
            </button>

            <div style={{ textAlign: 'center', marginTop: 14, fontSize: 13, color: '#6b7280' }}>
              {mode === 'signin' ? (
                <>No account?{' '}
                  <button
                    onClick={() => { setMode('signup'); setError(null); }}
                    style={{ background: 'none', border: 'none', color: '#a78bfa', cursor: 'pointer', fontSize: 13 }}
                  >
                    Sign up
                  </button>
                </>
              ) : (
                <>Already have one?{' '}
                  <button
                    onClick={() => { setMode('signin'); setError(null); }}
                    style={{ background: 'none', border: 'none', color: '#a78bfa', cursor: 'pointer', fontSize: 13 }}
                  >
                    Sign in
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
