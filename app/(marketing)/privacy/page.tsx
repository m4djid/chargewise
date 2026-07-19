import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy policy — ChargeAdvisor',
  description: 'How ChargeAdvisor collects, uses and protects your data.',
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
    <div className="min-h-screen bg-slate-950 px-4 py-16 text-slate-100">
      <article className="mx-auto max-w-2xl">
        <h1 className="text-3xl font-bold">Privacy policy</h1>
        <p className="mt-2 text-sm text-slate-500">
          Version 2026-07-v1 · Effective July 2026
        </p>

        <section className="mt-10 space-y-3">
          <h2 className="text-xl font-semibold text-emerald-400">1. Who we are</h2>
          <p className="text-slate-300">
            ChargeAdvisor helps EV drivers find the cheapest charging badge at
            nearby chargers. We are committed to collecting the strict minimum
            of data required to provide the service, and to hosting everything
            within the European Union.
          </p>
        </section>

        <section className="mt-8 space-y-3">
          <h2 className="text-xl font-semibold text-emerald-400">2. Data we collect</h2>
          <ul className="list-disc space-y-2 pl-5 text-slate-300">
            <li>
              <strong>Email address</strong> — required to create your account
              (or to join the waitlist).
            </li>
            <li>
              <strong>Display name</strong> — optional, provided by you.
            </li>
            <li>
              <strong>Charging behaviour</strong> — the stations you view
              recommendations for and the session costs you choose to report.
              This data is pseudonymised: it is linked to a random account
              identifier, never to your name or email in analytics.
            </li>
          </ul>
        </section>

        <section className="mt-8 space-y-3">
          <h2 className="text-xl font-semibold text-emerald-400">3. Location data (GPS)</h2>
          <p className="text-slate-300">
            Your GPS coordinates are used solely inside your browser session to
            look up nearby charging stations. They are{' '}
            <strong>never stored</strong> in our database, never written to
            server logs, and are cleared automatically when you close the tab.
          </p>
        </section>

        <section className="mt-8 space-y-3">
          <h2 className="text-xl font-semibold text-emerald-400">4. Consent</h2>
          <p className="text-slate-300">
            When you create an account you explicitly accept our terms and this
            privacy policy (consent version <strong>2026-07-v1</strong>). We
            record the time and version of your consent. If this policy changes
            materially, we will ask you to review and re-consent before
            continuing to use the app. Analytics run only after you accept the
            analytics banner, and you can withdraw that consent at any time.
          </p>
        </section>

        <section className="mt-8 space-y-3">
          <h2 className="text-xl font-semibold text-emerald-400">5. Your rights</h2>
          <p className="text-slate-300">
            Under the GDPR you have the right to access, rectify, port and
            erase your data. You can delete your account at any time from the
            app: your profile is deactivated immediately and all associated
            data is permanently deleted within 30 days (right to erasure). You
            also have the right to lodge a complaint with the French data
            protection authority, the CNIL (
            <a
              href="https://www.cnil.fr"
              className="text-emerald-400 hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              cnil.fr
            </a>
            ).
          </p>
        </section>

        <section className="mt-8 space-y-3">
          <h2 className="text-xl font-semibold text-emerald-400">6. Data processors</h2>
          <p className="text-slate-300">
            We rely on the following processors, all bound by GDPR Data
            Processing Agreements:
          </p>
          <div className="overflow-x-auto">
            <table className="mt-2 w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-slate-400">
                  <th className="py-2 pr-4 font-medium">Processor</th>
                  <th className="py-2 pr-4 font-medium">Purpose</th>
                  <th className="py-2 font-medium">Region</th>
                </tr>
              </thead>
              <tbody>
                {PROCESSORS.map((p) => (
                  <tr key={p.name} className="border-b border-slate-800 text-slate-300">
                    <td className="py-2 pr-4">{p.name}</td>
                    <td className="py-2 pr-4">{p.purpose}</td>
                    <td className="py-2">{p.region}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-8 space-y-3">
          <h2 className="text-xl font-semibold text-emerald-400">7. Contact</h2>
          <p className="text-slate-300">
            For any privacy request (access, erasure, portability, questions):{' '}
            <a href="mailto:privacy@chargeadvisor.com" className="text-emerald-400 hover:underline">
              privacy@chargeadvisor.com
            </a>
            . We respond within 30 days.
          </p>
        </section>

        <p className="mt-12 text-sm text-slate-500">
          <Link href="/" className="text-emerald-400 hover:underline">
            ← Back to ChargeAdvisor
          </Link>
        </p>
      </article>
    </div>
  );
}
