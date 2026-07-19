import { z } from 'zod';
import { getServiceRoleClient } from '@/lib/supabase';
import { errorResponse, logError } from '@/lib/errors';
import { sendPushNotification } from '@/lib/push';

// Spec §6.6 — INTERNAL route (middleware lets it through; we verify the
// internal secret). Service role client is allowed here per spec §8.1.
// Token contents are never logged — platform + count only.

const sendSchema = z.object({
  user_id: z.string().uuid(),
  station_id: z.string().min(1),
  title: z.string().min(1),
  body: z.string().min(1),
});

export async function POST(request: Request) {
  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret || request.headers.get('x-internal-secret') !== secret) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = null;
  }
  const parsed = sendSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: 'invalid_params' }, { status: 422 });
  }
  const { user_id, station_id, title, body: message } = parsed.data;

  const supabase = getServiceRoleClient();
  const { data: tokens, error } = await supabase
    .from('push_tokens')
    .select('id, token, platform')
    .eq('user_id', user_id)
    .eq('platform', 'web');
  if (error) {
    logError({
      route: '/api/push/send',
      userId: user_id,
      code: 'DB_ERROR',
      message: 'push token fetch failed',
      context: { pg_code: error.code },
      error,
    });
    return errorResponse('DB_ERROR');
  }

  let sent = 0;
  for (const row of tokens ?? []) {
    try {
      await sendPushNotification(row.token, row.platform, {
        title,
        body: message,
        data: { station_id },
      });
      sent += 1;
      await supabase
        .from('push_tokens')
        .update({ last_used_at: new Date().toISOString() })
        .eq('id', row.id);
    } catch (e) {
      // web-push errors carry statusCode; 404/410 = expired subscription.
      const statusCode = (e as { statusCode?: number }).statusCode;
      if (statusCode === 404 || statusCode === 410) {
        await supabase.from('push_tokens').delete().eq('id', row.id);
      }
    }
  }

  console.log(
    JSON.stringify({
      level: 'info',
      route: '/api/push/send',
      message: 'push notifications dispatched',
      platform: 'web',
      count: sent,
    })
  );
  return Response.json({ sent });
}
