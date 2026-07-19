import type { SupabaseClient } from '@supabase/supabase-js';
import * as Sentry from '@sentry/nextjs';
import { CHARGEPRICE_ID_MAP } from '@/lib/chargeprice-id-map';
import type { TouSchedule } from '@/types/database';

// Block 1.9 — nightly Chargeprice sync (spec §7.2). Called by
// app/api/cron/sync-tariffs. On any fetch error we keep existing data —
// never delete or overwrite with an empty result.

const CHARGEPRICE_API = 'https://api.chargeprice.app/v1/charge_prices';
const BATCH_SIZE = 20;

interface ChargepricePrice {
  type: 'kwh' | 'minute' | 'session';
  value: number;
}

interface ChargepriceTariff {
  provider?: { id?: string };
  tariff?: { id?: string };
  price?: ChargepricePrice | ChargepricePrice[];
  time_of_day_prices?: unknown;
}

export interface NormalizedTariff {
  emsp_plan_id: string;
  cpo_id: string;
  station_id: string;
  connector_type: null;
  max_power_kw_min: null;
  max_power_kw_max: null;
  session_fee_eur: number | null;
  per_kwh_eur: number | null;
  per_min_eur: number | null;
  tou_schedule: TouSchedule | null;
  data_source: 'chargeprice';
  confidence_score: number;
  last_verified_at: string;
}

// Chargeprice tariff object → our tariff row (spec Block 1.9 mapping).
export function normalize(
  raw: ChargepriceTariff,
  stationId: string,
  cpoId: string
): NormalizedTariff | null {
  const providerId = raw.provider?.id ?? raw.tariff?.id;
  if (!providerId) return null;
  const planId = CHARGEPRICE_ID_MAP[providerId];
  if (!planId) {
    console.warn(JSON.stringify({ level: 'warn', cron: 'sync-tariffs', message: 'unmapped chargeprice provider', provider_id: providerId }));
    return null;
  }
  const prices = Array.isArray(raw.price) ? raw.price : raw.price ? [raw.price] : [];
  const byType = (type: ChargepricePrice['type']) => prices.find((p) => p.type === type)?.value ?? null;
  return {
    emsp_plan_id: planId,
    cpo_id: cpoId,
    station_id: stationId,
    connector_type: null,
    max_power_kw_min: null,
    max_power_kw_max: null,
    session_fee_eur: byType('session'),
    per_kwh_eur: byType('kwh'),
    per_min_eur: byType('minute'),
    tou_schedule: (raw.time_of_day_prices as TouSchedule | undefined) ?? null,
    data_source: 'chargeprice',
    confidence_score: 90,
    last_verified_at: new Date().toISOString(),
  };
}

export interface SyncSummary {
  tariffs_updated: number;
  tariffs_failed: number;
  stations_attempted: number;
  duration_ms: number;
}

export async function syncTariffs(supabase: SupabaseClient): Promise<SyncSummary> {
  const started = Date.now();
  let updated = 0;
  let failed = 0;
  let attempted = 0;

  const { data: stations, error } = await supabase
    .from('stations')
    .select('id, cpo_id')
    .order('id');
  if (error || !stations) {
    throw new Error(`stations fetch failed: ${error?.message}`);
  }

  for (let i = 0; i < stations.length; i += BATCH_SIZE) {
    const batch = stations.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async (station: { id: string; cpo_id: string }) => {
        attempted += 1;
        try {
          const url = new URL(CHARGEPRICE_API);
          url.searchParams.set('station_id', station.id);
          const res = await fetch(url.toString(), {
            headers: {
              'API-Key': process.env.CHARGEPRICE_API_KEY ?? '',
              'Content-Type': 'application/json',
            },
          });
          if (!res.ok) {
            failed += 1;
            logSyncError('chargeprice_fetch', res.status, attempted);
            return;
          }
          const body = (await res.json()) as { data?: ChargepriceTariff[] };
          const rows = (body.data ?? [])
            .map((t) => normalize(t, station.id, station.cpo_id))
            .filter((r): r is NormalizedTariff => r !== null);
          if (rows.length === 0) return; // empty result: keep existing data
          const { error: upsertError } = await supabase.from('tariffs').upsert(rows, {
            onConflict: 'emsp_plan_id,cpo_id,station_id,connector_type,max_power_kw_min,max_power_kw_max',
          });
          if (upsertError) {
            failed += 1;
            logSyncError('tariff_upsert', 500, attempted, upsertError.message);
            return;
          }
          updated += rows.length;
        } catch (e) {
          failed += 1;
          Sentry.captureException(e, {
            extra: { cron: 'sync-tariffs', stage: 'chargeprice_fetch', station_id: station.id },
          });
        }
      })
    );
  }

  const summary: SyncSummary = {
    tariffs_updated: updated,
    tariffs_failed: failed,
    stations_attempted: attempted,
    duration_ms: Date.now() - started,
  };
  Sentry.addBreadcrumb({ category: 'cron', message: 'sync-tariffs complete', data: { ...summary } });
  console.log(JSON.stringify({ level: 'info', cron: 'sync-tariffs', ...summary }));
  return summary;
}

function logSyncError(stage: string, status: number, attempted: number, detail?: string): void {
  console.error(
    JSON.stringify({
      level: 'error',
      cron: 'sync-tariffs',
      stage,
      error_code: status,
      stations_attempted: attempted,
      detail,
    })
  );
}
