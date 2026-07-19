import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// 5 req/IP/min on /api/waitlist (spec §5.3). Fails open when Upstash env vars
// are absent (local dev) so the app still runs without Redis.
let limiter: Ratelimit | null = null;

function getLimiter(): Ratelimit | null {
  if (limiter) return limiter;
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }
  limiter = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(5, '1 m'),
    analytics: true,
    prefix: 'ca:waitlist',
  });
  return limiter;
}

export async function checkRateLimit(identifier: string): Promise<boolean> {
  const rl = getLimiter();
  if (!rl) return true;
  const { success } = await rl.limit(identifier);
  return success;
}
