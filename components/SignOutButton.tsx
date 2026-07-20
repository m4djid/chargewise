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
      className="h-8 rounded-md border border-default bg-surface px-3 text-[14px] leading-[20px] text-primary transition-colors duration-fast ease-amp hover:bg-hover"
    >
      Sign out
    </button>
  );
}
