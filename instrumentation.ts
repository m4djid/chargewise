import * as Sentry from '@sentry/nextjs';

// Sentry EU (spec §3.1). No-op when SENTRY_DSN is unset (local dev).
export function register() {
  if (!process.env.SENTRY_DSN) return;
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: 0.1,
    // GDPR: never attach request bodies or user PII.
    sendDefaultPii: false,
  });
}

export const onRequestError = Sentry.captureRequestError;
