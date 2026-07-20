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
    <div className="fixed inset-x-0 bottom-0 z-[1200] border-t border-default bg-surface p-4 shadow-md">
      <div className="mx-auto flex max-w-3xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[13px] leading-[18px] text-secondary">
          We use privacy-friendly analytics (PostHog, EU-hosted) to improve
          Chargewise. No personal data, no ads, no third-party tracking.
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            onClick={() => decide('denied')}
            className="h-10 rounded-md border border-default bg-surface px-4 text-[14px] leading-[20px] text-primary transition-colors duration-fast ease-amp hover:bg-hover"
          >
            Decline
          </button>
          <button
            onClick={() => decide('granted')}
            className="h-10 rounded-md bg-accent px-4 text-[14px] font-semibold leading-[20px] text-on-accent transition-colors duration-fast ease-amp hover:bg-accent-hover active:bg-accent-active"
          >
            Accept analytics
          </button>
        </div>
      </div>
    </div>
  );
}
