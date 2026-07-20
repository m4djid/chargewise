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
      <div className="rounded-lg border border-default bg-subtle px-6 py-5 text-center">
        <p className="text-[16px] font-semibold leading-[24px] text-primary">
          {position != null ? (
            <>
              You&apos;re <span className="font-mono">#{position}</span> on the list.
            </>
          ) : (
            <>You&apos;re on the list.</>
          )}
        </p>
        <p className="mt-1 text-[14px] leading-[20px] text-secondary">
          We&apos;ll email you as soon as Chargewise opens up.
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
          className="h-11 w-full rounded-md border border-default bg-surface px-4 text-[14px] leading-[20px] text-primary outline-none transition-shadow duration-fast ease-amp placeholder:text-tertiary focus-visible:shadow-focus"
        />
        <button
          type="submit"
          onClick={fireCta}
          disabled={state === 'submitting'}
          className="h-11 shrink-0 rounded-md bg-accent px-6 text-[14px] font-semibold leading-[20px] text-on-accent transition-colors duration-fast ease-amp hover:bg-accent-hover active:bg-accent-active disabled:opacity-50"
        >
          {state === 'submitting' ? 'Joining…' : 'Join the waitlist'}
        </button>
      </div>
      {error && <p className="mt-2 text-[13px] leading-[18px] text-status-danger">{error}</p>}
      <p className="mt-2 text-[12px] leading-[16px] text-tertiary">
        Free forever for early adopters. No spam — one launch email.
      </p>
    </form>
  );
}
