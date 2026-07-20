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
    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <p className="text-sm text-stone-700">
          Use <strong className="text-emerald-700">{recommendation.display_name}</strong> here →{' '}
          <strong className="text-stone-900">€{recommendation.estimated_total_eur.toFixed(2)}</strong>{' '}
          <span className="text-stone-500">(~€{perKwh.toFixed(2)}/kWh)</span>
        </p>
        {recommendation.confidence === 'low' && (
          <span
            className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700"
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
        className="mt-1.5 text-xs text-emerald-700 hover:text-emerald-800"
      >
        {expanded ? 'Hide breakdown ▴' : 'Show breakdown ▾'}
      </button>
      {expanded && (
        <ul className="mt-2 space-y-0.5 text-xs text-stone-600">
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
