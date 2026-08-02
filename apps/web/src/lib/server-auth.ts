import { createServerClient as createSupabaseServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { db } from './server-db';
import { tenantMembers, profiles } from '@project-atlas/database';
import { eq } from 'drizzle-orm';

// Supabase server client for Route Handlers
export const createServerClient = async () => {
  const cookieStore = await cookies();
  
  return createSupabaseServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch (error) {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  );
};

// Get authenticated user from request
export async function getAuthenticatedUser() {
  try {
    const supabase = await createServerClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error || !user) {
      console.warn('Auth: no authenticated user', error?.message);
      return null;
    }

    return user;
  } catch (error) {
    console.error('Auth error:', error);
    return null;
  }
}

// Get company context for authenticated user
export async function getCompanyContext() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return null;
  }

  try {
    // Get user's tenant membership using Drizzle
    const [member] = await db
      .select({
        companyId: tenantMembers.companyId,
        role: tenantMembers.role,
      })
      .from(tenantMembers)
      .where(eq(tenantMembers.userId, user.id))
      .limit(1);

    if (!member) {
      return null;
    }

    // Get user profile for name
    const [profile] = await db
      .select({
        firstName: profiles.firstName,
        lastName: profiles.lastName,
        email: profiles.email,
      })
      .from(profiles)
      .where(eq(profiles.id, user.id))
      .limit(1);

    const context = {
      userId: user.id,
      companyId: member.companyId,
      role: member.role,
      userName: profile ? `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || profile.email : user.email,
      userEmail: user.email,
    };

    return context;
  } catch (error) {
    console.error('Company context error:', error);
    return null;
  }
}

// Require authentication for Route Handlers
export async function requireAuth() {
  const context = await getCompanyContext();
  if (!context) {
    throw new Error('Unauthorized');
  }
  return context;
}