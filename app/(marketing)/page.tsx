import Link from 'next/link';
import WaitlistForm from '@/components/WaitlistForm';

// Live waitlist count is fetched at request time (spec §5.2).
export const dynamic = 'force-dynamic';

// The waitlist table is service-role-only for SELECT (spec §8.2), so this
// read-only aggregate count is the one deliberate, documented exemption from
// the "service role only in cron/push routes" rule: it never touches user
// requests' data, never writes, and falls back to static copy without the key.
async function getWaitlistCount(): Promise<string> {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return '500+';
    const { createClient } = await import('@supabase/supabase-js');
    const client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { count, error } = await client
      .from('waitlist')
      .select('*', { count: 'exact', head: true });
    if (error || count == null) return '500+';
    return count.toLocaleString('en-US');
  } catch {
    return '500+';
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
    a: 'Yes. ChargeAdvisor is free for drivers. We plan to earn referral fees when we help you find a better subscription — never by selling your data.',
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

export default async function LandingPage() {
  const count = await getWaitlistCount();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Hero */}
      <section className="relative overflow-hidden px-4 pb-16 pt-20 sm:pt-28">
        <div className="pointer-events-none absolute -top-40 left-1/2 h-96 w-[40rem] -translate-x-1/2 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="relative mx-auto max-w-2xl text-center">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            ChargeAdvisor
          </p>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Stop overpaying at <span className="text-emerald-400">public chargers</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-slate-400">
            ChargeAdvisor compares your charging badges in real time and tells
            you which one is cheapest at every charger near you.
          </p>
          <div className="mx-auto mt-8 max-w-lg">
            <WaitlistForm />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="px-4 py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center text-2xl font-bold sm:text-3xl">How it works</h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            {STEPS.map((step, i) => (
              <div key={step.title} className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
                <div className="flex items-center gap-3 text-emerald-400">
                  {step.icon}
                  <span className="text-sm font-semibold text-slate-500">Step {i + 1}</span>
                </div>
                <h3 className="mt-4 font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm text-slate-400">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Social proof */}
      <section className="px-4 py-12">
        <div className="mx-auto max-w-2xl rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-6 py-10 text-center">
          <p className="text-3xl font-bold text-emerald-400">Join {count} early adopters</p>
          <p className="mt-2 text-slate-400">
            EV drivers already waiting to charge smarter.
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="px-4 py-16">
        <div className="mx-auto max-w-2xl">
          <h2 className="text-center text-2xl font-bold sm:text-3xl">Frequently asked questions</h2>
          <div className="mt-8 space-y-4">
            {FAQS.map((faq) => (
              <details key={faq.q} className="group rounded-xl border border-slate-800 bg-slate-900/50 p-5">
                <summary className="cursor-pointer list-none font-semibold marker:hidden">
                  <span className="flex items-center justify-between gap-4">
                    {faq.q}
                    <span className="text-emerald-400 transition group-open:rotate-45">+</span>
                  </span>
                </summary>
                <p className="mt-3 text-sm text-slate-400">{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800 px-4 py-10">
        <div className="mx-auto flex max-w-4xl flex-col items-center gap-3 text-center text-sm text-slate-500">
          <p>
            We only store your email to notify you at launch. Your GPS position
            is never stored. GDPR compliant, EU-hosted.
          </p>
          <p>
            <Link href="/privacy" className="text-emerald-400 hover:underline">
              Privacy policy
            </Link>
            <span className="mx-2">·</span>© 2026 ChargeAdvisor
          </p>
        </div>
      </footer>
    </div>
  );
}
