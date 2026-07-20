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
      <h1 className="font-display text-[24px] font-semibold leading-[32px] tracking-tight text-primary">
        Charging sessions
      </h1>
      <p className="mt-1 text-[14px] leading-[20px] text-secondary">
        Your reported sessions — and what a better badge would save you.
      </p>

      {/* ROI card */}
      <section className="mt-6 rounded-lg border border-default bg-surface p-6 shadow-sm">
        {sessions.length > 0 && netAtUserFrequency != null && netAtUserFrequency > 0 && bestUpsell ? (
          <>
            <p className="text-[12px] font-semibold uppercase leading-[16px] tracking-wide text-tertiary">
              Monthly savings estimate
            </p>
            <p className="mt-2 text-[16px] leading-[24px] text-primary">
              You charge ~<span className="font-mono">{sessionsPerMonth}×</span>/month. With{' '}
              <strong className="font-semibold">{bestUpsell.display_name}</strong> you&apos;d save{' '}
              <strong className="font-mono font-medium">
                €{netAtUserFrequency.toFixed(2)} net/mo
              </strong>{' '}
              at your most-visited station.
            </p>
            {bestUpsell.cta_url && (
              <a
                href={bestUpsell.cta_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex h-10 items-center rounded-md bg-accent px-4 text-[14px] font-semibold leading-[20px] text-on-accent transition-colors duration-fast ease-amp hover:bg-accent-hover active:bg-accent-active"
              >
                Check out {bestUpsell.display_name} →
              </a>
            )}
          </>
        ) : (
          <>
            <p className="text-[12px] font-semibold uppercase leading-[16px] tracking-wide text-tertiary">
              Savings calculator
            </p>
            <p className="mt-2 text-[14px] leading-[20px] text-secondary">
              {sessions.length === 0 ? (
                'Log your charging sessions and we will estimate how much a different subscription would save you every month, based on where you actually charge.'
              ) : (
                <>
                  You charge ~<span className="font-mono">{sessionsPerMonth}×</span>/month. Right
                  now none of the available plans would beat your current badges at your usual
                  stations — we will let you know when that changes.
                </>
              )}
            </p>
          </>
        )}
      </section>

      {/* Sessions list */}
      <section className="mt-6">
        {isLoading && sessions.length === 0 && (
          <p className="py-8 text-center text-[14px] leading-[20px] text-tertiary">
            Loading sessions…
          </p>
        )}
        {error && sessions.length === 0 && (
          <p className="rounded-lg border border-status-danger bg-status-danger-bg p-3 text-[14px] leading-[20px] text-status-danger">
            Could not load your sessions. Please try again.
          </p>
        )}
        {!isLoading && sessions.length === 0 && !error && (
          <div className="rounded-lg border border-dashed border-strong bg-subtle p-8 text-center">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="mx-auto h-8 w-8 text-tertiary"
              aria-hidden="true"
            >
              <path d="M9 2v6M15 2v6M6 8h12v4a6 6 0 0 1-6 6 6 6 0 0 1-6-6V8z" />
              <path d="M12 18v4" />
            </svg>
            <p className="mt-2 text-[14px] font-semibold leading-[20px] text-primary">No sessions yet</p>
            <p className="mt-1 text-[14px] leading-[20px] text-secondary">
              Use &quot;Log my session&quot; on the map after you charge — every
              report makes prices sharper for everyone.
            </p>
          </div>
        )}

        {sessions.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-default">
            <table className="w-full min-w-[540px] text-left text-[14px] leading-[20px]">
              <thead className="bg-subtle text-[12px] uppercase leading-[16px] tracking-wide text-tertiary">
                <tr>
                  <th className="px-4 py-2 font-medium">Date</th>
                  <th className="px-4 py-2 font-medium">Station</th>
                  <th className="px-4 py-2 font-medium">Badge</th>
                  <th className="px-4 py-2 text-right font-medium">Cost</th>
                  <th className="px-4 py-2 text-right font-medium">kWh</th>
                  <th className="px-4 py-2 text-right font-medium">€/kWh</th>
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
                    <tr key={s.id} className="border-t border-default">
                      <td className="px-4 py-2 font-mono text-[13px] leading-[18px] text-tertiary">
                        {new Date(s.session_date).toLocaleDateString('en-GB')}
                      </td>
                      <td className="px-4 py-2 text-primary">
                        {stationNames?.get(s.station_id) ?? s.station_id}
                      </td>
                      <td className="px-4 py-2 text-secondary">
                        {planById.get(s.emsp_plan_id)?.display_name ?? s.emsp_plan_id}
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-primary">
                        {s.reported_cost_eur != null ? `€${s.reported_cost_eur.toFixed(2)}` : '—'}
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-tertiary">
                        {s.reported_kwh != null ? s.reported_kwh.toFixed(1) : '—'}
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-tertiary">
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
              className="h-10 rounded-md border border-default bg-surface px-4 text-[14px] leading-[20px] text-primary transition-colors duration-fast ease-amp hover:bg-hover disabled:opacity-50"
            >
              {isLoading ? 'Loading…' : 'Load more'}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
