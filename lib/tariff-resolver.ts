import type { Station, Tariff, TouSchedule } from '@/types/database';

// Tariff resolution precedence (spec §4.2, most-specific wins):
//   station+connector+power band > station+connector > station
//   > CPO-wide+connector > CPO-wide
// Power-band matches only refine a tariff that already matched on
// station/connector/CPO; they never beat a more specific station match.

function isCurrentlyValid(t: Tariff, now: Date): boolean {
  const today = now.toISOString().slice(0, 10);
  if (t.valid_from && t.valid_from > today) return false;
  if (t.valid_to && t.valid_to < today) return false;
  return true;
}

function powerBandMatches(t: Tariff, maxPowerKw: number | null): boolean {
  if (t.max_power_kw_min == null && t.max_power_kw_max == null) return true;
  if (maxPowerKw == null) return false;
  if (t.max_power_kw_min != null && maxPowerKw < t.max_power_kw_min) return false;
  if (t.max_power_kw_max != null && maxPowerKw > t.max_power_kw_max) return false;
  return true;
}

function specificity(t: Tariff, station: Station): number {
  let score = 0;
  if (t.station_id) score += 100;
  if (t.connector_type) score += 10;
  if (t.max_power_kw_min != null || t.max_power_kw_max != null) score += 1;
  void station;
  return score;
}

export function resolveTariff(
  tariffs: Tariff[],
  planId: string,
  station: Station,
  now: Date = new Date()
): Tariff | null {
  const candidates = tariffs.filter((t) => {
    if (t.emsp_plan_id !== planId) return false;
    if (t.cpo_id !== station.cpo_id) return false;
    if (t.station_id && t.station_id !== station.id) return false;
    if (t.connector_type && !station.connector_types.includes(t.connector_type)) return false;
    if (!powerBandMatches(t, station.max_power_kw)) return false;
    if (!isCurrentlyValid(t, now)) return false;
    return true;
  });
  if (candidates.length === 0) return null;
  candidates.sort(
    (a, b) => specificity(b, station) - specificity(a, station) || b.confidence_score - a.confidence_score
  );
  return candidates[0];
}

// --- Time-of-use evaluation ---------------------------------------------

interface EffectiveRates {
  perKwhEur: number;
  perMinEur: number;
}

function minutesOfDay(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

// Returns the ISO weekday (1=Mon…7=Sun) and minutes-of-day of `now` in `timezone`.
function nowInTimezone(now: Date, timezone: string): { isoWeekday: number; minutes: number } {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = fmt.formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const weekdayMap: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
  return {
    isoWeekday: weekdayMap[get('weekday')] ?? 1,
    minutes: Number(get('hour')) % 24 * 60 + Number(get('minute')),
  };
}

// Applies the TOU schedule if present: the active period's rates override the
// base per_kwh/per_min. Periods crossing midnight (e.g. 22:00→06:00) supported.
export function effectiveRates(tariff: Tariff, now: Date = new Date()): EffectiveRates {
  const base: EffectiveRates = {
    perKwhEur: tariff.per_kwh_eur ?? 0,
    perMinEur: tariff.per_min_eur ?? 0,
  };
  const schedule = tariff.tou_schedule as TouSchedule | null;
  if (!schedule || !Array.isArray(schedule.periods) || schedule.periods.length === 0) {
    return base;
  }
  const { isoWeekday, minutes } = nowInTimezone(now, schedule.timezone || 'Europe/Paris');
  for (const period of schedule.periods) {
    const start = minutesOfDay(period.start_time);
    const end = minutesOfDay(period.end_time);
    const crossesMidnight = end <= start;
    const inWindow = crossesMidnight
      ? minutes >= start || minutes < end
      : minutes >= start && minutes < end;
    // For a window crossing midnight, the after-midnight part belongs to the
    // previous ISO day's period.
    const dayToCheck = crossesMidnight && minutes < end ? (isoWeekday === 1 ? 7 : isoWeekday - 1) : isoWeekday;
    if (inWindow && period.days.includes(dayToCheck)) {
      return {
        perKwhEur: period.per_kwh_eur ?? base.perKwhEur,
        perMinEur: period.per_min_eur ?? base.perMinEur,
      };
    }
  }
  return base;
}

export interface SessionCostBreakdown {
  session_fee: number;
  kwh_cost: number;
  per_min_cost: number;
}

export interface SessionCost {
  totalEur: number;
  perKwhEur: number;
  breakdown: SessionCostBreakdown;
}

// Cost formula per spec §6.4. Charging efficiency factor 0.85.
export function computeSessionCost(
  tariff: Tariff,
  station: Station,
  sessionKwh: number,
  now: Date = new Date()
): SessionCost {
  const rates = effectiveRates(tariff, now);
  const power = station.max_power_kw && station.max_power_kw > 0 ? station.max_power_kw : 50;
  const estimatedDurationMin = (sessionKwh / (power * 0.85)) * 60;
  const sessionFee = tariff.session_fee_eur ?? 0;
  const kwhCost = rates.perKwhEur * sessionKwh;
  const perMinCost = rates.perMinEur * estimatedDurationMin;
  let total = sessionFee + kwhCost + perMinCost;
  if (tariff.session_cap_eur != null && total > tariff.session_cap_eur) {
    total = tariff.session_cap_eur;
  }
  return {
    totalEur: round2(total),
    perKwhEur: rates.perKwhEur,
    breakdown: {
      session_fee: round2(sessionFee),
      kwh_cost: round2(kwhCost),
      per_min_cost: round2(perMinCost),
    },
  };
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
