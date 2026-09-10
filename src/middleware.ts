import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey || supabaseUrl.includes('placeholder')) {
    return supabaseResponse;
  }

  const authCookies = request.cookies.getAll().filter((cookie) => cookie.name.startsWith('sb-'));
  const authCookieSize = authCookies.reduce((total, cookie) => total + cookie.name.length + cookie.value.length, 0);
  if (authCookieSize > 12_000) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('session_reset', '1');
    const resetResponse = NextResponse.redirect(url);
    authCookies.forEach((cookie) => resetResponse.cookies.delete(cookie.name));
    return resetResponse;
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options?: any }>) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
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
    return NextResponse.redirect(url);
  }

  if (user && request.nextUrl.pathname.startsWith('/login')) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
