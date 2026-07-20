import Link from 'next/link';
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
    <div className="min-h-screen bg-white text-stone-900">
      {/* Hero */}
      <section className="px-4 pb-20 pt-20 sm:pt-28">
        <div className="mx-auto max-w-2xl text-center">
          <p className="mb-5 inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-stone-50 px-3 py-1 text-xs font-medium text-stone-600">
            <span className="text-emerald-600">⚡</span>
            Chargewise
          </p>
          <h1 className="text-4xl font-bold tracking-tight text-stone-900 sm:text-6xl">
            Stop overpaying at public chargers
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-stone-600">
            Chargewise compares your charging badges in real time and tells
            you which one is cheapest at every charger near you.
          </p>
          <div className="mx-auto mt-9 max-w-lg">
            <WaitlistForm />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-y border-stone-200 bg-stone-50 px-4 py-20">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl">
            How it works
          </h2>
          <div className="mt-12 grid gap-6 sm:grid-cols-3">
            {STEPS.map((step, i) => (
              <div key={step.title} className="rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-stone-200 bg-white text-sm font-semibold text-stone-900">
                    {i + 1}
                  </span>
                  <span className="text-stone-400">{step.icon}</span>
                </div>
                <h3 className="mt-4 font-semibold text-stone-900">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-stone-600">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Social proof / pain point — honest: real numbers only, never invented */}
      <section className="px-4 py-16">
        <div className="mx-auto max-w-2xl rounded-lg border border-stone-200 bg-white px-6 py-10 text-center shadow-sm">
          {showCount ? (
            <>
              <p className="text-3xl font-bold tracking-tight text-stone-900">
                Join {count.toLocaleString('en-US')} early adopters
              </p>
              <p className="mt-2 text-stone-600">
                EV drivers already waiting to charge smarter.
              </p>
            </>
          ) : (
            <>
              <p className="text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl">
                Charging the same car can cost{' '}
                <span className="text-emerald-600">2× more</span> with the wrong badge.
              </p>
              <p className="mt-3 text-stone-600">
                We&apos;re fixing that — be among the first to try.
              </p>
            </>
          )}
        </div>
      </section>

      {/* FAQ */}
      <section className="px-4 pb-20 pt-4">
        <div className="mx-auto max-w-2xl">
          <h2 className="text-center text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl">
            Frequently asked questions
          </h2>
          <div className="mt-8 space-y-3">
            {FAQS.map((faq) => (
              <details key={faq.q} className="group rounded-lg border border-stone-200 bg-white p-5">
                <summary className="cursor-pointer list-none font-semibold text-stone-900 marker:hidden">
                  <span className="flex items-center justify-between gap-4">
                    {faq.q}
                    <span className="text-stone-400 transition group-open:rotate-45">+</span>
                  </span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-stone-600">{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-stone-200 px-4 py-10">
        <div className="mx-auto flex max-w-4xl flex-col items-center gap-3 text-center text-sm text-stone-500">
          <p>
            We only store your email to notify you at launch. Your GPS position
            is never stored. GDPR compliant, EU-hosted.
          </p>
          <p>
            <Link href="/privacy" className="text-stone-700 underline underline-offset-2 hover:text-stone-900">
              Privacy policy
            </Link>
            <span className="mx-2">·</span>© 2026 Chargewise
          </p>
        </div>
      </footer>
    </div>
  );
}
