import { getServerClient } from '@/lib/supabase';
import { errorResponse, logError } from '@/lib/errors';
import { waitlistSchema } from '@/lib/validation';

// Spec §5.3 — public waitlist signup. Rate limiting handled in middleware.ts.
// The waitlist_join RPC is SECURITY DEFINER: inserts ON CONFLICT (email)
// DO NOTHING and returns the waitlist count (position).

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'invalid_email' }, { status: 422 });
  }

  const parsed = waitlistSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: 'invalid_email' }, { status: 422 });
  }

  const country = request.headers.get('x-vercel-ip-country');
  const supabase = getServerClient();

  const { data: position, error } = await supabase.rpc('waitlist_join', {
    p_email: parsed.data.email,
    p_source: parsed.data.source ?? null,
    p_utm_source: parsed.data.utm_source ?? null,
    p_utm_medium: parsed.data.utm_medium ?? null,
    p_utm_campaign: parsed.data.utm_campaign ?? null,
    p_country: country,
  });

  if (error) {
    // Never log the email itself (spec §10.3).
    logError({
      route: '/api/waitlist',
      code: 'DB_ERROR',
      message: 'waitlist_join RPC failed',
      context: { pg_code: error.code },
      error,
    });
    return errorResponse('DB_ERROR');
  }

  return Response.json({ success: true, position });
}
