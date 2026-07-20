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
      <h1 className="font-display text-[24px] font-semibold leading-[32px] tracking-tight text-primary">
        My badges
      </h1>
      <p className="mt-1 text-[14px] leading-[20px] text-secondary">
        The subscriptions we compare when recommending your cheapest option.
      </p>

      <section className="mt-6">
        {isLoading && (
          <p className="text-[14px] leading-[20px] text-tertiary">Loading your badges…</p>
        )}

        {!isLoading && badges.length === 0 && (
          <div className="rounded-lg border border-dashed border-strong bg-subtle p-6 text-center">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="mx-auto h-8 w-8 text-tertiary"
              aria-hidden="true"
            >
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <path d="M3 10h18" />
            </svg>
            <p className="mt-2 text-[14px] font-semibold leading-[20px] text-primary">No badges yet</p>
            <p className="mt-1 text-[14px] leading-[20px] text-secondary">
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
                  className="group flex items-center justify-between gap-3 rounded-lg border border-default bg-surface px-4 py-3 shadow-sm"
                >
                  <div>
                    <p className="text-[14px] font-medium leading-[20px] text-primary">
                      {plan?.display_name ?? badge.plan_id}
                    </p>
                    <p className="text-[12px] leading-[16px] text-tertiary">
                      {emsp?.display_name ?? badge.emsp_id}
                      {' · '}
                      {plan?.monthly_fee_eur != null ? (
                        <span className="font-mono">€{plan.monthly_fee_eur.toFixed(2)}/mo</span>
                      ) : (
                        'Free'
                      )}
                      {badge.created_at && (
                        <>
                          {' · added '}
                          <span className="font-mono">
                            {new Date(badge.created_at).toLocaleDateString('en-GB')}
                          </span>
                        </>
                      )}
                    </p>
                  </div>
                  {/* Hover-revealed destructive row action (Ampere principle 3):
                      hidden until row hover/focus on pointer devices, always
                      visible on touch via .amp-hover-reveal. */}
                  <button
                    onClick={() => remove(badge.id)}
                    disabled={removingId === badge.id}
                    className={`amp-hover-reveal h-8 shrink-0 rounded-md border border-default px-3 text-[12px] leading-[16px] text-secondary transition-[opacity,color,border-color] duration-fast ease-amp hover:border-status-danger hover:text-status-danger focus-visible:opacity-100 group-focus-within:opacity-100 group-hover:opacity-100 disabled:opacity-50 ${
                      removingId === badge.id ? 'opacity-50' : 'opacity-0'
                    }`}
                  >
                    {removingId === badge.id ? 'Removing…' : 'Remove'}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mt-8 rounded-lg border border-default bg-surface p-4 shadow-sm">
        <h2 className="mb-3 font-display text-[16px] font-semibold leading-[24px] text-primary">
          Add a badge
        </h2>
        <BadgeSelector />
      </section>
    </div>
  );
}
