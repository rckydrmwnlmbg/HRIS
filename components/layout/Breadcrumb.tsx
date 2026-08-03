'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, Home } from 'lucide-react';
import { useApp } from '@/lib/context';

export default function Breadcrumb() {
  const pathname = usePathname();
  const { settings } = useApp();
  
  if (!pathname || pathname === '/' || pathname === '/dashboard') return null;
  
  const segments = pathname.split('/').filter(Boolean);
  
  return (
    <nav className="breadcrumb animate-fadeIn" aria-label="Breadcrumb" style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-secondary)' }}>
      <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'inherit', textDecoration: 'none', transition: 'color 0.2s' }}>
        <Home size={14} />
        <span style={{ cursor: 'pointer' }} onMouseEnter={e => e.currentTarget.style.color = 'var(--accent)'} onMouseLeave={e => e.currentTarget.style.color = 'inherit'}>Dashboard</span>
      </Link>
      
      {segments.map((segment, index) => {
        if (segment === 'dashboard') return null; // already handled
        
        const href = `/${segments.slice(0, index + 1).join('/')}`;
        const isLast = index === segments.length - 1;
        
        // Capitalize format
        const title = segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' ');
        
        return (
          <React.Fragment key={href}>
            <ChevronRight size={14} style={{ opacity: 0.5 }} />
            {isLast ? (
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }} aria-current="page">
                {title}
              </span>
            ) : (
              <Link href={href} style={{ color: 'inherit', textDecoration: 'none', transition: 'color 0.2s' }}>
                <span style={{ cursor: 'pointer' }} onMouseEnter={e => e.currentTarget.style.color = 'var(--accent)'} onMouseLeave={e => e.currentTarget.style.color = 'inherit'}>
                  {title}
                </span>
              </Link>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
