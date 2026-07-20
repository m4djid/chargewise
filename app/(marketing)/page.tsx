import Link from 'next/link';
import ThemeToggle from '@/components/ThemeToggle';
import WaitlistForm from '@/components/WaitlistForm';

// Live waitlist count is fetched at request time (spec §5.2).
export const dynamic = 'force-dynamic';

// The waitlist table is service-role-only for SELECT (spec §8.2), so this
// read-only aggregate count is the one deliberate, documented exemption from
// the "service role only in cron/push routes" rule: it never touches user
// requests' data, never writes, and falls back to no number without the key.
// Honesty rule: we never invent traction — if the real count is unavailable
// or too small to be meaningful, we show no number at all.
async function getWaitlistCount(): Promise<number | null> {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return null;
    const { createClient } = await import('@supabase/supabase-js');
    const client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { count, error } = await client
      .from('waitlist')
      .select('*', { count: 'exact', head: true });
    if (error || count == null) return null;
    return count;
  } catch {
    return null;
  }
}

const STEPS = [
  {
    title: 'Register your badges',
    body: 'Tell us which charging subscriptions you already own — Chargemap Pass, Plugsurfing, IONITY+ and 40+ more.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-7 w-7">
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M3 10h18" />
      </svg>
    ),
  },
  {
    title: 'Share your location',
    body: 'Grant GPS access in your browser. Your position never leaves your device session — we never store it.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-7 w-7">
        <path d="M12 21s-7-5.5-7-11a7 7 0 1 1 14 0c0 5.5-7 11-7 11z" />
        <circle cx="12" cy="10" r="2.5" />
      </svg>
    ),
  },
  {
    title: 'See the cheapest badge per charger',
    body: 'Every nearby charger shows the badge that costs you least — plus what you would save with a better plan.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-7 w-7">
        <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z" />
      </svg>
    ),
  },
];

const FAQS = [
  {
    q: 'Which networks are covered?',
    a: 'We cover the major French and European charging networks — IONITY, TotalEnergies Charge, Fastned, Electra, Freshmile, Engie Vianeo, Recharge and more — across 10+ eMSP badges at launch, with new tariffs added weekly.',
  },
  {
    q: 'Is it free?',
    a: 'Yes. Chargewise is free for drivers. We plan to earn referral fees when we help you find a better subscription — never by selling your data.',
  },
  {
    q: 'How accurate are prices?',
    a: 'Tariffs come from official operator price lists and are continuously cross-checked against real session costs reported by the community. Prices we could not verify recently are clearly flagged.',
  },
  {
    q: 'When does the app launch?',
    a: 'The web app launches in summer 2026, starting in France. Waitlist members get access first, in signup order.',
  },
];

// Only show the waitlist count when it is real and meaningful.
const MIN_COUNT_TO_SHOW = 25;

export default async function LandingPage() {
  const count = await getWaitlistCount();
  const showCount = count != null && count >= MIN_COUNT_TO_SHOW;

  return (
    <div className="min-h-screen bg-page text-primary">
      {/* Hero */}
      <section className="px-4 pb-24 pt-20 sm:pt-28">
        <div className="mx-auto max-w-2xl text-center">
          <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-default bg-subtle px-3 py-1 text-[12px] font-medium leading-[16px] text-secondary">
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5 text-accent" aria-hidden="true">
              <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z" />
            </svg>
            Chargewise
          </p>
          <h1 className="font-display text-[32px] font-semibold leading-[40px] tracking-tight text-primary sm:text-[48px] sm:leading-[56px]">
            Stop overpaying at public chargers
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-[16px] leading-[24px] text-secondary">
            Chargewise compares your charging badges in real time and tells
            you which one is cheapest at every charger near you.
          </p>
          <div className="mx-auto mt-10 max-w-lg">
            <WaitlistForm />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-y border-default bg-subtle px-4 py-24">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center font-display text-[24px] font-semibold leading-[32px] tracking-tight text-primary">
            How it works
          </h2>
          <div className="mt-12 grid gap-6 sm:grid-cols-3">
            {STEPS.map((step, i) => (
              <div key={step.title} className="rounded-lg border border-default bg-surface p-6 shadow-sm">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-default bg-surface font-mono text-[14px] font-medium leading-[20px] text-primary">
                    {i + 1}
                  </span>
                  <span className="text-tertiary">{step.icon}</span>
                </div>
                <h3 className="mt-4 font-display text-[16px] font-semibold leading-[24px] text-primary">{step.title}</h3>
                <p className="mt-2 text-[14px] leading-[20px] text-secondary">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Social proof / pain point — honest: real numbers only, never invented */}
      <section className="px-4 py-16">
        <div className="mx-auto max-w-2xl rounded-lg border border-default bg-surface px-6 py-10 text-center shadow-sm">
          {showCount ? (
            <>
              <p className="font-display text-[24px] font-semibold leading-[32px] tracking-tight text-primary">
                Join <span className="font-mono">{count.toLocaleString('en-US')}</span> early adopters
              </p>
              <p className="mt-2 text-[14px] leading-[20px] text-secondary">
                EV drivers already waiting to charge smarter.
              </p>
            </>
          ) : (
            <>
              <p className="font-display text-[20px] font-semibold leading-[28px] tracking-tight text-primary sm:text-[24px] sm:leading-[32px]">
                Charging the same car can cost{' '}
                <span className="font-mono">2×</span> more with the wrong badge.
              </p>
              <p className="mt-3 text-[14px] leading-[20px] text-secondary">
                We&apos;re fixing that — be among the first to try.
              </p>
            </>
          )}
        </div>
      </section>

      {/* FAQ */}
      <section className="px-4 pb-24 pt-4">
        <div className="mx-auto max-w-2xl">
          <h2 className="text-center font-display text-[24px] font-semibold leading-[32px] tracking-tight text-primary">
            Frequently asked questions
          </h2>
          <div className="mt-8 space-y-3">
            {FAQS.map((faq) => (
              <details key={faq.q} className="group rounded-lg border border-default bg-surface p-5">
                <summary className="cursor-pointer list-none rounded-sm text-[14px] font-semibold leading-[20px] text-primary marker:hidden">
                  <span className="flex items-center justify-between gap-4">
                    {faq.q}
                    <span className="text-tertiary transition-transform duration-fast ease-amp group-open:rotate-45">+</span>
                  </span>
                </summary>
                <p className="mt-3 text-[14px] leading-[20px] text-secondary">{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-default px-4 py-10">
        <div className="mx-auto flex max-w-4xl flex-col items-center gap-3 text-center text-[13px] leading-[18px] text-tertiary">
          <ThemeToggle />
          <p>
            We only store your email to notify you at launch. Your GPS position
            is never stored. GDPR compliant, EU-hosted.
          </p>
          <p>
            <Link
              href="/privacy"
              className="rounded-sm text-accent-text underline underline-offset-2 transition-colors duration-fast ease-amp hover:text-accent-hover"
            >
              Privacy policy
            </Link>
            <span className="mx-2">·</span>© <span className="font-mono">2026</span> Chargewise
          </p>
        </div>
      </footer>
    </div>
  );
}
