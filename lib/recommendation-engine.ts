import type { SupabaseClient } from '@supabase/supabase-js';
import type { EmspPlan, Station, Tariff } from '@/types/database';
import { computeSessionCost, resolveTariff, round2 } from '@/lib/tariff-resolver';

// Block 1.5 (spec §6.4 + Block Detail). One exported entry point:
// computeRecommendations(supabase, userId, stationIds, sessionKwh).
// The supabase client is the *user-scoped* server client — RLS applies.

const DEFAULT_AVG_MONTHLY_SESSIONS = 8;
const MIN_UPSELL_SESSION_SAVINGS_EUR = 0.5;
const STALE_CONFIDENCE_THRESHOLD = 50;
const STALE_AGE_DAYS = 30;

export interface UpsellEntry {
  plan_id: string;
  display_name: string;
  session_savings_eur: number;
  monthly_net_savings_eur: number;
  cta_url: string | null;
}

export interface StationRecommendation {
  station_id: string;
  recommendation: {
    plan_id: string;
    display_name: string;
    estimated_total_eur: number;
    breakdown: { session_fee: number; kwh_cost: number; per_min_cost: number };
    confidence?: 'low';
    last_verified?: string | null;
  } | null;
  reason?: 'no_coverage' | 'no_badges';
  upsells: UpsellEntry[];
  recommendation_id: string | null;
}

function isStale(t: Tariff): boolean {
  if (t.confidence_score < STALE_CONFIDENCE_THRESHOLD) return true;
  if (!t.last_verified_at) return false;
  const ageMs = Date.now() - new Date(t.last_verified_at).getTime();
  return ageMs > STALE_AGE_DAYS * 24 * 3600 * 1000;
}

function upsellCta(plan: EmspPlan, emspAffiliateUrl: string | null, emspWebsiteUrl: string | null): string | null {
  const base = emspAffiliateUrl || emspWebsiteUrl;
  if (!base) return null;
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}utm_source=chargeadvisor&utm_medium=upsell`;
}

export async function computeRecommendations(
  supabase: SupabaseClient,
  userId: string,
  stationIds: string[],
  sessionKwh: number
): Promise<{ results: StationRecommendation[]; missingStationIds: string[] }> {
  const now = new Date();

  const [{ data: stations }, { data: badges }, { data: plans }, { data: emsps }] = await Promise.all([
    supabase.from('stations').select('*').in('id', stationIds),
    supabase
      .from('badges')
      .select('plan_id')
      .eq('user_id', userId)
      .eq('is_active', true)
      .is('deleted_at', null),
    supabase.from('emsp_plans').select('*').eq('is_active', true),
    supabase.from('emsps').select('id, affiliate_url, website_url').eq('is_active', true),
  ]);

  const stationRows = (stations ?? []) as Station[];
  const foundIds = new Set(stationRows.map((s) => s.id));
  const missingStationIds = stationIds.filter((id) => !foundIds.has(id));

  const ownedPlanIds = new Set((badges ?? []).map((b: { plan_id: string }) => b.plan_id));
  const allPlans = (plans ?? []) as EmspPlan[];
  const planById = new Map(allPlans.map((p) => [p.id, p]));
  const emspById = new Map(
    (emsps ?? []).map((e: { id: string; affiliate_url: string | null; website_url: string | null }) => [e.id, e])
  );

  const cpoIds = Array.from(new Set(stationRows.map((s) => s.cpo_id)));
  const { data: tariffRows } = cpoIds.length
    ? await supabase.from('tariffs').select('*').in('cpo_id', cpoIds)
    : { data: [] };
  const tariffs = (tariffRows ?? []) as Tariff[];

  const results: StationRecommendation[] = [];

  for (const station of stationRows) {
    // Cost per plan (owned and not-owned) for this station.
    const costs = new Map<string, { tariff: Tariff; total: number; perKwh: number; breakdown: { session_fee: number; kwh_cost: number; per_min_cost: number } }>();
    for (const plan of allPlans) {
      const tariff = resolveTariff(tariffs, plan.id, station, now);
      if (!tariff) continue;
      const cost = computeSessionCost(tariff, station, sessionKwh, now);
      costs.set(plan.id, { tariff, total: cost.totalEur, perKwh: cost.perKwhEur, breakdown: cost.breakdown });
    }

    const ownedCovered = Array.from(costs.entries())
      .filter(([planId]) => ownedPlanIds.has(planId))
      .sort((a, b) => a[1].total - b[1].total);

    const buildUpsells = (referenceTotal: number | null): UpsellEntry[] => {
      const entries: UpsellEntry[] = [];
      for (const [planId, cost] of Array.from(costs.entries())) {
        if (ownedPlanIds.has(planId)) continue;
        const plan = planById.get(planId);
        if (!plan) continue;
        // With no owned coverage there is no baseline: expose the plan with
        // zero savings so the client can show "plans that work here".
        const sessionSavings = referenceTotal == null ? 0 : round2(referenceTotal - cost.total);
        const monthlyGross = sessionSavings * DEFAULT_AVG_MONTHLY_SESSIONS;
        const monthlyNet = round2(monthlyGross - (plan.monthly_fee_eur ?? 0));
        if (referenceTotal != null && (monthlyNet <= 0 || sessionSavings <= MIN_UPSELL_SESSION_SAVINGS_EUR)) {
          continue;
        }
        const emsp = emspById.get(plan.emsp_id) as
          | { affiliate_url: string | null; website_url: string | null }
          | undefined;
        entries.push({
          plan_id: planId,
          display_name: plan.monthly_fee_eur
            ? `${plan.display_name} (€${plan.monthly_fee_eur.toFixed(2)}/mo)`
            : plan.display_name,
          session_savings_eur: sessionSavings,
          monthly_net_savings_eur: monthlyNet,
          cta_url: upsellCta(plan, emsp?.affiliate_url ?? null, emsp?.website_url ?? null),
        });
      }
      return entries.sort((a, b) => b.session_savings_eur - a.session_savings_eur);
    };

    if (ownedPlanIds.size === 0) {
      // NO_BADGES — upsell-only response, top 3 plans covering this CPO.
      results.push({
        station_id: station.id,
        recommendation: null,
        reason: 'no_badges',
        upsells: buildUpsells(null).slice(0, 3),
        recommendation_id: null,
      });
      continue;
    }

    if (ownedCovered.length === 0) {
      // TARIFF_NOT_FOUND — graceful no_coverage response, never an error.
      results.push({
        station_id: station.id,
        recommendation: null,
        reason: 'no_coverage',
        upsells: buildUpsells(null),
        recommendation_id: null,
      });
      continue;
    }

    const [bestPlanId, best] = ownedCovered[0];
    const bestPlan = planById.get(bestPlanId)!;
    const upsells = buildUpsells(best.total);
    const bestUpsell = upsells[0] ?? null;

    const { data: inserted } = await supabase
      .from('recommendations')
      .insert({
        user_id: userId,
        station_id: station.id,
        recommended_plan_id: bestPlanId,
        estimated_kwh_eur: best.perKwh,
        estimated_total_eur: best.total,
        session_fee_eur: best.breakdown.session_fee,
        best_upsell_plan_id: bestUpsell?.plan_id ?? null,
        upsell_savings_eur: bestUpsell?.session_savings_eur ?? null,
        source: 'web',
      })
      .select('id')
      .single();

    const stale = isStale(best.tariff);
    results.push({
      station_id: station.id,
      recommendation: {
        plan_id: bestPlanId,
        display_name: bestPlan.display_name,
        estimated_total_eur: best.total,
        breakdown: best.breakdown,
        ...(stale ? { confidence: 'low' as const, last_verified: best.tariff.last_verified_at?.slice(0, 10) ?? null } : {}),
      },
      upsells,
      recommendation_id: inserted?.id ?? null,
    });
  }

  return { results, missingStationIds };
}
