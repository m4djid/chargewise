import type { Metadata } from 'next';
import './globals.css';
import CookieConsentBanner from '@/components/CookieConsentBanner';

export const metadata: Metadata = {
  title: 'ChargeAdvisor — the cheapest way to charge',
  description:
    'Register your eMSP charging badges and instantly see which one gives you the cheapest rate at every EV charger near you.',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 font-sans text-slate-100 antialiased">
        {children}
        <CookieConsentBanner />
      </body>
    </html>
  );
}
