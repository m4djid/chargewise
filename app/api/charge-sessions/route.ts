import { requireUser } from '@/lib/supabase';
import { errorResponse, logError } from '@/lib/errors';
import { chargeSessionSchema } from '@/lib/validation';

// Spec §6.5 — crowdsourced session feedback. Tariff confidence adjustment
// happens in a DB trigger, not here. Cost/kWh amounts never appear in logs
// (spec §10.3) — booleans only.

const PAGE_SIZE = 20;

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
  const parsed = chargeSessionSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse('INVALID_SESSION_DATA');
  }
  const input = parsed.data;

  if (input.recommendation_id) {
    const { data: rec, error: recError } = await supabase
      .from('recommendations')
      .select('id, user_id')
      .eq('id', input.recommendation_id)
      .maybeSingle();
    if (recError) {
      logError({
        route: '/api/charge-sessions',
        userId: user.id,
        code: 'DB_ERROR',
        message: 'recommendation ownership check failed',
        context: { pg_code: recError.code },
        error: recError,
      });
      return errorResponse('DB_ERROR');
    }
    if (rec && rec.user_id !== user.id) {
      // Spec §8.1 — JWT user_id !== resource user_id: 403 + Sentry.
      logError({
        route: '/api/charge-sessions',
        userId: user.id,
        code: 'AUTH_MISMATCH',
        message: 'recommendation_id belongs to another user',
        context: { recommendation_id: input.recommendation_id },
      });
      return errorResponse('AUTH_MISMATCH');
    }
    // Under RLS a foreign recommendation is invisible — treat "not found" as
    // invalid input rather than leaking existence.
    if (!rec) {
      return errorResponse('INVALID_SESSION_DATA');
    }
  }

  const { data: inserted, error: insertError } = await supabase
    .from('charge_sessions')
    .insert({
      user_id: user.id,
      recommendation_id: input.recommendation_id ?? null,
      station_id: input.station_id,
      emsp_plan_id: input.emsp_plan_id,
      reported_cost_eur: input.reported_cost_eur,
      reported_kwh: input.reported_kwh ?? null,
      session_date: input.session_date,
      source: 'web',
    })
    .select('id')
    .single();
  if (insertError || !inserted) {
    logError({
      route: '/api/charge-sessions',
      userId: user.id,
      code: 'DB_ERROR',
      message: 'charge session insert failed',
      context: {
        pg_code: insertError?.code,
        station_id: input.station_id,
        emsp_plan_id: input.emsp_plan_id,
        had_recommendation: Boolean(input.recommendation_id),
        has_cost: true,
        has_kwh: input.reported_kwh !== undefined,
      },
      error: insertError,
    });
    return errorResponse('DB_ERROR');
  }

  return Response.json({ session_id: inserted.id }, { status: 201 });
}

export async function GET(request: Request) {
  const auth = await requireUser();
  if ('response' in auth) return auth.response;
  const { user, supabase } = auth;

  const rawPage = Number.parseInt(new URL(request.url).searchParams.get('page') ?? '1', 10);
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? rawPage : 1;
  const from = (page - 1) * PAGE_SIZE;

  // Fetch one extra row to compute has_more without a count query.
  const { data: rows, error } = await supabase
    .from('charge_sessions')
    .select('*')
    .eq('user_id', user.id)
    .order('session_date', { ascending: false })
    .order('created_at', { ascending: false })
    .range(from, from + PAGE_SIZE);
  if (error) {
    logError({
      route: '/api/charge-sessions',
      userId: user.id,
      code: 'DB_ERROR',
      message: 'charge sessions list failed',
      context: { pg_code: error.code, page },
      error,
    });
    return errorResponse('DB_ERROR');
  }

  const all = rows ?? [];
  return Response.json({
    sessions: all.slice(0, PAGE_SIZE),
    page,
    has_more: all.length > PAGE_SIZE,
  });
}
