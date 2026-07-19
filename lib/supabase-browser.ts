'use client';

import { createBrowserClient } from '@supabase/ssr';

// Browser-side Supabase factory. Kept separate from lib/supabase.ts because
// that module imports next/headers, which cannot be bundled into client code.
export function getBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
