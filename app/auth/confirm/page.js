'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getBrowserSupabase } from '../../../lib/supabase-browser';

// Landing page for the Supabase email-confirmation link.
// Handles both the newer ?code=... (PKCE) and older #access_token=... hash flows.
export default function ConfirmPage() {
  const [status, setStatus] = useState('working'); // working | ok | error
  const [msg, setMsg] = useState('Confirming your email…');

  useEffect(() => {
    const supabase = getBrowserSupabase();
    (async () => {
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get('code');
        const errDesc = url.searchParams.get('error_description');
        if (errDesc) { setStatus('error'); setMsg(errDesc); return; }
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        }
        // hash-token flow is picked up automatically by supabase-js on load
        setStatus('ok'); setMsg('Email confirmed! You can start using Kepto.');
      } catch (e) {
        setStatus('error'); setMsg(e.message || 'That link is invalid or has expired.');
      }
    })();
  }, []);

  return (
    <main className="auth-wrap">
      <div className="neon-orb orb-a" /><div className="neon-orb orb-b" />
      <div className="auth-card glass" style={{ textAlign: 'center' }}>
        <div className="auth-brand" style={{ marginBottom: 18 }}>Kep<span>to</span></div>
        <h1 className="auth-title">{status === 'error' ? 'Hmm.' : status === 'ok' ? "You're in" : 'One moment'}</h1>
        <p className="auth-sub" style={{ marginBottom: 20 }}>{msg}</p>
        <Link className="btn-primary" href={status === 'ok' ? '/' : '/login'}>
          {status === 'ok' ? 'Go to Kepto' : 'Back to log in'}
        </Link>
      </div>
    </main>
  );
}
