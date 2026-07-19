'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { capture } from '@/lib/posthog';

function readUtms() {
  const params = new URLSearchParams(window.location.search);
  return {
    utm_source: params.get('utm_source') ?? undefined,
    utm_medium: params.get('utm_medium') ?? undefined,
    utm_campaign: params.get('utm_campaign') ?? undefined,
  };
}

export default function WaitlistForm() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'submitting' | 'success'>('idle');
  const [position, setPosition] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ctaFired = useRef(false);

  useEffect(() => {
    const utms = readUtms();
    capture('page_viewed', { ...utms, referrer: document.referrer || undefined });
  }, []);

  const fireCta = () => {
    if (ctaFired.current) return;
    ctaFired.current = true;
    capture('cta_clicked');
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (state === 'submitting') return;
    setError(null);
    setState('submitting');
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source: 'landing', ...readUtms() }),
      });
      const body = await res.json().catch(() => ({}) as Record<string, unknown>);
      if (res.ok) {
        const pos = typeof body.position === 'number' ? body.position : null;
        capture('waitlist_submitted', { position: pos });
        setPosition(pos);
        setState('success');
        return;
      }
      const code = typeof body.error === 'string' ? body.error : `http_${res.status}`;
      capture('waitlist_failed', { error_code: code });
      setError(
        code === 'rate_limited'
          ? 'Too many attempts, try again in a minute.'
          : code === 'invalid_email'
            ? 'Please enter a valid email address.'
            : 'Something went wrong. Please try again.'
      );
      setState('idle');
    } catch {
      capture('waitlist_failed', { error_code: 'network_error' });
      setError('Network error. Please check your connection and try again.');
      setState('idle');
    }
  };

  if (state === 'success') {
    return (
      <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-6 py-5 text-center">
        <p className="text-lg font-semibold text-emerald-400">
          {position != null ? <>You&apos;re #{position} on the list 🎉</> : <>You&apos;re on the list 🎉</>}
        </p>
        <p className="mt-1 text-sm text-slate-300">
          We&apos;ll email you as soon as ChargeAdvisor opens up.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="w-full">
      <div className="flex w-full flex-col gap-3 sm:flex-row">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onFocus={fireCta}
          placeholder="you@example.com"
          aria-label="Email address"
          className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-slate-100 placeholder-slate-500 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
        />
        <button
          type="submit"
          onClick={fireCta}
          disabled={state === 'submitting'}
          className="shrink-0 rounded-lg bg-emerald-500 px-6 py-3 font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-60"
        >
          {state === 'submitting' ? 'Joining…' : 'Join the waitlist'}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
      <p className="mt-2 text-xs text-slate-500">
        Free forever for early adopters. No spam — one launch email.
      </p>
    </form>
  );
}
