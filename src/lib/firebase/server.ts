import { cookies } from 'next/headers';
import type { Firestore } from 'firebase-admin/firestore';
import { getAdminAuth, getAdminDb } from './admin';

export const SESSION_COOKIE_NAME = '__session';

export interface AppUser {
  id: string;
  email: string | null;
}

export interface UserProfile {
  id: string;
  email: string;
  role: 'admin' | 'user';
  created_at: string;
}

const EXPECTED_SESSION_ERRORS = new Set([
  'auth/session-cookie-expired',
  'auth/session-cookie-revoked',
  'auth/invalid-session-cookie',
  'auth/argument-error',
  'auth/user-disabled',
  'auth/user-not-found',
]);

export async function ensureUserProfile(
  db: Firestore,
  user: AppUser
): Promise<UserProfile> {
  const ref = db.collection('profiles').doc(user.id);
  const initialAdminEmail = (
    process.env.INITIAL_ADMIN_EMAIL || 'admin@dataecho.com'
  ).toLowerCase();
  const isBootstrapAdminEmail =
    Boolean(user.email) && user.email!.toLowerCase() === initialAdminEmail;

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists) {
      const data = snap.data() as Omit<UserProfile, 'id'>;
      return { id: snap.id, ...data };
    }

    let role: 'admin' | 'user' = isBootstrapAdminEmail ? 'admin' : 'user';
    if (role === 'user') {
      const existingProfiles = await tx.get(db.collection('profiles').limit(1));
      if (existingProfiles.empty) {
        role = 'admin';
      }
    }

    const profileData: Omit<UserProfile, 'id'> = {
      email: user.email ?? '',
      role,
      created_at: new Date().toISOString(),
    };

    tx.set(ref, profileData);
    return { id: user.id, ...profileData };
  });
}

export async function getSessionUser(): Promise<AppUser | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionCookie) return null;

  try {
    const decoded = await getAdminAuth().verifySessionCookie(
      sessionCookie,
      true
    );
    return {
      id: decoded.uid,
      email: decoded.email ?? null,
    };
  } catch (err) {
    const code =
      typeof err === 'object' && err !== null && 'code' in err
        ? String((err as { code?: unknown }).code)
        : '';
    if (!EXPECTED_SESSION_ERRORS.has(code)) {
      console.error('[DataEcho] getSessionUser failed:', err);
    }
    return null;
  }
}

export async function requireUser(): Promise<{
  db: Firestore;
  user: AppUser | null;
}> {
  const user = await getSessionUser();
  if (!user) {
    return { db: null as unknown as Firestore, user: null };
  }
  return { db: getAdminDb(), user };
}

export async function requireAdmin(): Promise<{
  db: Firestore;
  user: AppUser | null;
  admin: boolean;
}> {
  const { db, user } = await requireUser();
  if (!user) return { db, user: null, admin: false };

  const profile = await ensureUserProfile(db, user);
  return { db, user, admin: profile.role === 'admin' };
}

export function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) return error.message;
  if (
    error &&
    typeof error === 'object' &&
    'message' in error &&
    typeof (error as { message: unknown }).message === 'string'
  ) {
    return (error as { message: string }).message;
  }
  return fallback;
}
