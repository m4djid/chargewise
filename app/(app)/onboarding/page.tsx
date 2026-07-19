import Link from 'next/link';
import BadgeSelector from '@/components/BadgeSelector';

export default function OnboardingPage() {
  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-2xl font-bold">Welcome to ChargeAdvisor 👋</h1>
      <p className="mt-2 text-slate-400">
        Two quick things and you&apos;ll never overpay at a charger again.
      </p>

      <section className="mt-6 rounded-xl border border-slate-800 bg-slate-900/50 p-5">
        <h2 className="flex items-center gap-2 font-semibold">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-xs font-bold text-slate-950">1</span>
          Why we ask for your location
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          We use your GPS position to show chargers around you and compute your
          cheapest badge at each one. Your position stays in your browser — it
          is never stored on our servers and clears when you close the tab.
        </p>
      </section>

      <section className="mt-4 rounded-xl border border-slate-800 bg-slate-900/50 p-5">
        <h2 className="flex items-center gap-2 font-semibold">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-xs font-bold text-slate-950">2</span>
          Add your first badge
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          Pick the charging subscriptions you already own so we can compare
          prices for <em>your</em> badges.
        </p>
        <div className="mt-4">
          <BadgeSelector />
        </div>
      </section>

      <div className="mt-6 text-center">
        <Link
          href="/dashboard"
          className="inline-block rounded-lg bg-emerald-500 px-6 py-3 font-semibold text-slate-950 transition hover:bg-emerald-400"
        >
          Continue to map →
        </Link>
      </div>
    </div>
  );
}
