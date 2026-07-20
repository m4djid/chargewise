'use client';

import { useState } from 'react';
import type { StationRecommendation } from '@/lib/recommendation-engine';

type Rec = NonNullable<StationRecommendation['recommendation']>;

// Presentational recommendation block (headline + expandable breakdown),
// used inside StationCard and exported separately for reuse.
export default function RecommendationCard({
  recommendation,
  sessionKwh,
}: {
  recommendation: Rec;
  sessionKwh: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const perKwh = recommendation.estimated_total_eur / sessionKwh;

  return (
    <div className="rounded-lg bg-accent-subtle p-3">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <p className="text-[14px] leading-[20px] text-secondary">
          Use <strong className="font-semibold text-accent-text">{recommendation.display_name}</strong>{' '}
          here →{' '}
          <strong className="font-mono font-medium text-primary">
            €{recommendation.estimated_total_eur.toFixed(2)}
          </strong>{' '}
          <span className="font-mono text-[13px] leading-[18px] text-tertiary">
            (~€{perKwh.toFixed(2)}/kWh)
          </span>
        </p>
        {recommendation.confidence === 'low' && (
          // Low confidence is a data-freshness note, not an availability status,
          // so it stays neutral (amber is reserved for "in use").
          <span
            className="inline-flex items-center gap-1 text-[12px] leading-[16px] text-tertiary"
            title={
              recommendation.last_verified
                ? `Price last verified ${recommendation.last_verified}`
                : 'Price not verified recently'
            }
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="h-3.5 w-3.5 shrink-0"
              aria-hidden="true"
            >
              <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
              <path d="M12 9v4M12 17h.01" />
            </svg>
            price last verified {recommendation.last_verified ?? 'a while ago'}
          </span>
        )}
      </div>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="mt-2 rounded-sm text-[12px] leading-[16px] text-accent-text transition-colors duration-fast ease-amp hover:text-accent-hover"
      >
        {expanded ? 'Hide breakdown' : 'Show breakdown'}
      </button>
      {expanded && (
        <ul className="mt-2 space-y-1 text-[12px] leading-[16px] text-secondary">
          <li className="flex justify-between">
            <span>Session fee</span>
            <span className="font-mono">€{recommendation.breakdown.session_fee.toFixed(2)}</span>
          </li>
          <li className="flex justify-between">
            <span>
              Energy (<span className="font-mono">{sessionKwh}</span> kWh)
            </span>
            <span className="font-mono">€{recommendation.breakdown.kwh_cost.toFixed(2)}</span>
          </li>
          <li className="flex justify-between">
            <span>Time</span>
            <span className="font-mono">€{recommendation.breakdown.per_min_cost.toFixed(2)}</span>
          </li>
        </ul>
      )}
    </div>
  );
}
