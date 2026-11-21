import { redirect } from 'next/navigation';
import { getAdminDb } from '@/lib/firebase/admin';
import { ensureUserProfile, getSessionUser } from '@/lib/firebase/server';
import Sidebar from '@/components/layout/Sidebar';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();

  // The proxy checks cookie presence/expiry; this verifies the session cookie
  // cryptographically via Firebase Admin before rendering protected pages.
  if (!user) {
    redirect('/login?expired=1');
  }

  const profile = await ensureUserProfile(getAdminDb(), user);

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-bg-primary)' }}>
      <Sidebar userEmail={user.email ?? ''} role={profile.role ?? 'user'} />
      <main className="ml-[240px] min-h-screen page-enter">
        {children}
      </main>
    </div>
  );
}
