'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { capture } from '@/lib/posthog';
import { getBrowserClient } from '@/lib/supabase-browser';

const CONSENT_VERSION = '2026-07-v1';

// Records GDPR consent + creates the profile row on first login (spec §6.1).
async function onboard() {
  await fetch('/api/user/onboard', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ gdpr_consent: true, gdpr_consent_version: CONSENT_VERSION }),
  });
}

function friendlyAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials')) return 'Wrong email or password.';
  if (m.includes('already registered')) return 'This email is already registered — sign in instead.';
  if (m.includes('email not confirmed')) return 'Please confirm your email first — check your inbox.';
  if (m.includes('at least')) return 'Password must be at least 6 characters.';
  return message;
}

export default function LoginPage() {
  const router = useRouter();

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    // Created lazily so prerendering never needs Supabase env vars.
    const supabase = getBrowserClient();
    try {
      if (mode === 'signin') {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) {
          setError(friendlyAuthError(err.message));
          return;
        }
        await onboard();
        router.push('/dashboard');
      } else {
        if (!consent) return; // button is disabled anyway
        const { data, error: err } = await supabase.auth.signUp({ email, password });
        if (err) {
          setError(friendlyAuthError(err.message));
          return;
        }
        // Supabase returns an empty identities array when the email is
        // already registered (with email confirmation enabled).
        if (data.user && data.user.identities && data.user.identities.length === 0) {
          setError('This email is already registered — sign in instead.');
          return;
        }
        if (!data.session) {
          setInfo('Almost there — check your inbox to confirm your email, then sign in.');
          return;
        }
        await onboard();
        capture('user_signed_up');
        router.push('/dashboard');
      }
    } finally {
      setLoading(false);
    }
  };

  const signInWithGoogle = async () => {
    setError(null);
    await getBrowserClient().auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${location.origin}/auth/callback` },
    });
  };

  const submitDisabled = loading || (mode === 'signup' && !consent);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2 text-xl font-bold text-slate-100">
          <span className="text-emerald-400">⚡</span> ChargeAdvisor
        </Link>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
          <div className="mb-6 grid grid-cols-2 gap-1 rounded-lg bg-slate-800 p-1 text-sm font-medium">
            <button
              type="button"
              onClick={() => { setMode('signin'); setError(null); setInfo(null); }}
              className={`rounded-md py-2 transition ${mode === 'signin' ? 'bg-slate-950 text-emerald-400' : 'text-slate-400'}`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => { setMode('signup'); setError(null); setInfo(null); }}
              className={`rounded-md py-2 transition ${mode === 'signup' ? 'bg-slate-950 text-emerald-400' : 'text-slate-400'}`}
            >
              Create account
            </button>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label htmlFor="email" className="mb-1 block text-sm text-slate-400">Email</label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-slate-100 outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label htmlFor="password" className="mb-1 block text-sm text-slate-400">Password</label>
              <input
                id="password"
                type="password"
                required
                minLength={6}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-slate-100 outline-none focus:border-emerald-500"
              />
            </div>

            {mode === 'signup' && (
              <label className="flex items-start gap-2 text-sm text-slate-300">
                {/* GDPR: never pre-checked (spec §8.3) */}
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-emerald-500"
                />
                <span>
                  I accept the Terms and{' '}
                  <Link href="/privacy" className="text-emerald-400 hover:underline" target="_blank">
                    Privacy Policy
                  </Link>
                </span>
              </label>
            )}

            {error && <p className="text-sm text-red-400">{error}</p>}
            {info && <p className="text-sm text-emerald-400">{info}</p>}

            <button
              type="submit"
              disabled={submitDisabled}
              className="w-full rounded-lg bg-emerald-500 py-2.5 font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
            </button>
          </form>

          <div className="my-5 flex items-center gap-3 text-xs text-slate-600">
            <span className="h-px flex-1 bg-slate-800" />
            or
            <span className="h-px flex-1 bg-slate-800" />
          </div>

          <button
            type="button"
            onClick={signInWithGoogle}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-700 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-slate-800"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
              <path fill="#4285F4" d="M23.5 12.3c0-.9-.1-1.5-.3-2.2H12v4.1h6.5c-.1 1.1-.8 2.7-2.4 3.8l3.7 2.9c2.3-2.1 3.7-5.1 3.7-8.6z" />
              <path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.7-2.9c-1 .7-2.4 1.2-4.2 1.2-3.1 0-5.8-2.1-6.8-5l-3.9 3C3.3 21.3 7.3 24 12 24z" />
              <path fill="#FBBC05" d="M5.2 14.4c-.2-.7-.4-1.5-.4-2.4s.2-1.7.4-2.4l-3.9-3C.5 8.2 0 10 0 12s.5 3.8 1.3 5.4l3.9-3z" />
              <path fill="#EA4335" d="M12 4.7c1.8 0 3 .8 3.7 1.4l3.3-3.2C17.9 1.1 15.2 0 12 0 7.3 0 3.3 2.7 1.3 6.6l3.9 3c1-2.9 3.7-4.9 6.8-4.9z" />
            </svg>
            Continue with Google
          </button>
        </div>
      </div>
    </div>
  );
}
