import { requireUser } from '@/lib/supabase';
import { errorResponse, logError } from '@/lib/errors';

// Spec §6.7 — single station + tariff summary. Tariffs are those covering the
// station's CPO (CPO-wide rows have station_id NULL, station-specific rows
// match the id) and currently valid, with minimal plan info joined.

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser();
  if ('response' in auth) return auth.response;
  const { user, supabase } = auth;

  // OCPI ids like 'FR*CM*E12345' may arrive percent-encoded in the path.
  let stationId = params.id;
  try {
    stationId = decodeURIComponent(params.id);
  } catch {
    // keep raw segment
  }

  const { data: station, error: stationError } = await supabase
    .from('stations')
    .select('*')
    .eq('id', stationId)
    .maybeSingle();
  if (stationError) {
    logError({
      route: '/api/stations/[id]',
      userId: user.id,
      code: 'DB_ERROR',
      message: 'station fetch failed',
      context: { pg_code: stationError.code, station_id: stationId },
      error: stationError,
    });
    return errorResponse('DB_ERROR');
  }
  if (!station) {
    return errorResponse('STATION_NOT_FOUND');
  }

  const today = new Date().toISOString().slice(0, 10);
  const { data: tariffs, error: tariffsError } = await supabase
    .from('tariffs')
    .select('*, emsp_plans:emsp_plan_id(display_name, monthly_fee_eur, emsp_id)')
    .eq('cpo_id', station.cpo_id)
    .or(`station_id.is.null,station_id.eq."${stationId}"`)
    .or(`valid_from.is.null,valid_from.lte.${today}`)
    .or(`valid_to.is.null,valid_to.gte.${today}`);
  if (tariffsError) {
    logError({
      route: '/api/stations/[id]',
      userId: user.id,
      code: 'DB_ERROR',
      message: 'tariff summary fetch failed',
      context: { pg_code: tariffsError.code, station_id: stationId, cpo_id: station.cpo_id },
      error: tariffsError,
    });
    return errorResponse('DB_ERROR');
  }

  return Response.json({ station, tariffs: tariffs ?? [] });
}
