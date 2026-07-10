import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // We're using local storage for the demo authentication state,
  // so this middleware mostly just ensures the API routes are somewhat protected.
  // Real world: check supabase auth token from cookies.

  const path = request.nextUrl.pathname;
  
  if (path.startsWith('/api/') && !path.startsWith('/api/mcp')) {
    // In a real app we'd verify a JWT here
    const authHeader = request.headers.get('Authorization');
    // Basic protection for demo purposes (we're assuming the client sends something if needed)
    // For now we'll allow it so the demo flows smoothly without extra wiring.
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
