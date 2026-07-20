import type { Metadata } from 'next';
import './globals.css';
import CookieConsentBanner from '@/components/CookieConsentBanner';

export const metadata: Metadata = {
  title: 'Chargewise — the cheapest way to charge',
  description:
    'Chargewise — register your eMSP charging badges and instantly see which one gives you the cheapest rate at every EV charger near you.',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white font-sans text-stone-900 antialiased">
        {children}
        <CookieConsentBanner />
      </body>
    </html>
  );
}
