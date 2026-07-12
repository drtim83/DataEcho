import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Sidebar from '@/components/layout/Sidebar';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // The proxy already redirects unauthenticated requests before they reach here;
  // this is defense in depth in case that ever changes.
  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-bg-primary)' }}>
      <Sidebar userEmail={user.email ?? ''} role={profile?.role ?? 'user'} />
      <main className="ml-[240px] min-h-screen page-enter">
        {children}
      </main>
    </div>
  );
}
