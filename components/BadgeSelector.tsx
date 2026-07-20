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
        className="h-10 w-full rounded-md border border-default bg-surface px-3 text-[14px] leading-[20px] text-primary outline-none transition-shadow duration-fast ease-amp placeholder:text-tertiary focus-visible:shadow-focus"
      />
      {error && <p className="mt-2 text-[13px] leading-[18px] text-status-danger">{error}</p>}

      <div className="mt-3 max-h-96 space-y-4 overflow-y-auto pr-1">
        {isLoading && <p className="text-[14px] leading-[20px] text-tertiary">Loading plans…</p>}
        {!isLoading && grouped.length === 0 && (
          <p className="text-[14px] leading-[20px] text-tertiary">No plans match your search.</p>
        )}
        {grouped.map(({ emsp, plans: emspPlans }) => (
          <div key={emsp.id}>
            <p className="text-[12px] font-semibold uppercase leading-[16px] tracking-wide text-tertiary">
              {emsp.display_name}
            </p>
            <ul className="mt-2 space-y-2">
              {emspPlans.map((plan) => (
                <li
                  key={plan.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-default bg-surface px-3 py-2"
                >
                  <div>
                    <p className="text-[14px] font-medium leading-[20px] text-primary">
                      {plan.display_name}
                    </p>
                    <p className="text-[12px] leading-[16px] text-tertiary">
                      {plan.monthly_fee_eur != null ? (
                        <span className="font-mono">€{plan.monthly_fee_eur.toFixed(2)}/mo</span>
                      ) : (
                        'Free'
                      )}
                    </p>
                  </div>
                  <button
                    onClick={() => add(plan)}
                    disabled={addingId === plan.id || justAdded.has(plan.id)}
                    className="h-8 shrink-0 rounded-md bg-accent px-3 text-[12px] font-semibold leading-[16px] text-on-accent transition-colors duration-fast ease-amp hover:bg-accent-hover active:bg-accent-active disabled:opacity-50"
                  >
                    {justAdded.has(plan.id) ? 'Added' : addingId === plan.id ? 'Adding…' : 'Add'}
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
