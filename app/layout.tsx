import type { Metadata } from 'next';
import { Inter, Poppins, Roboto_Mono } from 'next/font/google';
import './globals.css';
import CookieConsentBanner from '@/components/CookieConsentBanner';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const poppins = Poppins({
  weight: ['500', '600'],
  subsets: ['latin'],
  variable: '--font-poppins',
});
const robotoMono = Roboto_Mono({
  weight: ['400', '500'],
  subsets: ['latin'],
  variable: '--font-roboto-mono',
});

export const metadata: Metadata = {
  title: 'Chargewise — the cheapest way to charge',
  description:
    'Chargewise — register your eMSP charging badges and instantly see which one gives you the cheapest rate at every EV charger near you.',
};

// Applies the persisted Ampere theme before first paint (light is default).
const themeBootScript =
  "try{var t=localStorage.getItem('amp-theme');document.documentElement.dataset.theme=t==='dark'?'dark':'light'}catch(e){}";

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${poppins.variable} ${robotoMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body className="min-h-screen bg-page font-sans text-primary antialiased">
        {children}
        <CookieConsentBanner />
      </body>
    </html>
  );
}
