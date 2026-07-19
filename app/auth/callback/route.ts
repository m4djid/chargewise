import { NextResponse, type NextRequest } from 'next/server';
import { getServerClient } from '@/lib/supabase';

// Spec §6.1 step 3 — OAuth code → session exchange, then redirect to the app.

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get('code');
  const nextParam = searchParams.get('next');
  const next = nextParam && nextParam.startsWith('/') ? nextParam : '/dashboard';

  if (!code) {
    return NextResponse.redirect(new URL('/auth/login?error=oauth', origin));
  }

  const supabase = getServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(new URL('/auth/login?error=oauth', origin));
  }

  return NextResponse.redirect(new URL(next, origin));
}
