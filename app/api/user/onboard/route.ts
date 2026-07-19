import { requireUser } from '@/lib/supabase';
import { errorResponse, logError } from '@/lib/errors';
import { onboardSchema } from '@/lib/validation';

// Spec §6.1 step 4 — first-login onboarding. The profile row itself is
// auto-created by the on_auth_user_created DB trigger; we record GDPR consent
// here and handle the race where the trigger hasn't fired yet (upsert).

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
  const parsed = onboardSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: 'invalid_params' }, { status: 422 });
  }

  const { data: profile, error: fetchError } = await supabase
    .from('profiles')
    .select('id, gdpr_consent_at')
    .eq('id', user.id)
    .maybeSingle();
  if (fetchError) {
    logError({
      route: '/api/user/onboard',
      userId: user.id,
      code: 'DB_ERROR',
      message: 'profile lookup failed',
      context: { pg_code: fetchError.code },
      error: fetchError,
    });
    return errorResponse('DB_ERROR');
  }

  // Already consented — nothing to do (idempotent onboard).
  if (profile?.gdpr_consent_at) {
    return Response.json({ created: false });
  }

  const row = {
    id: user.id,
    email: user.email ?? '',
    gdpr_consent_at: new Date().toISOString(),
    gdpr_consent_version: parsed.data.gdpr_consent_version,
    updated_at: new Date().toISOString(),
    ...(parsed.data.display_name !== undefined ? { display_name: parsed.data.display_name } : {}),
    ...(parsed.data.country_code !== undefined ? { country_code: parsed.data.country_code } : {}),
  };

  const { error: upsertError } = await supabase
    .from('profiles')
    .upsert(row, { onConflict: 'id' });
  if (upsertError) {
    logError({
      route: '/api/user/onboard',
      userId: user.id,
      code: 'DB_ERROR',
      message: 'profile consent upsert failed',
      context: { pg_code: upsertError.code },
      error: upsertError,
    });
    return errorResponse('DB_ERROR');
  }

  return Response.json({ created: !profile });
}
