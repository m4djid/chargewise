import { requireUser } from '@/lib/supabase';
import { errorResponse, logError, redactUserId } from '@/lib/errors';
import { nearbyQuerySchema } from '@/lib/validation';

// Spec §6.3 — stations within radius via the nearby_stations RPC
// (earthdistance + cube). CRITICAL: lat/lng are never logged or persisted
// (spec §8.3) — logs carry only radius + result count + redacted user id.

function floorTo4(value: number): number {
  return Math.floor(value * 10000) / 10000;
}

export async function GET(request: Request) {
  const auth = await requireUser();
  if ('response' in auth) return auth.response;
  const { user, supabase } = auth;

  const sp = new URL(request.url).searchParams;
  const parsed = nearbyQuerySchema.safeParse({
    lat: sp.get('lat') ?? undefined,
    lng: sp.get('lng') ?? undefined,
    radius_km: sp.get('radius_km') ?? undefined,
    connector_types: sp.get('connector_types') ?? undefined,
  });
  if (!parsed.success) {
    return Response.json({ error: 'invalid_params' }, { status: 422 });
  }
  const { radius_km, connector_types } = parsed.data;

  const { data: stations, error } = await supabase.rpc('nearby_stations', {
    p_lat: floorTo4(parsed.data.lat),
    p_lng: floorTo4(parsed.data.lng),
    p_radius_km: radius_km,
    p_connector_types: connector_types && connector_types.length > 0 ? connector_types : null,
  });

  if (error) {
    // Context must never include coordinates.
    logError({
      route: '/api/stations/nearby',
      userId: user.id,
      code: 'DB_ERROR',
      message: 'nearby_stations RPC failed',
      context: { pg_code: error.code, radius_km },
      error,
    });
    return errorResponse('DB_ERROR');
  }

  const results = stations ?? [];
  console.log(
    JSON.stringify({
      level: 'info',
      route: '/api/stations/nearby',
      message: `nearby query: radius_km=${radius_km}, results=${results.length}, user=${redactUserId(user.id)}`,
    })
  );

  return Response.json({ stations: results });
}
