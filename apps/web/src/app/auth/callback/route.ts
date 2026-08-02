import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/server-auth';

// GET /auth/callback - Handle Supabase OAuth / email link callbacks
// Exchanges the PKCE `code` for a session and redirects to the requested page.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/admin';

  if (code) {
    try {
      const supabase = await createServerClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        return NextResponse.redirect(`${origin}${next}`);
      }
      console.error('Auth callback: code exchange failed', error?.message);
    } catch (err) {
      console.error('Auth callback: unexpected error', err);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
