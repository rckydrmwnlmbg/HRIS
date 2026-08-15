'use client';

import React from 'react';
import Link from 'next/link';
import { Menu, Shield } from 'lucide-react';
import { useApp } from '@/lib/context';
import styles from './MobileHeader.module.css';

interface MobileHeaderProps {
  onMenuClick: () => void;
}

export default function MobileHeader({ onMenuClick }: MobileHeaderProps) {
  const { user } = useApp();
  
  return (
    <header className={styles.header}>
      <div className={styles.leftArea}>
        <button 
          onClick={onMenuClick}
          className={styles.menuBtn}
          aria-label="Buka Menu Navigasi"
        >
          <Menu size={20} />
        </button>
        
        <Link href="/dashboard" className={styles.brand}>
          <div className={styles.logoBox}>
            <Shield size={16} />
          </div>
          <div className={styles.brandText}>
            HRIS <span className={styles.brandHighlight}>TMNB</span>
          </div>
        </Link>
      </div>
      
      {/* Right Area: User Profile Avatar */}
      <div className={styles.rightArea}>
        <div className={styles.avatarWrapper}>
          <img
            src="/avatar-hr.png"
            alt={user?.nama || 'Profil'}
            className={styles.avatar}
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
          <div className={styles.onlineBadge} />
        </div>
      </div>
    </header>
  );
}
