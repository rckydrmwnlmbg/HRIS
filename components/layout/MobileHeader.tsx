'use client';

import React from 'react';
import { Menu } from 'lucide-react';
import { useApp } from '@/lib/context';

interface MobileHeaderProps {
  onMenuClick: () => void;
}

export default function MobileHeader({ onMenuClick }: MobileHeaderProps) {
  const { settings } = useApp();
  
  return (
    <div 
      className="mobile-header" 
      style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        padding: '12px 20px',
        background: 'var(--bg-card)',
        borderBottom: '1px solid var(--border)',
        position: 'sticky',
        top: 0,
        zIndex: 40,
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button 
          onClick={onMenuClick}
          style={{ 
            background: 'transparent', 
            border: 'none', 
            color: 'var(--text-primary)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            padding: '4px',
            cursor: 'pointer'
          }}
        >
          <Menu size={18} />
        </button>
        <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
          HRIS <span style={{ color: 'var(--accent)' }}>TMNB</span>
        </div>
      </div>
      
      {/* Profil Mini placeholder */}
      <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--bg-card-hover)', border: '1px solid var(--border)' }} />
    </div>
  );
}
