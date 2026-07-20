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

const inputClasses =
  'h-10 w-full rounded-md border border-default bg-surface px-3 text-[14px] leading-[20px] text-primary placeholder:text-tertiary outline-none transition-shadow duration-fast ease-amp focus-visible:shadow-focus';

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
    <div className="flex min-h-screen items-center justify-center bg-subtle px-4 py-12">
      <div className="w-full max-w-sm">
        <Link
          href="/"
          className="mb-8 flex items-center justify-center gap-2 rounded-md font-display text-[20px] font-semibold leading-[28px] text-primary"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5 text-accent" aria-hidden="true">
            <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z" />
          </svg>
          Chargewise
        </Link>

        <div className="rounded-lg border border-default bg-surface p-6 shadow-sm">
          <div className="mb-6 grid grid-cols-2 gap-1 rounded-lg bg-subtle p-1 text-[14px] font-medium leading-[20px]">
            <button
              type="button"
              onClick={() => { setMode('signin'); setError(null); setInfo(null); }}
              className={`h-8 rounded-md transition-colors duration-fast ease-amp ${
                mode === 'signin' ? 'bg-surface text-accent-text shadow-sm' : 'text-secondary hover:text-primary'
              }`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => { setMode('signup'); setError(null); setInfo(null); }}
              className={`h-8 rounded-md transition-colors duration-fast ease-amp ${
                mode === 'signup' ? 'bg-surface text-accent-text shadow-sm' : 'text-secondary hover:text-primary'
              }`}
            >
              Create account
            </button>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label htmlFor="email" className="mb-1 block text-[13px] leading-[18px] text-secondary">Email</label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClasses}
              />
            </div>
            <div>
              <label htmlFor="password" className="mb-1 block text-[13px] leading-[18px] text-secondary">Password</label>
              <input
                id="password"
                type="password"
                required
                minLength={6}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClasses}
              />
            </div>

            {mode === 'signup' && (
              <label className="flex items-start gap-2 text-[13px] leading-[18px] text-secondary">
                {/* GDPR: never pre-checked (spec §8.3) */}
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-accent"
                />
                <span>
                  I accept the terms and{' '}
                  <Link
                    href="/privacy"
                    className="rounded-sm text-accent-text underline underline-offset-2 transition-colors duration-fast ease-amp hover:text-accent-hover"
                    target="_blank"
                  >
                    privacy policy
                  </Link>
                </span>
              </label>
            )}

            {error && <p className="text-[13px] leading-[18px] text-status-danger">{error}</p>}
            {info && <p className="text-[13px] leading-[18px] text-secondary">{info}</p>}

            <button
              type="submit"
              disabled={submitDisabled}
              className="h-10 w-full rounded-md bg-accent text-[14px] font-semibold leading-[20px] text-on-accent transition-colors duration-fast ease-amp hover:bg-accent-hover active:bg-accent-active disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
            </button>
          </form>

          <div className="my-5 flex items-center gap-3 text-[12px] leading-[16px] text-tertiary">
            <span className="h-px flex-1 bg-border-default" />
            or
            <span className="h-px flex-1 bg-border-default" />
          </div>

          <button
            type="button"
            onClick={signInWithGoogle}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-md border border-default bg-surface text-[14px] font-medium leading-[20px] text-primary transition-colors duration-fast ease-amp hover:bg-hover"
          >
            {/* Monochrome Google mark — the Ampere audit forbids raw hex in TSX,
                so the multicolor brand glyph is rendered in currentColor. */}
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 text-secondary" aria-hidden>
              <path d="M23.5 12.3c0-.9-.1-1.5-.3-2.2H12v4.1h6.5c-.1 1.1-.8 2.7-2.4 3.8l3.7 2.9c2.3-2.1 3.7-5.1 3.7-8.6z" />
              <path d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.7-2.9c-1 .7-2.4 1.2-4.2 1.2-3.1 0-5.8-2.1-6.8-5l-3.9 3C3.3 21.3 7.3 24 12 24z" />
              <path d="M5.2 14.4c-.2-.7-.4-1.5-.4-2.4s.2-1.7.4-2.4l-3.9-3C.5 8.2 0 10 0 12s.5 3.8 1.3 5.4l3.9-3z" />
              <path d="M12 4.7c1.8 0 3 .8 3.7 1.4l3.3-3.2C17.9 1.1 15.2 0 12 0 7.3 0 3.3 2.7 1.3 6.6l3.9 3c1-2.9 3.7-4.9 6.8-4.9z" />
            </svg>
            Continue with Google
          </button>
        </div>
      </div>
    </div>
  );
}
