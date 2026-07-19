'use client';

import { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import { useEmspCatalogue } from '@/hooks/useBadges';
import { fetcher } from '@/lib/fetcher';
import { getBrowserClient } from '@/lib/supabase-browser';
import type { StationRecommendation } from '@/lib/recommendation-engine';
import type { ChargeSession } from '@/types/database';

const round2 = (n: number) => Math.round(n * 100) / 100;

interface SessionsResponse {
  sessions: ChargeSession[];
  page: number;
  has_more: boolean;
}

export default function SessionsPage() {
  const { planById } = useEmspCatalogue();
  const [page, setPage] = useState(1);
  const { data, error, isLoading } = useSWR<SessionsResponse>(
    `/api/charge-sessions?page=${page}`,
    fetcher,
    { revalidateOnFocus: false }
  );

  // Accumulate loaded pages so the savings calculator aggregates everything
  // fetched so far (Block 1.10 works "client-side over loaded sessions").
  const [pages, setPages] = useState<Record<number, ChargeSession[]>>({});
  useEffect(() => {
    if (data?.sessions) {
      const p = data.page ?? page;
      setPages((prev) => ({ ...prev, [p]: data.sessions }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const sessions = useMemo(
    () =>
      Object.keys(pages)
        .map(Number)
        .sort((a, b) => a - b)
        .flatMap((p) => pages[p]),
    [pages]
  );

  // Station display names — stations are readable by authenticated users,
  // so join names client-side instead of depending on the API's row shape.
  const stationIdsKey = Array.from(new Set(sessions.map((s) => s.station_id))).sort().join('|');
  const { data: stationNames } = useSWR(
    stationIdsKey ? `stations:${stationIdsKey}` : null,
    async () => {
      const supabase = getBrowserClient();
      const { data: rows } = await supabase
        .from('stations')
        .select('id, display_name')
        .in('id', stationIdsKey.split('|'));
      return new Map((rows ?? []).map((r: { id: string; display_name: string }) => [r.id, r.display_name]));
    },
    { revalidateOnFocus: false }
  );

  // ---- Block 1.10 monthly savings calculator ------------------------------
  // Sessions/month estimate: loaded sessions spread over the distinct months
  // they cover (at least 1 month so a brand-new user doesn't divide by zero).
  const distinctMonths = new Set(sessions.map((s) => s.session_date.slice(0, 7))).size || 1;
  const sessionsPerMonth = Math.max(1, Math.round(sessions.length / distinctMonths));

  // Most-frequented station (mode of station_id over loaded sessions).
  const topStationId = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of sessions) counts.set(s.station_id, (counts.get(s.station_id) ?? 0) + 1);
    let best: string | null = null;
    let bestCount = 0;
    counts.forEach((count, id) => {
      if (count > bestCount) {
        best = id;
        bestCount = count;
      }
    });
    return best as string | null;
  }, [sessions]);

  // Get the best upsell at that station (one recommendations call).
  const { data: roiData } = useSWR(
    topStationId ? `roi:${topStationId}` : null,
    async () => {
      const res = await fetch('/api/recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ station_ids: [topStationId], session_kwh: 30 }),
      });
      if (!res.ok) throw new Error('roi_failed');
      return (await res.json()) as { results: StationRecommendation[] };
    },
    { revalidateOnFocus: false }
  );

  const bestUpsell = roiData?.results?.[0]?.upsells?.[0] ?? null;
  // The engine computes monthly_net at its default 8 sessions/month:
  //   net8 = savings * 8 - monthly_fee  →  monthly_fee = savings * 8 - net8
  // So net at the user's actual frequency N is:
  //   netN = savings * N - monthly_fee = savings * (N - 8) + net8
  const netAtUserFrequency =
    bestUpsell && bestUpsell.session_savings_eur > 0
      ? round2(
          bestUpsell.session_savings_eur * (sessionsPerMonth - 8) +
            bestUpsell.monthly_net_savings_eur
        )
      : null;
  // --------------------------------------------------------------------------

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold">Charging sessions</h1>
      <p className="mt-1 text-sm text-slate-400">
        Your reported sessions — and what a better badge would save you.
      </p>

      {/* ROI card */}
      <section className="mt-5 rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-5">
        {sessions.length > 0 && netAtUserFrequency != null && netAtUserFrequency > 0 && bestUpsell ? (
          <>
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-400">
              Monthly savings estimate
            </p>
            <p className="mt-2 text-lg">
              You charge ~{sessionsPerMonth}×/month. With{' '}
              <strong>{bestUpsell.display_name}</strong> you&apos;d save{' '}
              <strong className="text-emerald-400">€{netAtUserFrequency.toFixed(2)} net/mo</strong>{' '}
              at your most-visited station.
            </p>
            {bestUpsell.cta_url && (
              <a
                href={bestUpsell.cta_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-block rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400"
              >
                Check out {bestUpsell.display_name} →
              </a>
            )}
          </>
        ) : (
          <>
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-400">
              Savings calculator
            </p>
            <p className="mt-2 text-sm text-slate-300">
              {sessions.length === 0
                ? 'Log your charging sessions and we will estimate how much a different subscription would save you every month, based on where you actually charge.'
                : `You charge ~${sessionsPerMonth}×/month. Right now none of the available plans would beat your current badges at your usual stations — we will let you know when that changes.`}
            </p>
          </>
        )}
      </section>

      {/* Sessions list */}
      <section className="mt-6">
        {isLoading && sessions.length === 0 && (
          <p className="py-8 text-center text-sm text-slate-500">Loading sessions…</p>
        )}
        {error && sessions.length === 0 && (
          <p className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
            Could not load your sessions. Please try again.
          </p>
        )}
        {!isLoading && sessions.length === 0 && !error && (
          <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/40 p-8 text-center">
            <p className="text-2xl">🔌</p>
            <p className="mt-2 font-semibold">No sessions yet</p>
            <p className="mt-1 text-sm text-slate-400">
              Use &quot;Log my session&quot; on the map after you charge — every
              report makes prices sharper for everyone.
            </p>
          </div>
        )}

        {sessions.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full min-w-[540px] text-left text-sm">
              <thead className="bg-slate-900 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Date</th>
                  <th className="px-4 py-2.5 font-medium">Station</th>
                  <th className="px-4 py-2.5 font-medium">Badge</th>
                  <th className="px-4 py-2.5 text-right font-medium">Cost</th>
                  <th className="px-4 py-2.5 text-right font-medium">kWh</th>
                  <th className="px-4 py-2.5 text-right font-medium">€/kWh</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => {
                  const perKwh =
                    s.computed_kwh_cost ??
                    (s.reported_cost_eur && s.reported_kwh
                      ? s.reported_cost_eur / s.reported_kwh
                      : null);
                  return (
                    <tr key={s.id} className="border-t border-slate-800/70">
                      <td className="px-4 py-2.5 text-slate-400">
                        {new Date(s.session_date).toLocaleDateString('en-GB')}
                      </td>
                      <td className="px-4 py-2.5">{stationNames?.get(s.station_id) ?? s.station_id}</td>
                      <td className="px-4 py-2.5 text-slate-300">
                        {planById.get(s.emsp_plan_id)?.display_name ?? s.emsp_plan_id}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {s.reported_cost_eur != null ? `€${s.reported_cost_eur.toFixed(2)}` : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right text-slate-400">
                        {s.reported_kwh != null ? s.reported_kwh.toFixed(1) : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right text-slate-400">
                        {perKwh != null ? `€${perKwh.toFixed(2)}` : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {data?.has_more && (
          <div className="mt-4 text-center">
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={isLoading}
              className="rounded-lg border border-slate-700 px-5 py-2 text-sm text-slate-300 transition hover:border-emerald-500/60 hover:text-emerald-400 disabled:opacity-50"
            >
              {isLoading ? 'Loading…' : 'Load more'}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
