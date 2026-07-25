'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getBrowserSupabase } from '../lib/supabase-browser';

// A peeking cat: ears + face + wagging tail. Hidden by default; CSS reveals
// it on hover only when the button has the `ready` class (both fields filled).
function CatPeek() {
  return (
    <span className="cat" aria-hidden="true">
      <svg viewBox="0 0 64 44" fill="none">
        <path className="cat-tail" d="M54 30c8-2 9-12 3-15" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        <path d="M14 20 L10 6 L22 15 Z" fill="currentColor" />
        <path d="M50 20 L54 6 L42 15 Z" fill="currentColor" />
        <ellipse cx="32" cy="30" rx="20" ry="14" fill="currentColor" />
        <circle className="cat-eye" cx="25" cy="28" r="2.4" fill="#0a0a0c" />
        <circle className="cat-eye" cx="39" cy="28" r="2.4" fill="#0a0a0c" />
        <path d="M30 33 q2 2 4 0" stroke="#0a0a0c" strokeWidth="1.6" strokeLinecap="round" fill="none" />
        <path d="M12 29h9M12 33h9M43 29h9M43 33h9" stroke="#0a0a0c" strokeWidth="1.2" strokeLinecap="round" opacity="0.5" />
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
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  // The cat only appears when BOTH fields have text.
  const ready = email.trim().length > 0 && password.trim().length > 0;

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
          options: { emailRedirectTo: typeof window !== 'undefined' ? window.location.origin : undefined },
        });
        if (error) throw error;
        setMsg('Check your inbox to confirm your email, then log in.');
      }
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
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
        <input type="email" className="field" placeholder="you@email.com"
          value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />

        <label className="field-label">Password</label>
        <input type="password" className="field" placeholder="••••••••"
          value={password} onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          autoComplete={isLogin ? 'current-password' : 'new-password'} />

        <button className={`login-btn${ready ? ' ready' : ''}`} onClick={submit} disabled={busy || !ready}>
          <span className="login-btn-text">{busy ? 'One sec…' : isLogin ? 'Log in' : 'Create account'}</span>
          <CatPeek />
        </button>
        {isLogin && <p className="cat-hint">Fill both fields and hover the button… 🐾</p>}

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
