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
      className="rounded-md border border-stone-200 bg-white px-3 py-1.5 text-sm text-stone-700 shadow-sm transition hover:bg-stone-50"
    >
      Sign out
    </button>
  );
}
