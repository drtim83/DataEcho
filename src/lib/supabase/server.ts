import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Request-scoped, cookie-aware client. Queries run as the logged-in user (their
// JWT sets `role=authenticated` in Postgres), which is what lets RLS policies
// allow access without needing a service role key.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Called from a Server Component render; the proxy already refreshes
            // the session cookie on the request, so this can be safely ignored.
          }
        },
      },
    }
  );
}

// Route handlers call this first; the proxy already blocks unauthenticated /api
// requests, but each handler still needs a per-request client scoped to that user.
export async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

// Supabase's PostgrestError (and other thrown API errors) aren't `instanceof Error`,
// so a plain `error instanceof Error` check silently drops the real message.
export function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error && typeof (error as { message: unknown }).message === 'string') {
    return (error as { message: string }).message;
  }
  return fallback;
}
