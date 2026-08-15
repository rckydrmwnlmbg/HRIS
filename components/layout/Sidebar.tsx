'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useApp } from '@/lib/context';
import { t } from '@/lib/i18n';
import {
  LayoutDashboard, Users, ClipboardList, Clock, BarChart3,
  Settings, LogOut, Shield, ChevronRight, ChevronDown, Globe, Calendar, FileText, Sun, Moon, X
} from 'lucide-react';
import { useState, useRef, useEffect, useCallback } from 'react';
import styles from './sidebar.module.css';

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, key: 'dashboard' as const },
  { href: '/daily', icon: Clock, key: 'daily' as const },
  { href: '/karyawan', icon: Users, key: 'karyawan' as const },
  { 
    href: '/absensi', icon: ClipboardList, key: 'absensi' as const,
    subItems: [
      { href: '/absensi', labelId: 'Edit Absensi Karyawan', labelEn: 'Edit Employee Attendance' },
      { href: '/check-bagian', labelId: 'Check Per Bagian', labelEn: 'Check Per Section' },
    ]
  },
  { href: '/cuti', icon: Calendar, key: 'navCuti' as any },
  { href: '/laporan', icon: BarChart3, key: 'laporan' as const },
  { 
    href: '/pengaturan', icon: Settings, key: 'pengaturan' as const,
    subItems: [
      { href: '/pengaturan', labelId: 'Umum', labelEn: 'General' },
      { href: '/pengaturan/hari-libur', labelId: 'Hari Libur', labelEn: 'Holiday' }
    ]
  },
];

interface SidebarProps {
  onClose?: () => void;
}

export default function Sidebar({ onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, setUser, settings, setLanguage, setTheme } = useApp();
  const lang = settings.language;
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({
    '/absensi': pathname.startsWith('/absensi') || pathname.startsWith('/check-bagian'),
    '/pengaturan': pathname.startsWith('/pengaturan')
  });


  const navRef = useRef<HTMLElement>(null);
  const [pillStyle, setPillStyle] = useState({ top: 0, height: 0, opacity: 0 });

  const updatePillPosition = useCallback(() => {
    if (!navRef.current) return;
    const activeEl = navRef.current.querySelector('.' + styles.navItemActive);
    
    if (activeEl) {
      const elRect = (activeEl as HTMLElement).getBoundingClientRect();
      const navRect = navRef.current.getBoundingClientRect();
      // calculate top relative to the scrolling container
      setPillStyle({
        top: elRect.top - navRect.top + navRef.current.scrollTop,
        height: elRect.height,
        opacity: 1
      });
    } else {
      setPillStyle(prev => ({ ...prev, opacity: 0 }));
    }
  }, []);

  useEffect(() => {
    updatePillPosition();
    const t1 = setTimeout(updatePillPosition, 50);
    const t2 = setTimeout(updatePillPosition, 250);
    window.addEventListener('resize', updatePillPosition);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener('resize', updatePillPosition);
    };
  }, [pathname, openMenus, lang, updatePillPosition]);

  const handleLogout = () => {
    setUser(null);
    onClose?.();
    router.push('/login');
  };

  const toggleMenu = (href: string, e: React.MouseEvent) => {
    e.preventDefault();
    setOpenMenus(prev => ({ ...prev, [href]: !prev[href] }));
  };

  const handleLinkClick = () => {
    onClose?.();
  };

  return (
    <aside className={`${styles.sidebar} no-print`} role="navigation" aria-label="Main Navigation">
      {/* Brand */}
      <div className={styles.brand}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className={styles.logo}>
            <Shield size={20} />
          </div>
          <div>
            <div className={styles.brandName}>HRIS TMNB</div>
            <div className={styles.brandSub}>{lang === 'id' ? 'Manajemen SDM Terintegrasi' : 'Integrated HR Management'}</div>
          </div>
        </div>

        {/* Mobile Close Button */}
        {onClose && (
          <button 
            type="button"
            className={styles.mobileCloseBtn} 
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }}
            aria-label="Tutup Menu"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className={styles.nav} ref={navRef as any} onScroll={updatePillPosition} aria-label="Sidebar Menu">
        {/* Animated Active Pill Backdrop */}
        <div className={styles.activePillWrapper} style={{ top: `${pillStyle.top}px`, height: `${pillStyle.height}px`, opacity: pillStyle.opacity }} />
        
        <div className={styles.navSection}>
          {navItems.map(item => {
            const hasSub = !!item.subItems;
            const isActive = hasSub 
              ? pathname.startsWith(item.href) 
              : pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
            const isOpen = openMenus[item.href];

            return (
              <div key={item.href} className={styles.navItemContainer}>
                {hasSub ? (
                  <div 
                    className={`${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
                    onClick={(e) => toggleMenu(item.href, e)}
                  >
                    <item.icon size={18} strokeWidth={isActive ? 2 : 1.5} />
                    <span>{t(lang, item.key)}</span>
                    {isOpen 
                      ? <ChevronDown size={14} className={styles.activeChevron} /> 
                      : <ChevronRight size={14} className={styles.activeChevron} />
                    }
                  </div>
                ) : (
                  <Link
                    href={item.href}
                    className={`${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
                    onClick={handleLinkClick}
                  >
                    <item.icon size={18} strokeWidth={isActive ? 2 : 1.5} />
                    <span>{t(lang, item.key)}</span>
                    {isActive && <ChevronRight size={14} className={styles.activeChevron} />}
                  </Link>
                )}

                {/* Sub Menu rendering */}
                {hasSub && isOpen && (
                  <div className={styles.subMenu}>
                    {item.subItems!.map(sub => {
                      const isSubActive = pathname === sub.href;
                      return (
                        <Link
                          key={sub.href}
                          href={sub.href}
                          className={`${styles.subItem} ${isSubActive ? styles.subItemActive : ''}`}
                          onClick={handleLinkClick}
                        >
                          {lang === 'id' ? sub.labelId : sub.labelEn}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </nav>

      {/* Bottom section */}
      <div className={styles.bottom}>
        {/* Language and Theme toggle */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          <button
            className={styles.langToggle}
            style={{ flex: 1, padding: '8px' }}
            onClick={() => setLanguage(lang === 'id' ? 'en' : 'id')}
            title={lang === 'id' ? 'Switch to English' : 'Ganti ke Indonesia'}
          >
            <Globe size={14} />
            <span style={{ fontSize: '11px' }}>{lang === 'id' ? '🇮🇩 ID' : '🇬🇧 EN'}</span>
          </button>
          <button
            className={styles.langToggle}
            style={{ flex: 1, padding: '8px', justifyContent: 'center' }}
            onClick={() => setTheme(settings.darkMode ? 'light' : 'dark')}
            title={settings.darkMode ? 'Light Mode' : 'Dark Mode'}
          >
            {settings.darkMode ? <Sun size={14} /> : <Moon size={14} />}
            <span style={{ fontSize: '11px' }}>{settings.darkMode ? 'Light' : 'Dark'}</span>
          </button>
        </div>

        {/* User info */}
        <div className={styles.userCard}>
          <img
            src="/avatar-hr.png"
            alt="Profile"
            className={styles.userAvatar}
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
          <div className={styles.userInfo}>
            <div className={styles.userName}>{user?.nama || 'User'}</div>
            <div className={styles.userRole}>{user?.role || ''}</div>
          </div>
          <button className={styles.logoutBtn} onClick={handleLogout} title={t(lang, 'keluar')}>
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </aside>
  );
}
