'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getBrowserSupabase } from '../lib/supabase-browser';

// A side-view cat that walks left↔right along the top of the login button.
function WalkingCat() {
  return (
    <span className="cat" aria-hidden="true">
      <svg viewBox="0 0 60 40" fill="none">
        <path className="cat-tail" d="M8 22 C0 20 1 10 6 8" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
        <rect className="leg leg1" x="16" y="24" width="3.4" height="11" rx="1.7" fill="currentColor" />
        <rect className="leg leg2" x="24" y="24" width="3.4" height="11" rx="1.7" fill="currentColor" />
        <rect className="leg leg3" x="34" y="24" width="3.4" height="11" rx="1.7" fill="currentColor" />
        <rect className="leg leg4" x="42" y="24" width="3.4" height="11" rx="1.7" fill="currentColor" />
        <ellipse cx="30" cy="20" rx="19" ry="9" fill="currentColor" />
        <circle cx="47" cy="15" r="8.5" fill="currentColor" />
        <path d="M43 8 L41 1 L48 5 Z" fill="currentColor" />
        <path d="M52 8 L54 1 L48 5 Z" fill="currentColor" />
        <circle className="cat-eye" cx="49" cy="14" r="1.7" fill="#0a0a0c" />
        <path d="M54.5 15 h3" stroke="#0a0a0c" strokeWidth="1.1" strokeLinecap="round" />
        <path d="M54.5 17.5 h3" stroke="#0a0a0c" strokeWidth="1.1" strokeLinecap="round" opacity=".6" />
      </svg>
    </span>
  );
}

export default function AuthForm({ mode }) {
  const isLogin = mode === 'login';
  const router = useRouter();
  const supabase = getBrowserSupabase();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [caps, setCaps] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const ready = email.trim().length > 0 && password.trim().length > 0;
  const redirect = typeof window !== 'undefined' ? window.location.origin : undefined;

  async function submit() {
    if (!ready || busy) return;
    setBusy(true); setErr(''); setMsg('');
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push('/');
      } else {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: `${redirect}/auth/confirm` },
        });
        if (error) throw error;
        setMsg('Check your inbox to confirm your email, then log in.');
      }
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  }

  async function forgot() {
    setErr(''); setMsg('');
    if (!email.trim()) { setErr('Enter your email first, then tap "Forgot password".'); return; }
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${redirect}/auth/confirm` });
      if (error) throw error;
      setMsg('Password reset link sent — check your inbox.');
    } catch (e) { setErr(e.message); }
  }

  return (
    <main className="auth-wrap">
      <div className="neon-orb orb-a" /><div className="neon-orb orb-b" />
      <div className="auth-card glass">
        <Link href="/" className="auth-brand">Kep<span>to</span></Link>
        <h1 className="auth-title">{isLogin ? 'Welcome back' : 'Create your brain'}</h1>
        <p className="auth-sub">
          {isLogin ? 'Log in to reach everything you saved.' : 'One account. Everything you save, searchable by meaning.'}
        </p>

        <label className="field-label">Email</label>
        <div className="glow-wrap">
          <input type="email" className="field" placeholder="you@email.com"
            value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </div>

        <label className="field-label">Password</label>
        <div className="glow-wrap">
          <div className="field-row">
            <input type={showPw ? 'text' : 'password'} className="field" placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyUp={(e) => setCaps(e.getModifierState && e.getModifierState('CapsLock'))}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              autoComplete={isLogin ? 'current-password' : 'new-password'} />
            <button type="button" className="pw-toggle" onClick={() => setShowPw((s) => !s)}>
              {showPw ? 'HIDE' : 'SHOW'}
            </button>
          </div>
        </div>
        {caps && <div className="caps-warn">⚠ Caps Lock is on</div>}

        <button className={`login-btn${ready ? ' ready' : ''}`} onClick={submit} disabled={busy || !ready}>
          <span className="login-btn-text">{busy ? 'One sec…' : isLogin ? 'Log in' : 'Create account'}</span>
          <WalkingCat />
        </button>
        {isLogin && <p className="cat-hint">Fill both fields and hover the button… 🐾</p>}

        {isLogin && (
          <p className="auth-switch" style={{ marginTop: 14 }}>
            <a href="#" onClick={(e) => { e.preventDefault(); forgot(); }}>Forgot password?</a>
          </p>
        )}

        {msg && <div className="auth-msg">{msg}</div>}
        {err && <div className="auth-err">{err}</div>}

        <p className="auth-switch">
          {isLogin ? "New here? " : 'Already have an account? '}
          <Link href={isLogin ? '/signup' : '/login'}>{isLogin ? 'Create an account' : 'Log in'}</Link>
        </p>
      </div>
    </main>
  );
}
