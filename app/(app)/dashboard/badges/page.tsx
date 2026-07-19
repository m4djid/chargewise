'use client';

import { useState } from 'react';
import BadgeSelector from '@/components/BadgeSelector';
import { useBadges, useEmspCatalogue } from '@/hooks/useBadges';

export default function BadgesPage() {
  const { badges, isLoading, mutate } = useBadges();
  const { planById, emspById } = useEmspCatalogue();
  const [removingId, setRemovingId] = useState<string | null>(null);

  const remove = async (badgeId: string) => {
    setRemovingId(badgeId);
    // Optimistic removal — roll back by revalidating on failure.
    const optimistic = badges.filter((b) => b.id !== badgeId);
    await mutate(
      async () => {
        const res = await fetch(`/api/badges/${badgeId}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('delete_failed');
        return optimistic;
      },
      { optimisticData: optimistic, rollbackOnError: true, revalidate: true }
    ).catch(() => undefined);
    setRemovingId(null);
  };

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-2xl font-bold">My badges</h1>
      <p className="mt-1 text-sm text-slate-400">
        The subscriptions we compare when recommending your cheapest option.
      </p>

      <section className="mt-6">
        {isLoading && <p className="text-sm text-slate-500">Loading your badges…</p>}

        {!isLoading && badges.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/40 p-6 text-center">
            <p className="text-2xl">🪪</p>
            <p className="mt-2 font-semibold">No badges yet</p>
            <p className="mt-1 text-sm text-slate-400">
              Add your first badge below — recommendations only work when we
              know which subscriptions you own.
            </p>
          </div>
        )}

        {badges.length > 0 && (
          <ul className="space-y-2">
            {badges.map((badge) => {
              const plan = planById.get(badge.plan_id);
              const emsp = emspById.get(badge.emsp_id);
              return (
                <li
                  key={badge.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3"
                >
                  <div>
                    <p className="font-medium">{plan?.display_name ?? badge.plan_id}</p>
                    <p className="text-xs text-slate-500">
                      {emsp?.display_name ?? badge.emsp_id}
                      {' · '}
                      {plan?.monthly_fee_eur != null
                        ? `€${plan.monthly_fee_eur.toFixed(2)}/mo`
                        : 'Free'}
                      {badge.created_at &&
                        ` · added ${new Date(badge.created_at).toLocaleDateString('en-GB')}`}
                    </p>
                  </div>
                  <button
                    onClick={() => remove(badge.id)}
                    disabled={removingId === badge.id}
                    className="shrink-0 rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-400 transition hover:border-red-500/60 hover:text-red-400 disabled:opacity-50"
                  >
                    {removingId === badge.id ? 'Removing…' : 'Remove'}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mt-8 rounded-xl border border-slate-800 bg-slate-900/40 p-4">
        <h2 className="mb-3 font-semibold">Add a badge</h2>
        <BadgeSelector />
      </section>
    </div>
  );
}
