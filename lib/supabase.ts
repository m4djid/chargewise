import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

// SERVER-ONLY module (imports next/headers). For client components use
// lib/supabase-browser.ts.

// Server components / route handlers. Reads the session from HTTP-only cookies.
export function getServerClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // Called from a Server Component — middleware refreshes sessions.
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options });
          } catch {
            // Same as above.
          }
        },
      },
    }
  );
}

// Service role — ONLY for cron jobs and the internal push trigger (spec §8.1).
// Never import from client components; never use in user-facing request routes.
export function getServiceRoleClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

export interface AuthedUser {
  id: string;
  email: string | undefined;
}

// Route-handler auth guard. Always getUser() (revalidates JWT) — never
// getSession() server-side (spec §6.1). Also blocks soft-deleted profiles
// (GDPR erasure step 1, spec §8.3).
export async function requireUser(): Promise<
  | { user: AuthedUser; supabase: ReturnType<typeof getServerClient>; response?: never }
  | { user?: never; supabase?: never; response: Response }
> {
  const supabase = getServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    return { response: Response.json({ error: 'unauthorized' }, { status: 401 }) };
  }
  const { data: profile } = await supabase
    .from('profiles')
    .select('deleted_at')
    .eq('id', user.id)
    .maybeSingle();
  if (profile?.deleted_at) {
    return { response: Response.json({ error: 'account_deleted' }, { status: 403 }) };
  }
  return { user: { id: user.id, email: user.email }, supabase };
}
