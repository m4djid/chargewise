import { requireUser } from '@/lib/supabase';
import { errorResponse, logError } from '@/lib/errors';
import { recommendationsSchema } from '@/lib/validation';
import { computeRecommendations } from '@/lib/recommendation-engine';

// Spec §6.4 — compute + log recommendations. All business logic lives in
// lib/recommendation-engine.ts; this handler only validates and shapes errors.

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
  const parsed = recommendationsSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: 'invalid_params' }, { status: 422 });
  }
  const { station_ids, session_kwh } = parsed.data;

  try {
    const { results, missingStationIds } = await computeRecommendations(
      supabase,
      user.id,
      station_ids,
      session_kwh
    );
    if (missingStationIds.length === station_ids.length) {
      return errorResponse('STATION_NOT_FOUND');
    }
    return Response.json({ results });
  } catch (error) {
    logError({
      route: '/api/recommendations',
      userId: user.id,
      code: 'DB_ERROR',
      message: 'recommendation computation failed',
      context: { station_count: station_ids.length, session_kwh },
      error,
    });
    return errorResponse('DB_ERROR');
  }
}
