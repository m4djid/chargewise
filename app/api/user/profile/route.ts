import { requireUser } from '@/lib/supabase';
import { errorResponse, logError } from '@/lib/errors';
import { profilePatchSchema } from '@/lib/validation';

// Spec §6.7 — own profile read/update. RLS restricts to auth.uid() = id, but
// we filter explicitly anyway (defense in depth, spec §8.1).

export async function GET() {
  const auth = await requireUser();
  if ('response' in auth) return auth.response;
  const { user, supabase } = auth;

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();
  if (error) {
    logError({
      route: '/api/user/profile',
      userId: user.id,
      code: 'DB_ERROR',
      message: 'profile fetch failed',
      context: { pg_code: error.code },
      error,
    });
    return errorResponse('DB_ERROR');
  }
  if (!profile) {
    return Response.json({ error: 'not_found' }, { status: 404 });
  }
  return Response.json(profile);
}

export async function PATCH(request: Request) {
  const auth = await requireUser();
  if ('response' in auth) return auth.response;
  const { user, supabase } = auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = null;
  }
  const parsed = profilePatchSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: 'invalid_params' }, { status: 422 });
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (parsed.data.display_name !== undefined) patch.display_name = parsed.data.display_name;
  if (parsed.data.country_code !== undefined) patch.country_code = parsed.data.country_code;

  const { data: updated, error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('id', user.id)
    .select('*')
    .maybeSingle();
  if (error) {
    logError({
      route: '/api/user/profile',
      userId: user.id,
      code: 'DB_ERROR',
      message: 'profile update failed',
      context: { pg_code: error.code },
      error,
    });
    return errorResponse('DB_ERROR');
  }
  if (!updated) {
    return Response.json({ error: 'not_found' }, { status: 404 });
  }
  return Response.json(updated);
}
