import { type NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

// Supabase SSR middleware:
// - Refreshes the auth session cookie on every request (keeps sessions alive)
// - Redirects unauthenticated users away from protected pages
// - Redirects authenticated users away from the login page (no loops)
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return response;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  // IMPORTANT: do not add logic between createServerClient and getUser()
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Unauthenticated users: dashboard/admin requires sign in, root goes to landing
  if (!user && (pathname.startsWith('/admin') || pathname === '/')) {
    const url = request.nextUrl.clone();
    url.pathname = pathname === '/' ? '/landing' : '/login';
    url.search = '';
    return NextResponse.redirect(url);
  }

  // Authenticated users: send them to the dashboard instead of the login page
  if (user && pathname === '/login') {
    const url = request.nextUrl.clone();
    url.pathname = '/admin';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ['/', '/admin/:path*', '/login', '/auth/:path*'],
};
