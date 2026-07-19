'use client';

import { useEffect, useState } from 'react';
import { getAnalyticsConsent, initPostHog, setAnalyticsConsent } from '@/lib/posthog';

// GDPR analytics consent gate (spec §8.3). PostHog is never initialised
// before consent is granted. Consent lives in a first-party cookie.
export default function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = getAnalyticsConsent();
    if (consent === null) {
      setVisible(true);
    } else if (consent === 'granted') {
      // Consent already given on a previous visit — safe to initialise.
      initPostHog();
    }
  }, []);

  if (!visible) return null;

  const decide = (value: 'granted' | 'denied') => {
    setAnalyticsConsent(value);
    setVisible(false);
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-[1200] border-t border-slate-700 bg-slate-900/95 p-4 backdrop-blur">
      <div className="mx-auto flex max-w-3xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-300">
          We use privacy-friendly analytics (PostHog, EU-hosted) to improve
          ChargeAdvisor. No personal data, no ads, no third-party tracking.
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            onClick={() => decide('denied')}
            className="rounded-md border border-slate-600 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
          >
            Decline
          </button>
          <button
            onClick={() => decide('granted')}
            className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400"
          >
            Accept analytics
          </button>
        </div>
      </div>
    </div>
  );
}
