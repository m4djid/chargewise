import Link from 'next/link';
import { redirect } from 'next/navigation';
import ConsentGate from '@/components/ConsentGate';
import SignOutButton from '@/components/SignOutButton';
import ThemeToggle from '@/components/ThemeToggle';
import { getServerClient } from '@/lib/supabase';

// Server-side auth guard for the whole authenticated app (spec §11.1).
// Always getUser() — never getSession() server-side (spec §6.1).
export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = getServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) redirect('/auth/login');

  // Soft-deleted accounts are locked out immediately (GDPR erasure step 1).
  const { data: profile } = await supabase
    .from('profiles')
    .select('deleted_at')
    .eq('id', user.id)
    .maybeSingle();
  if (profile?.deleted_at) {
    await supabase.auth.signOut();
    redirect('/auth/login?error=account_deleted');
  }

  const tabs = [
    {
      href: '/dashboard',
      label: 'Map',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
          <path d="M12 21s-7-5.5-7-11a7 7 0 1 1 14 0c0 5.5-7 11-7 11z" />
          <circle cx="12" cy="10" r="2.5" />
        </svg>
      ),
    },
    {
      href: '/dashboard/badges',
      label: 'My badges',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="M3 10h18" />
        </svg>
      ),
    },
    {
      href: '/dashboard/sessions',
      label: 'Sessions',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-page text-primary">
      <header className="sticky top-0 z-[1100] border-b border-default bg-page">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <Link
            href="/dashboard"
            className="flex h-8 items-center gap-2 rounded-md font-display text-[16px] font-semibold leading-[24px] text-primary"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5 text-accent" aria-hidden="true">
              <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z" />
            </svg>
            Chargewise
          </Link>
          {/* Desktop nav — mobile uses the bottom tab bar instead */}
          <nav className="hidden items-center gap-1 md:flex">
            {tabs.map((t) => (
              <Link
                key={t.href}
                href={t.href}
                className="flex h-8 items-center rounded-md px-3 text-[14px] leading-[20px] text-secondary transition-colors duration-fast ease-amp hover:bg-hover hover:text-primary"
              >
                {t.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <SignOutButton />
          </div>
        </div>
      </header>

      {/* padding-bottom clears the fixed mobile tab bar */}
      <main className="mx-auto max-w-5xl px-4 pb-24 pt-4 md:pb-10">{children}</main>

      {/* Blocks OAuth-first users until GDPR consent is recorded (spec §8.3) */}
      <ConsentGate />

      {/* Mobile bottom tab bar. z above Leaflet panes (which go up to ~1000). */}
      <nav className="fixed inset-x-0 bottom-0 z-[1100] border-t border-default bg-page md:hidden">
        <div className="grid grid-cols-3">
          {tabs.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className="flex min-h-[44px] flex-col items-center justify-center gap-1 py-2 text-[12px] leading-[16px] text-tertiary transition-colors duration-fast ease-amp hover:text-primary"
            >
              {t.icon}
              {t.label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
