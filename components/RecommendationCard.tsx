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
    <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <p className="text-sm text-slate-200">
          Use <strong className="text-emerald-400">{recommendation.display_name}</strong> here →{' '}
          <strong>€{recommendation.estimated_total_eur.toFixed(2)}</strong>{' '}
          <span className="text-slate-400">(~€{perKwh.toFixed(2)}/kWh)</span>
        </p>
        {recommendation.confidence === 'low' && (
          <span
            className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-400"
            title={
              recommendation.last_verified
                ? `Price last verified ${recommendation.last_verified}`
                : 'Price not verified recently'
            }
          >
            price last verified {recommendation.last_verified ?? 'a while ago'}
          </span>
        )}
      </div>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="mt-1.5 text-xs text-emerald-400/80 hover:text-emerald-300"
      >
        {expanded ? 'Hide breakdown ▴' : 'Show breakdown ▾'}
      </button>
      {expanded && (
        <ul className="mt-2 space-y-0.5 text-xs text-slate-400">
          <li className="flex justify-between">
            <span>Session fee</span>
            <span>€{recommendation.breakdown.session_fee.toFixed(2)}</span>
          </li>
          <li className="flex justify-between">
            <span>Energy ({sessionKwh} kWh)</span>
            <span>€{recommendation.breakdown.kwh_cost.toFixed(2)}</span>
          </li>
          <li className="flex justify-between">
            <span>Time</span>
            <span>€{recommendation.breakdown.per_min_cost.toFixed(2)}</span>
          </li>
        </ul>
      )}
    </div>
  );
}
