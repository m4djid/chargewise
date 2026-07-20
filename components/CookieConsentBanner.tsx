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
    <div className="fixed inset-x-0 bottom-0 z-[1200] border-t border-stone-200 bg-white p-4 shadow-sm">
      <div className="mx-auto flex max-w-3xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-stone-600">
          We use privacy-friendly analytics (PostHog, EU-hosted) to improve
          Chargewise. No personal data, no ads, no third-party tracking.
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            onClick={() => decide('denied')}
            className="rounded-md border border-stone-200 bg-white px-4 py-2 text-sm text-stone-700 shadow-sm hover:bg-stone-50"
          >
            Decline
          </button>
          <button
            onClick={() => decide('granted')}
            className="rounded-md bg-stone-900 px-4 py-2 text-sm font-semibold text-white hover:bg-stone-700"
          >
            Accept analytics
          </button>
        </div>
      </div>
    </div>
  );
}
