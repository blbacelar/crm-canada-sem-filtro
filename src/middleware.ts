import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const AUTH_COOKIE_BUDGET_BYTES = 8_000;
const TOTAL_COOKIE_BUDGET_BYTES = 20_000;

function projectCookiePrefix(supabaseUrl: string) {
  try {
    const projectRef = new URL(supabaseUrl).hostname.split('.')[0];
    return projectRef ? `sb-${projectRef}-auth-token` : null;
  } catch {
    return null;
  }
}

function deleteCookies(response: NextResponse, cookieNames: string[]) {
  cookieNames.forEach((name) => response.cookies.delete(name));
  return response;
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey || supabaseUrl.includes('placeholder')) {
    return supabaseResponse;
  }

  const authCookies = request.cookies.getAll().filter((cookie) => cookie.name.startsWith('sb-'));
  const activeCookiePrefix = projectCookiePrefix(supabaseUrl);
  const staleAuthCookies = activeCookiePrefix
    ? authCookies.filter((cookie) => !cookie.name.startsWith(activeCookiePrefix))
    : [];
  const staleCookieNames = [...new Set(staleAuthCookies.map((cookie) => cookie.name))];
  staleCookieNames.forEach((name) => request.cookies.delete(name));

  const authCookieSize = authCookies.reduce((total, cookie) => total + cookie.name.length + cookie.value.length, 0);
  const totalCookieSize = new TextEncoder().encode(request.headers.get('cookie') || '').length;
  if (authCookieSize > AUTH_COOKIE_BUDGET_BYTES || totalCookieSize > TOTAL_COOKIE_BUDGET_BYTES) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('session_reset', '1');
    const resetResponse = NextResponse.redirect(url);
    return deleteCookies(resetResponse, [...new Set(authCookies.map((cookie) => cookie.name))]);
  }

  supabaseResponse = deleteCookies(NextResponse.next({ request }), staleCookieNames);

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options?: any }>) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = deleteCookies(NextResponse.next({ request }), staleCookieNames);
        cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options));
      },
    },
  });

  const userResult = await Promise.race([
    supabase.auth.getUser(),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000)),
  ]);
  const { data: { user } = { user: null } } = userResult || {};
  const { data: profile } = user
    ? await supabase.from('profiles').select('status').eq('id', user.id).maybeSingle()
    : { data: null };

  // API routes must return their own JSON 401/403 responses. Redirecting an
  // API request to /login makes fetch follow the redirect and receive HTML
  // with status 200, hiding the authentication failure from the client.
  const isPublicRoute = request.nextUrl.pathname.startsWith('/login')
    || request.nextUrl.pathname.startsWith('/api/');
  const isPendingUser = user?.app_metadata?.status === 'pending' || profile?.status === 'pending';

  if ((!user || isPendingUser) && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return deleteCookies(NextResponse.redirect(url), staleCookieNames);
  }

  if (user && request.nextUrl.pathname.startsWith('/login')) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    return deleteCookies(NextResponse.redirect(url), staleCookieNames);
  }

  return supabaseResponse;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
