import Link from 'next/link';
import BadgeSelector from '@/components/BadgeSelector';

export default function OnboardingPage() {
  return (
    <div className="mx-auto max-w-xl">
      <h1 className="font-display text-[24px] font-semibold leading-[32px] tracking-tight text-primary">
        Welcome to Chargewise
      </h1>
      <p className="mt-2 text-[14px] leading-[20px] text-secondary">
        Two quick things and you&apos;ll never overpay at a charger again.
      </p>

      <section className="mt-6 rounded-lg border border-default bg-surface p-6 shadow-sm">
        <h2 className="flex items-center gap-2 font-display text-[16px] font-semibold leading-[24px] text-primary">
          <span className="flex h-6 w-6 items-center justify-center rounded-full border border-default bg-subtle font-mono text-[12px] font-medium leading-[16px] text-primary">
            1
          </span>
          Why we ask for your location
        </h2>
        <p className="mt-2 text-[14px] leading-[20px] text-secondary">
          We use your GPS position to show chargers around you and compute your
          cheapest badge at each one. Your position stays in your browser — it
          is never stored on our servers and clears when you close the tab.
        </p>
      </section>

      <section className="mt-4 rounded-lg border border-default bg-surface p-6 shadow-sm">
        <h2 className="flex items-center gap-2 font-display text-[16px] font-semibold leading-[24px] text-primary">
          <span className="flex h-6 w-6 items-center justify-center rounded-full border border-default bg-subtle font-mono text-[12px] font-medium leading-[16px] text-primary">
            2
          </span>
          Add your first badge
        </h2>
        <p className="mt-2 text-[14px] leading-[20px] text-secondary">
          Pick the charging subscriptions you already own so we can compare
          prices for <em>your</em> badges.
        </p>
        <div className="mt-4">
          <BadgeSelector />
        </div>
      </section>

      <div className="mt-8 text-center">
        <Link
          href="/dashboard"
          className="inline-flex h-11 items-center rounded-md bg-accent px-6 text-[14px] font-semibold leading-[20px] text-on-accent transition-colors duration-fast ease-amp hover:bg-accent-hover active:bg-accent-active"
        >
          Continue to map →
        </Link>
      </div>
    </div>
  );
}
