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
          <Menu size={24} />
        </button>
        <div style={{ fontWeight: 800, fontSize: '18px', color: 'var(--accent-dark)', letterSpacing: '-0.5px' }}>
          HRIS <span style={{ color: 'var(--accent)' }}>TMNB</span>
        </div>
      </div>
      
      {/* Profil Mini placeholder */}
      <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--bg-card-hover)', border: '1px solid var(--border)' }} />
    </div>
  );
}
