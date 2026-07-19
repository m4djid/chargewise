import { requireUser } from '@/lib/supabase';
import { errorResponse, logError } from '@/lib/errors';
import { badgeCreateSchema } from '@/lib/validation';
import type { Badge } from '@/types/database';

// Spec §6.7 + Block 1.2 — badge list/registration. Max 20 active badges per
// user enforced here (BADGE_LIMIT_EXCEEDED). user_id always comes from the
// JWT, never from the body (spec §8.1).

const MAX_BADGES = 20;

export async function GET() {
  const auth = await requireUser();
  if ('response' in auth) return auth.response;
  const { user, supabase } = auth;

  const { data: badges, error } = await supabase
    .from('badges')
    .select('*, emsp_plans:plan_id(display_name, monthly_fee_eur, emsp_id)')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('created_at', { ascending: true });

  if (!error) {
    return Response.json({ badges: badges ?? [] });
  }

  // FK join syntax can fail if the relationship isn't declared — fall back to
  // two queries and merge in memory.
  const { data: plainBadges, error: badgesError } = await supabase
    .from('badges')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('created_at', { ascending: true });
  if (badgesError) {
    logError({
      route: '/api/badges',
      userId: user.id,
      code: 'DB_ERROR',
      message: 'badges list failed',
      context: { pg_code: badgesError.code },
      error: badgesError,
    });
    return errorResponse('DB_ERROR');
  }

  const rows = (plainBadges ?? []) as Badge[];
  const planIds = Array.from(new Set(rows.map((b) => b.plan_id)));
  const { data: plans, error: plansError } = planIds.length
    ? await supabase
        .from('emsp_plans')
        .select('id, display_name, monthly_fee_eur, emsp_id')
        .in('id', planIds)
    : { data: [], error: null };
  if (plansError) {
    logError({
      route: '/api/badges',
      userId: user.id,
      code: 'DB_ERROR',
      message: 'badge plan lookup failed',
      context: { pg_code: plansError.code },
      error: plansError,
    });
    return errorResponse('DB_ERROR');
  }

  const planById = new Map((plans ?? []).map((p: { id: string }) => [p.id, p]));
  return Response.json({
    badges: rows.map((b) => ({ ...b, emsp_plans: planById.get(b.plan_id) ?? null })),
  });
}

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
  const parsed = badgeCreateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: 'invalid_params' }, { status: 422 });
  }
  const { emsp_id, plan_id } = parsed.data;

  // Plan must exist and belong to the given eMSP.
  const { data: plan, error: planError } = await supabase
    .from('emsp_plans')
    .select('id')
    .eq('id', plan_id)
    .eq('emsp_id', emsp_id)
    .maybeSingle();
  if (planError) {
    logError({
      route: '/api/badges',
      userId: user.id,
      code: 'DB_ERROR',
      message: 'plan validation failed',
      context: { pg_code: planError.code, emsp_id, plan_id },
      error: planError,
    });
    return errorResponse('DB_ERROR');
  }
  if (!plan) {
    return Response.json({ error: 'invalid_plan' }, { status: 422 });
  }

  // Max 20 active badges per user (spec §4.2).
  const { count, error: countError } = await supabase
    .from('badges')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('is_active', true)
    .is('deleted_at', null);
  if (countError) {
    logError({
      route: '/api/badges',
      userId: user.id,
      code: 'DB_ERROR',
      message: 'badge count failed',
      context: { pg_code: countError.code },
      error: countError,
    });
    return errorResponse('DB_ERROR');
  }
  if ((count ?? 0) >= MAX_BADGES) {
    return errorResponse('BADGE_LIMIT_EXCEEDED');
  }

  const { data: inserted, error: insertError } = await supabase
    .from('badges')
    .insert({ user_id: user.id, emsp_id, plan_id })
    .select('*')
    .single();

  if (insertError) {
    // Unique violation (user_id, emsp_id, plan_id) — reactivate the existing
    // (possibly soft-deleted) badge instead.
    if (insertError.code === '23505') {
      const { data: reactivated, error: reactivateError } = await supabase
        .from('badges')
        .update({ is_active: true, deleted_at: null })
        .eq('user_id', user.id)
        .eq('emsp_id', emsp_id)
        .eq('plan_id', plan_id)
        .select('*')
        .single();
      if (reactivateError || !reactivated) {
        logError({
          route: '/api/badges',
          userId: user.id,
          code: 'DB_ERROR',
          message: 'badge reactivation failed',
          context: { pg_code: reactivateError?.code, emsp_id, plan_id },
          error: reactivateError,
        });
        return errorResponse('DB_ERROR');
      }
      return Response.json(reactivated, { status: 201 });
    }
    logError({
      route: '/api/badges',
      userId: user.id,
      code: 'DB_ERROR',
      message: 'badge insert failed',
      context: { pg_code: insertError.code, emsp_id, plan_id },
      error: insertError,
    });
    return errorResponse('DB_ERROR');
  }

  return Response.json(inserted, { status: 201 });
}
