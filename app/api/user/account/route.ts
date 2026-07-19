import { requireUser } from '@/lib/supabase';
import { errorResponse, logError } from '@/lib/errors';

// Spec §8.3 — GDPR right to erasure, step 1: soft delete. The weekly pg_cron
// job (migration 0004) hard-deletes 30 days later. Middleware + requireUser()
// block soft-deleted profiles from logging back in.

export async function DELETE() {
  const auth = await requireUser();
  if ('response' in auth) return auth.response;
  const { user, supabase } = auth;

  const { error } = await supabase
    .from('profiles')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', user.id);
  if (error) {
    logError({
      route: '/api/user/account',
      userId: user.id,
      code: 'DB_ERROR',
      message: 'account soft delete failed',
      context: { pg_code: error.code },
      error,
    });
    return errorResponse('DB_ERROR');
  }

  await supabase.auth.signOut();
  return Response.json({ deleted: true });
}
