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
      className={`group rounded-lg border bg-surface p-4 shadow-sm transition-colors duration-fast ease-amp ${
        highlighted ? 'border-accent ring-1 ring-accent' : 'border-default'
      }`}
    >
      <header className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[14px] font-semibold leading-[20px] text-primary">
            {station.display_name}
          </h3>
          <p className="mt-1 text-[12px] leading-[16px] text-tertiary">
            {station.cpo_id}
            {station.city ? ` · ${station.city}` : ''}
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-default bg-subtle px-2 py-1 font-mono text-[12px] font-medium leading-[16px] text-secondary">
          {station.distance_km.toFixed(1)} km
        </span>
      </header>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {station.connector_types.map((c) => (
          <span key={c} className="rounded-sm bg-subtle px-1.5 py-0.5 text-[12px] leading-[16px] text-tertiary">
            {c}
          </span>
        ))}
        {station.max_power_kw != null && (
          <span className="rounded-sm bg-subtle px-1.5 py-0.5 font-mono text-[12px] font-medium leading-[16px] text-secondary">
            {station.max_power_kw} kW
          </span>
        )}
      </div>

      <div className="mt-3">
        {rec ? (
          rec.recommendation ? (
            <RecommendationCard recommendation={rec.recommendation} sessionKwh={sessionKwh} />
          ) : rec.reason === 'no_badges' ? (
            <p className="rounded-lg border border-default bg-subtle p-3 text-[14px] leading-[20px] text-secondary">
              Add a badge to see your price.{' '}
              <Link
                href="/dashboard/badges"
                className="rounded-sm font-medium text-accent-text underline underline-offset-2 transition-colors duration-fast ease-amp hover:text-accent-hover"
              >
                Add badges →
              </Link>
            </p>
          ) : (
            <p className="rounded-lg border border-default bg-subtle p-3 text-[14px] leading-[20px] text-secondary">
              None of your badges covers this network.
            </p>
          )
        ) : (
          <p className="text-[14px] leading-[20px] text-tertiary">Checking prices…</p>
        )}
      </div>

      {rec && rec.upsells.length > 0 && (
        <div className="mt-3">
          <p className="text-[12px] font-medium uppercase leading-[16px] tracking-wide text-tertiary">
            {rec.recommendation ? 'Could be cheaper with' : 'Plans that work here'}
          </p>
          <ul className="mt-2 space-y-2">
            {rec.upsells.slice(0, 3).map((u) => (
              <li
                key={u.plan_id}
                className="flex items-center justify-between gap-3 rounded-lg border border-default bg-subtle px-3 py-2 text-[14px] leading-[20px]"
              >
                <span className="text-secondary">
                  <strong className="font-semibold text-primary">{u.display_name}</strong>
                  {u.session_savings_eur > 0 && (
                    <>
                      : save <span className="font-mono">€{u.session_savings_eur.toFixed(2)}</span>
                      /session →{' '}
                      <span className="font-mono font-medium text-primary">
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
                    className="flex h-8 shrink-0 items-center rounded-md border border-default bg-surface px-3 text-[12px] font-semibold leading-[16px] text-primary transition-colors duration-fast ease-amp hover:bg-hover"
                  >
                    Get it →
                  </a>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Hover-revealed secondary card action (Ampere principle 3): appears on
          card hover/focus for pointer devices, always visible on touch. */}
      <button
        onClick={() =>
          onLogSession({
            station_id: station.id,
            recommendation_id: rec?.recommendation_id ?? null,
            emsp_plan_id: rec?.recommendation?.plan_id,
          })
        }
        className="amp-hover-reveal mt-3 h-11 w-full rounded-md border border-default bg-surface text-[14px] font-medium leading-[20px] text-secondary opacity-0 transition-[opacity,color,background-color] duration-fast ease-amp hover:bg-hover hover:text-primary focus-visible:opacity-100 group-focus-within:opacity-100 group-hover:opacity-100 sm:h-10"
      >
        I charged here
      </button>
    </article>
  );
}
