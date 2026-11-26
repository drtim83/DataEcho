import {
  initializeApp,
  getApps,
  getApp,
  cert,
  applicationDefault,
  type App,
  type ServiceAccount,
} from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

const globalForFirebase = globalThis as typeof globalThis & {
  __dataechoFirestoreConfigured?: boolean;
};

function parseServiceAccount(raw: string): ServiceAccount {
  const trimmed = raw.trim();
  const jsonStr = trimmed.startsWith('{')
    ? trimmed
    : Buffer.from(trimmed, 'base64').toString('utf8');
  const parsed = JSON.parse(jsonStr) as ServiceAccount & {
    private_key?: unknown;
  };
  if (typeof parsed.private_key === 'string') {
    parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
  }
  if (typeof parsed.privateKey === 'string') {
    parsed.privateKey = parsed.privateKey.replace(/\\n/g, '\n');
  }
  return parsed;
}

export function getAdminApp(): App {
  if (getApps().length > 0) {
    return getApp();
  }

  const serviceAccountEnv = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (serviceAccountEnv && serviceAccountEnv.trim()) {
    return initializeApp({
      credential: cert(parseServiceAccount(serviceAccountEnv)),
    });
  }

  const projectId =
    process.env.FIREBASE_PROJECT_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (projectId && clientEmail && privateKey) {
    return initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
    });
  }

  return initializeApp({
    credential: applicationDefault(),
    ...(projectId ? { projectId } : {}),
  });
}

export function getAdminAuth(): Auth {
  return getAuth(getAdminApp());
}

export function getAdminDb(): Firestore {
  const db = getFirestore(getAdminApp());
  if (!globalForFirebase.__dataechoFirestoreConfigured) {
    try {
      db.settings({ ignoreUndefinedProperties: true });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (!msg.includes('already been initialized')) {
        throw error;
      }
    }
    globalForFirebase.__dataechoFirestoreConfigured = true;
  }
  return db;
}
