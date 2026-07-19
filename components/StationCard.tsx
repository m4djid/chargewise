'use client';

import Link from 'next/link';
import RecommendationCard from '@/components/RecommendationCard';
import { capture } from '@/lib/posthog';
import type { StationRecommendation } from '@/lib/recommendation-engine';
import type { StationWithDistance } from '@/types/database';

export interface LogSessionPrefill {
  station_id: string;
  recommendation_id?: string | null;
  emsp_plan_id?: string;
}

interface StationCardProps {
  station: StationWithDistance;
  rec?: StationRecommendation;
  sessionKwh: number;
  highlighted?: boolean;
  onLogSession: (prefill: LogSessionPrefill) => void;
}

export default function StationCard({
  station,
  rec,
  sessionKwh,
  highlighted,
  onLogSession,
}: StationCardProps) {
  return (
    <article
      id={`station-${station.id}`}
      className={`rounded-xl border bg-slate-900/60 p-4 transition ${
        highlighted ? 'border-emerald-500 ring-1 ring-emerald-500' : 'border-slate-800'
      }`}
    >
      <header className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold leading-tight">{station.display_name}</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            {station.cpo_id}
            {station.city ? ` · ${station.city}` : ''}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-300">
          {station.distance_km.toFixed(1)} km
        </span>
      </header>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {station.connector_types.map((c) => (
          <span key={c} className="rounded bg-slate-800 px-1.5 py-0.5 text-[11px] text-slate-400">
            {c}
          </span>
        ))}
        {station.max_power_kw != null && (
          <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[11px] font-medium text-emerald-400">
            {station.max_power_kw} kW
          </span>
        )}
      </div>

      <div className="mt-3">
        {rec ? (
          rec.recommendation ? (
            <RecommendationCard recommendation={rec.recommendation} sessionKwh={sessionKwh} />
          ) : rec.reason === 'no_badges' ? (
            <p className="rounded-lg border border-slate-700 bg-slate-800/50 p-3 text-sm text-slate-300">
              Add a badge to see your price.{' '}
              <Link href="/dashboard/badges" className="font-medium text-emerald-400 hover:underline">
                Add badges →
              </Link>
            </p>
          ) : (
            <p className="rounded-lg border border-slate-700 bg-slate-800/50 p-3 text-sm text-slate-300">
              None of your badges covers this network.
            </p>
          )
        ) : (
          <p className="text-sm text-slate-500">Checking prices…</p>
        )}
      </div>

      {rec && rec.upsells.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            {rec.recommendation ? 'Could be cheaper with' : 'Plans that work here'}
          </p>
          <ul className="mt-1.5 space-y-1.5">
            {rec.upsells.slice(0, 3).map((u) => (
              <li
                key={u.plan_id}
                className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm"
              >
                <span className="text-slate-300">
                  <strong>{u.display_name}</strong>
                  {u.session_savings_eur > 0 && (
                    <>
                      : save €{u.session_savings_eur.toFixed(2)}/session →{' '}
                      <span className="text-emerald-400">
                        net €{u.monthly_net_savings_eur.toFixed(2)}/mo
                      </span>
                    </>
                  )}
                </span>
                {u.cta_url && (
                  <a
                    href={u.cta_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => capture('upsell_clicked', { plan_id: u.plan_id })}
                    className="shrink-0 rounded-md border border-emerald-500/50 px-2.5 py-1 text-xs font-semibold text-emerald-400 transition hover:bg-emerald-500/10"
                  >
                    Get it →
                  </a>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <button
        onClick={() =>
          onLogSession({
            station_id: station.id,
            recommendation_id: rec?.recommendation_id ?? null,
            emsp_plan_id: rec?.recommendation?.plan_id,
          })
        }
        className="mt-3 w-full rounded-lg border border-slate-700 py-2 text-sm font-medium text-slate-300 transition hover:border-emerald-500/50 hover:text-emerald-400"
      >
        I charged here
      </button>
    </article>
  );
}
