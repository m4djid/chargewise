'use client';

import { useMemo, useState } from 'react';
import { useSWRConfig } from 'swr';
import { useEmspCatalogue } from '@/hooks/useBadges';
import type { EmspPlan } from '@/types/database';

interface BadgeSelectorProps {
  onAdded?: () => void;
}

export default function BadgeSelector({ onAdded }: BadgeSelectorProps) {
  const { emsps, plans, emspById, isLoading } = useEmspCatalogue();
  const { mutate } = useSWRConfig();
  const [search, setSearch] = useState('');
  const [addingId, setAddingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [justAdded, setJustAdded] = useState<Set<string>>(new Set());

  const grouped = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = plans.filter((p) => {
      if (!q) return true;
      const emspName = emspById.get(p.emsp_id)?.display_name ?? p.emsp_id;
      return (
        p.display_name.toLowerCase().includes(q) || emspName.toLowerCase().includes(q)
      );
    });
    const byEmsp = new Map<string, EmspPlan[]>();
    for (const plan of filtered) {
      const list = byEmsp.get(plan.emsp_id) ?? [];
      list.push(plan);
      byEmsp.set(plan.emsp_id, list);
    }
    // Preserve eMSP display order from the catalogue query.
    return emsps
      .filter((e) => byEmsp.has(e.id))
      .map((e) => ({ emsp: e, plans: byEmsp.get(e.id)! }));
  }, [plans, emsps, emspById, search]);

  const add = async (plan: EmspPlan) => {
    setError(null);
    setAddingId(plan.id);
    try {
      const res = await fetch('/api/badges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emsp_id: plan.emsp_id, plan_id: plan.id }),
      });
      if (res.ok) {
        setJustAdded((prev) => new Set(prev).add(plan.id));
        void mutate('/api/badges');
        onAdded?.();
        return;
      }
      const body = await res.json().catch(() => ({}) as Record<string, unknown>);
      const code = typeof body.error === 'string' ? body.error : '';
      if (code === 'BADGE_LIMIT_EXCEEDED') {
        setError('You have reached the 20 badge limit.');
      } else if (res.status === 409 || /duplicate|exists/i.test(code)) {
        setError('You already added this badge.');
      } else {
        setError('Could not add this badge. Please try again.');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setAddingId(null);
    }
  };

  return (
    <div>
      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search eMSP or plan (e.g. Chargemap, IONITY+)…"
        aria-label="Search plans"
        className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-900 placeholder-stone-400 shadow-sm outline-none focus:border-stone-500 focus:ring-1 focus:ring-stone-500"
      />
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <div className="mt-3 max-h-96 space-y-4 overflow-y-auto pr-1">
        {isLoading && <p className="text-sm text-stone-500">Loading plans…</p>}
        {!isLoading && grouped.length === 0 && (
          <p className="text-sm text-stone-500">No plans match your search.</p>
        )}
        {grouped.map(({ emsp, plans: emspPlans }) => (
          <div key={emsp.id}>
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
              {emsp.display_name}
            </p>
            <ul className="mt-1.5 space-y-1.5">
              {emspPlans.map((plan) => (
                <li
                  key={plan.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-stone-200 bg-white px-3 py-2"
                >
                  <div className="text-sm">
                    <p className="font-medium text-stone-900">{plan.display_name}</p>
                    <p className="text-xs text-stone-500">
                      {plan.monthly_fee_eur != null
                        ? `€${plan.monthly_fee_eur.toFixed(2)}/mo`
                        : 'Free'}
                    </p>
                  </div>
                  <button
                    onClick={() => add(plan)}
                    disabled={addingId === plan.id || justAdded.has(plan.id)}
                    className="shrink-0 rounded-md bg-stone-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-stone-700 disabled:opacity-50"
                  >
                    {justAdded.has(plan.id) ? 'Added ✓' : addingId === plan.id ? 'Adding…' : 'Add'}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
