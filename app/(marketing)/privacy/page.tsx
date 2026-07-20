import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy policy — Chargewise',
  description: 'How Chargewise collects, uses and protects your data.',
};

const PROCESSORS = [
  { name: 'Supabase', purpose: 'Database and authentication', region: 'EU (Frankfurt)' },
  { name: 'Vercel', purpose: 'Application hosting', region: 'EU' },
  { name: 'PostHog', purpose: 'Product analytics (consent-gated)', region: 'EU cloud' },
  { name: 'Sentry', purpose: 'Error monitoring', region: 'EU' },
  { name: 'Upstash', purpose: 'API rate limiting', region: 'EU' },
  { name: 'Resend', purpose: 'Transactional email', region: 'EU region' },
];

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white px-4 py-16 text-stone-900">
      <article className="mx-auto max-w-2xl">
        <h1 className="text-3xl font-bold tracking-tight text-stone-900">Privacy policy</h1>
        <p className="mt-2 text-sm text-stone-500">
          Version 2026-07-v1 · Effective July 2026
        </p>

        <section className="mt-10 space-y-3">
          <h2 className="text-xl font-semibold text-stone-900">1. Who we are</h2>
          <p className="leading-relaxed text-stone-600">
            Chargewise helps EV drivers find the cheapest charging badge at
            nearby chargers. We are committed to collecting the strict minimum
            of data required to provide the service, and to hosting everything
            within the European Union.
          </p>
        </section>

        <section className="mt-8 space-y-3">
          <h2 className="text-xl font-semibold text-stone-900">2. Data we collect</h2>
          <ul className="list-disc space-y-2 pl-5 leading-relaxed text-stone-600">
            <li>
              <strong className="text-stone-900">Email address</strong> — required to create your account
              (or to join the waitlist).
            </li>
            <li>
              <strong className="text-stone-900">Display name</strong> — optional, provided by you.
            </li>
            <li>
              <strong className="text-stone-900">Charging behaviour</strong> — the stations you view
              recommendations for and the session costs you choose to report.
              This data is pseudonymised: it is linked to a random account
              identifier, never to your name or email in analytics.
            </li>
          </ul>
        </section>

        <section className="mt-8 space-y-3">
          <h2 className="text-xl font-semibold text-stone-900">3. Location data (GPS)</h2>
          <p className="leading-relaxed text-stone-600">
            Your GPS coordinates are used solely inside your browser session to
            look up nearby charging stations. They are{' '}
            <strong className="text-stone-900">never stored</strong> in our database, never written to
            server logs, and are cleared automatically when you close the tab.
          </p>
        </section>

        <section className="mt-8 space-y-3">
          <h2 className="text-xl font-semibold text-stone-900">4. Consent</h2>
          <p className="leading-relaxed text-stone-600">
            When you create an account you explicitly accept our terms and this
            privacy policy (consent version <strong className="text-stone-900">2026-07-v1</strong>). We
            record the time and version of your consent. If this policy changes
            materially, we will ask you to review and re-consent before
            continuing to use the app. Analytics run only after you accept the
            analytics banner, and you can withdraw that consent at any time.
          </p>
        </section>

        <section className="mt-8 space-y-3">
          <h2 className="text-xl font-semibold text-stone-900">5. Your rights</h2>
          <p className="leading-relaxed text-stone-600">
            Under the GDPR you have the right to access, rectify, port and
            erase your data. You can delete your account at any time from the
            app: your profile is deactivated immediately and all associated
            data is permanently deleted within 30 days (right to erasure). You
            also have the right to lodge a complaint with the French data
            protection authority, the CNIL (
            <a
              href="https://www.cnil.fr"
              className="text-stone-900 underline underline-offset-2 hover:text-stone-600"
              target="_blank"
              rel="noopener noreferrer"
            >
              cnil.fr
            </a>
            ).
          </p>
        </section>

        <section className="mt-8 space-y-3">
          <h2 className="text-xl font-semibold text-stone-900">6. Data processors</h2>
          <p className="leading-relaxed text-stone-600">
            We rely on the following processors, all bound by GDPR Data
            Processing Agreements:
          </p>
          <div className="overflow-x-auto rounded-lg border border-stone-200">
            <table className="mt-0 w-full text-left text-sm">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50 text-stone-500">
                  <th className="px-3 py-2 font-medium">Processor</th>
                  <th className="px-3 py-2 font-medium">Purpose</th>
                  <th className="px-3 py-2 font-medium">Region</th>
                </tr>
              </thead>
              <tbody>
                {PROCESSORS.map((p) => (
                  <tr key={p.name} className="border-b border-stone-200 text-stone-600 last:border-b-0">
                    <td className="px-3 py-2 font-medium text-stone-900">{p.name}</td>
                    <td className="px-3 py-2">{p.purpose}</td>
                    <td className="px-3 py-2">{p.region}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-8 space-y-3">
          <h2 className="text-xl font-semibold text-stone-900">7. Contact</h2>
          <p className="leading-relaxed text-stone-600">
            For any privacy request (access, erasure, portability, questions):{' '}
            <a
              href="mailto:privacy@chargewise.app"
              className="text-stone-900 underline underline-offset-2 hover:text-stone-600"
            >
              privacy@chargewise.app
            </a>
            . We respond within 30 days.
          </p>
        </section>

        <p className="mt-12 text-sm text-stone-500">
          <Link href="/" className="text-stone-700 underline underline-offset-2 hover:text-stone-900">
            ← Back to Chargewise
          </Link>
        </p>
      </article>
    </div>
  );
}
