import { requireUser } from '@/lib/supabase';
import { errorResponse, logError } from '@/lib/errors';
import { pushDeregisterSchema, pushRegisterSchema } from '@/lib/validation';

// Spec §6.6 — push token register/deregister. Token contents (subscription
// objects) never appear in logs (spec §10.3) — platform only.

export async function POST(request: Request) {
  const auth = await requireUser();
  if ('response' in auth) return auth.response;
  const { user, supabase } = auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = null;
  }
  const parsed = pushRegisterSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: 'invalid_params' }, { status: 422 });
  }

  const { error } = await supabase
    .from('push_tokens')
    .upsert(
      { user_id: user.id, token: parsed.data.token, platform: parsed.data.platform },
      { onConflict: 'user_id,token' }
    );
  if (error) {
    logError({
      route: '/api/push/register',
      userId: user.id,
      code: 'DB_ERROR',
      message: 'push token upsert failed',
      context: { pg_code: error.code, platform: parsed.data.platform },
      error,
    });
    return errorResponse('DB_ERROR');
  }

  console.log(
    JSON.stringify({
      level: 'info',
      route: '/api/push/register',
      message: `push token registered, platform: ${parsed.data.platform}`,
    })
  );
  return Response.json({ registered: true }, { status: 201 });
}

export async function DELETE(request: Request) {
  const auth = await requireUser();
  if ('response' in auth) return auth.response;
  const { user, supabase } = auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = null;
  }
  const parsed = pushDeregisterSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: 'invalid_params' }, { status: 422 });
  }

  const { error } = await supabase
    .from('push_tokens')
    .delete()
    .eq('user_id', user.id)
    .eq('token', parsed.data.token);
  if (error) {
    logError({
      route: '/api/push/register',
      userId: user.id,
      code: 'DB_ERROR',
      message: 'push token delete failed',
      context: { pg_code: error.code },
      error,
    });
    return errorResponse('DB_ERROR');
  }

  return Response.json({ deregistered: true });
}
