'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('dataecho_auth') !== 'true') {
      router.push('/login');
    }
  }, [router]);

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-bg-primary)' }}>
      <Sidebar />
      <main className="ml-[240px] min-h-screen">
        {children}
      </main>
    </div>
  );
}
