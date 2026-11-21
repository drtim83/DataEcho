import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebase/admin';
import {
  SESSION_COOKIE_NAME,
  ensureUserProfile,
  errorMessage,
} from '@/lib/firebase/server';

const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { idToken?: string };
    const idToken = body?.idToken;
    if (!idToken) {
      return NextResponse.json(
        { error: 'idToken is required' },
        { status: 400 }
      );
    }

    const adminAuth = getAdminAuth();
    const decoded = await adminAuth.verifyIdToken(idToken);
    const sessionCookie = await adminAuth.createSessionCookie(idToken, {
      expiresIn: FIVE_DAYS_MS,
    });

    const profile = await ensureUserProfile(getAdminDb(), {
      id: decoded.uid,
      email: decoded.email ?? null,
    });

    const response = NextResponse.json({ success: true, profile });
    response.cookies.set(SESSION_COOKIE_NAME, sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: Math.floor(FIVE_DAYS_MS / 1000),
    });
    return response;
  } catch (error) {
    console.error('POST /api/auth/session failed:', error);
    return NextResponse.json(
      { error: errorMessage(error, 'Failed to create session') },
      { status: 401 }
    );
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return response;
}
