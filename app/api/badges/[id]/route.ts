import { requireUser } from '@/lib/supabase';
import { errorResponse, logError } from '@/lib/errors';

// Spec §6.7 — soft-delete a badge. Ownership is enforced by filtering on the
// authenticated user_id (never trusted from the body, spec §8.1); RLS backs
// this up.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser();
  if ('response' in auth) return auth.response;
  const { user, supabase } = auth;

  if (!UUID_RE.test(params.id)) {
    return Response.json({ error: 'not_found' }, { status: 404 });
  }

  const { data: updated, error } = await supabase
    .from('badges')
    .update({ deleted_at: new Date().toISOString(), is_active: false })
    .eq('id', params.id)
    .eq('user_id', user.id)
    .select('id');
  if (error) {
    logError({
      route: '/api/badges/[id]',
      userId: user.id,
      code: 'DB_ERROR',
      message: 'badge soft delete failed',
      context: { pg_code: error.code, badge_id: params.id },
      error,
    });
    return errorResponse('DB_ERROR');
  }
  if (!updated || updated.length === 0) {
    return Response.json({ error: 'not_found' }, { status: 404 });
  }

  return Response.json({ deleted: true });
}
