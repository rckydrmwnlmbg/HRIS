'use client';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useApp } from '@/lib/context';
import Sidebar from '@/components/layout/Sidebar';
import MobileHeader from '@/components/layout/MobileHeader';
import Breadcrumb from '@/components/layout/Breadcrumb';
import styles from './layout.module.css';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isLoggedIn, isInit, settings } = useApp();
  const router = useRouter();
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setIsSidebarOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (isInit && !isLoggedIn) {
      router.replace('/login');
    }
  }, [isLoggedIn, isInit, router]);

  if (!isInit || !isLoggedIn) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className={styles.layout}>
      <a href="#main-content" className="skip-link">{settings.language === 'id' ? 'Lompat ke konten utama' : 'Skip to main content'}</a>
      <div className={`${styles.sidebarWrapper} ${isSidebarOpen ? styles.sidebarOpen : ''}`}>
        <Sidebar />
      </div>
      
      {/* Overlay untuk mobile saat drawer terbuka */}
      {isSidebarOpen && (
        <div 
          className={styles.drawerOverlay} 
          onClick={() => setIsSidebarOpen(false)} 
        />
      )}

      <main className={styles.main} id="main-content">
        <div className={styles.mobileHeaderWrapper}>
          <MobileHeader onMenuClick={() => setIsSidebarOpen(true)} />
        </div>
        <div className={styles.content}>
          <Breadcrumb />
          {children}
        </div>
      </main>
    </div>
  );
}
