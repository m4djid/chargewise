'use client';

import { useRouter } from 'next/navigation';
import { getBrowserClient } from '@/lib/supabase-browser';

export default function SignOutButton() {
  const router = useRouter();
  const signOut = async () => {
    await getBrowserClient().auth.signOut();
    router.push('/');
    router.refresh();
  };
  return (
    <button
      onClick={signOut}
      className="rounded-md border border-slate-700 px-3 py-1.5 text-sm text-slate-300 transition hover:bg-slate-800"
    >
      Sign out
    </button>
  );
}
