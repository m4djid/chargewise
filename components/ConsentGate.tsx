'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { fetcher } from '@/lib/fetcher';
import { capture } from '@/lib/posthog';

export const CURRENT_CONSENT_VERSION = '2026-07-v1';

// GDPR consent gate (spec §8.3). Email/password signups record consent at the
// login form, but Google OAuth users land here without ever ticking the box —
// this overlay blocks the app until they do. Also triggers on policy version
// bumps (re-consent required on material changes).
export default function ConsentGate() {
  const { data: profile, mutate } = useSWR<{ gdpr_consent_at: string | null; gdpr_consent_version: string | null }>(
    '/api/user/profile',
    fetcher
  );
  const [checked, setChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const needsConsent =
    profile != null &&
    (!profile.gdpr_consent_at || profile.gdpr_consent_version !== CURRENT_CONSENT_VERSION);

  useEffect(() => {
    if (needsConsent) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [needsConsent]);

  if (!needsConsent) return null;

  const isReConsent = Boolean(profile?.gdpr_consent_at);

  async function accept() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/user/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gdpr_consent: true, gdpr_consent_version: CURRENT_CONSENT_VERSION }),
      });
      if (!res.ok) throw new Error('onboard_failed');
      const body = (await res.json()) as { created?: boolean };
      if (body.created) capture('user_signed_up');
      await mutate();
    } catch {
      setError('Something went wrong — please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="amp-overlay fixed inset-0 z-[1300] flex items-end justify-center bg-[var(--amp-surface-overlay)] p-4 sm:items-center">
      <div className="amp-modal w-full max-w-md rounded-xl border border-default bg-surface p-6 shadow-lg">
        <h2 className="font-display text-[20px] font-semibold leading-[28px] text-primary">
          {isReConsent ? 'Our privacy policy has changed' : 'One last thing'}
        </h2>
        <p className="mt-2 text-[14px] leading-[20px] text-secondary">
          {isReConsent
            ? 'Please review and accept the updated terms to keep using Chargewise.'
            : 'To use Chargewise we need your consent to our terms and privacy policy.'}
        </p>
        <label className="mt-4 flex items-start gap-3 text-[14px] leading-[20px] text-secondary">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-accent"
          />
          <span>
            I accept the{' '}
            <a
              href="/privacy"
              target="_blank"
              className="rounded-sm text-accent-text underline underline-offset-2 transition-colors duration-fast ease-amp hover:text-accent-hover"
            >
              terms &amp; privacy policy
            </a>{' '}
            (version <span className="font-mono">{CURRENT_CONSENT_VERSION}</span>)
          </span>
        </label>
        {error && <p className="mt-3 text-[13px] leading-[18px] text-status-danger">{error}</p>}
        <button
          onClick={accept}
          disabled={!checked || submitting}
          className="mt-6 h-11 w-full rounded-md bg-accent text-[14px] font-semibold leading-[20px] text-on-accent transition-colors duration-fast ease-amp hover:bg-accent-hover active:bg-accent-active disabled:cursor-not-allowed disabled:opacity-40"
        >
          {submitting ? 'Saving…' : 'Accept and continue'}
        </button>
      </div>
    </div>
  );
}
