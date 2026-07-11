'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (localStorage.getItem('dataecho_auth') === 'true') {
        setAuthorized(true);
      } else {
        router.push('/login');
      }
    }
  }, [router]);

  // Don't render anything until we verify auth — prevents flash of content
  if (!authorized) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--color-bg-primary)' }}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold animate-pulse-subtle"
            style={{ background: 'linear-gradient(135deg, var(--color-accent-blue), var(--color-accent-teal))' }}>
            D
          </div>
          <div className="w-32 h-1 rounded-full overflow-hidden" style={{ background: 'var(--color-bg-elevated)' }}>
            <div className="h-full rounded-full animate-shimmer" style={{ width: '60%', background: 'linear-gradient(90deg, var(--color-accent-blue), var(--color-accent-teal))' }}></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-bg-primary)' }}>
      <Sidebar />
      <main className="ml-[240px] min-h-screen page-enter">
        {children}
      </main>
    </div>
  );
}
