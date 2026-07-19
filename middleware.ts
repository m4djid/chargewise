import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { checkRateLimit } from '@/lib/ratelimit';

// Spec §6.1 (auth guard) + §5.3 (waitlist rate limiting).

const PROTECTED_PATTERNS = [
  /^\/dashboard(\/.*)?$/,
  /^\/onboarding(\/.*)?$/,
  /^\/api\/user(\/.*)?$/,
  /^\/api\/badges(\/.*)?$/,
  /^\/api\/recommendations(\/.*)?$/,
  /^\/api\/charge-sessions(\/.*)?$/,
  /^\/api\/push(\/.*)?$/,
  /^\/api\/stations(\/.*)?$/,
];

function isProtected(pathname: string): boolean {
  return PROTECTED_PATTERNS.some((p) => p.test(pathname));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Rate limit waitlist signups: 5 req/IP/min.
  if (pathname === '/api/waitlist' && request.method === 'POST') {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    const allowed = await checkRateLimit(ip);
    if (!allowed) {
      return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
    }
    return NextResponse.next();
  }

  if (!isProtected(pathname)) {
    return NextResponse.next();
  }

  // Internal cron-key routes bypass user auth (they verify their own secret).
  if (pathname.startsWith('/api/push/send')) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request: { headers: request.headers } });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value: '', ...options });
        },
      },
    }
  );

  // getUser() revalidates the JWT against Supabase — never getSession() here.
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/auth/login';
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/onboarding/:path*',
    '/api/waitlist',
    '/api/user/:path*',
    '/api/badges/:path*',
    '/api/recommendations/:path*',
    '/api/charge-sessions/:path*',
    '/api/push/:path*',
    '/api/stations/:path*',
  ],
};
