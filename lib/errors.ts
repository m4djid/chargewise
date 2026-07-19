import * as Sentry from '@sentry/nextjs';

// Error codes per spec §10.2. HTTP status + Sentry policy are encoded here so
// route handlers never hand-pick status codes.
export const ERROR_CODES = {
  STATION_NOT_FOUND: { http: 404, sentry: false },
  TARIFF_NOT_FOUND: { http: 200, sentry: false },
  NO_BADGES: { http: 200, sentry: false },
  BADGE_LIMIT_EXCEEDED: { http: 422, sentry: false },
  INVALID_SESSION_DATA: { http: 422, sentry: false },
  LOCATION_REQUIRED: { http: 422, sentry: false },
  RATE_LIMITED: { http: 429, sentry: false },
  TARIFF_SYNC_FAILED: { http: 500, sentry: true },
  DB_ERROR: { http: 500, sentry: true },
  AUTH_MISMATCH: { http: 403, sentry: true },
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;

export class ApiError extends Error {
  code: ErrorCode;
  context: Record<string, unknown>;

  constructor(code: ErrorCode, message: string, context: Record<string, unknown> = {}) {
    super(message);
    this.code = code;
    this.context = context;
  }
}

// §10.3 — redaction helpers. Never log full identifiers.
export function redactUserId(userId: string): string {
  return userId.slice(0, 8);
}

export function redactEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  return `${local.slice(0, 3)}***@${domain}`;
}

const SENSITIVE_KEYS = ['lat', 'lng', 'latitude', 'longitude', 'email', 'token', 'jwt', 'reported_cost_eur', 'reported_kwh'];

function sanitizeContext(context: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(context)) {
    out[k] = SENSITIVE_KEYS.includes(k) ? '[redacted]' : v;
  }
  return out;
}

// §10.1 — structured error log. Console for Vercel logs, Sentry when the code requires it.
export function logError(params: {
  route: string;
  userId?: string;
  code: ErrorCode;
  message: string;
  context?: Record<string, unknown>;
  error?: unknown;
}): void {
  const { route, userId, code, message, context = {}, error } = params;
  const entry = {
    level: 'error',
    route,
    user_id: userId ? redactUserId(userId) : undefined,
    error_code: code,
    message,
    context: sanitizeContext(context),
  };
  console.error(JSON.stringify(entry));
  if (ERROR_CODES[code].sentry) {
    Sentry.captureException(error instanceof Error ? error : new Error(message), {
      extra: entry,
    });
  }
}

export function errorResponse(code: ErrorCode, extra: Record<string, unknown> = {}): Response {
  return Response.json({ error: code, ...extra }, { status: ERROR_CODES[code].http });
}
