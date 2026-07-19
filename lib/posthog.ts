'use client';

import posthog from 'posthog-js';

// PostHog EU, GDPR-gated (spec §8.3): the SDK is initialised ONLY after the
// user grants analytics consent via the cookie banner. Consent lives in a
// first-party cookie — not localStorage.

export const CONSENT_COOKIE = 'ca_analytics_consent';

export function getAnalyticsConsent(): 'granted' | 'denied' | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${CONSENT_COOKIE}=([^;]*)`));
  if (!match) return null;
  return match[1] === 'granted' ? 'granted' : 'denied';
}

export function setAnalyticsConsent(value: 'granted' | 'denied'): void {
  document.cookie = `${CONSENT_COOKIE}=${value}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
  if (value === 'granted') {
    initPostHog();
    posthog.opt_in_capturing();
  } else if (isInitialized()) {
    posthog.opt_out_capturing();
  }
}

let initialized = false;

function isInitialized(): boolean {
  return initialized;
}

export function initPostHog(): void {
  if (initialized) return;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return;
  posthog.init(key, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://eu.posthog.com',
    capture_pageview: false, // we fire page_viewed manually with UTM props
    persistence: 'cookie',
  });
  initialized = true;
}

// No personal data (email, IP, GPS) in event properties — ever (spec §5.4).
export function capture(event: string, properties: Record<string, unknown> = {}): void {
  if (getAnalyticsConsent() !== 'granted') return;
  initPostHog();
  posthog.capture(event, properties);
}
