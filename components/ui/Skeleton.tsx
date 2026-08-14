import React from 'react';
import styles from './Skeleton.module.css';

export type SkeletonProps = {
  className?: string;
  style?: React.CSSProperties;
  variant?: 'rect' | 'circle' | 'text';
  width?: string | number;
  height?: string | number;
};

export function Skeleton({ 
  className = '', 
  style, 
  variant = 'rect',
  width,
  height
}: SkeletonProps) {
  const baseStyle: React.CSSProperties = {
    width: width || (variant === 'text' ? '100%' : undefined),
    height: height || (variant === 'text' ? '1rem' : undefined),
    borderRadius: variant === 'circle' ? '50%' : (variant === 'text' ? '4px' : undefined),
    ...style
  };

  return (
    <div 
      className={`${styles.skeleton} ${styles.shimmer} ${className}`} 
      style={baseStyle}
    />
  );
}

/**
 * Skeleton khusus untuk Halaman Dashboard
 * Presisi 100% mengikuti tata letak elemen Dashboard sesungguhnya
 */
export function SkeletonDashboard() {
  return (
    <div className="animate-fadeIn" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Header Row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <Skeleton width={220} height={28} style={{ marginBottom: 6 }} />
          <Skeleton width={160} height={14} />
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Skeleton width={110} height={36} style={{ borderRadius: 'var(--radius-md)' }} />
          <Skeleton width={90} height={36} style={{ borderRadius: 'var(--radius-md)' }} />
        </div>
      </div>

      {/* Welcome Briefing Glass Box */}
      <div className="glass-card" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Skeleton variant="circle" width={28} height={28} />
            <Skeleton width={240} height={18} />
          </div>
          <Skeleton width={120} height={14} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '10px', marginTop: '4px' }}>
          <Skeleton height={50} style={{ borderRadius: 'var(--radius-sm)' }} />
          <Skeleton height={50} style={{ borderRadius: 'var(--radius-sm)' }} />
          <Skeleton height={50} style={{ borderRadius: 'var(--radius-sm)' }} />
        </div>
      </div>

      {/* Row 1: 4 Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="glass-card" style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '8px', minHeight: '100px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Skeleton width={100} height={12} />
              <Skeleton variant="circle" width={26} height={26} />
            </div>
            <Skeleton width={80} height={28} style={{ margin: '4px 0' }} />
            <Skeleton width={130} height={12} />
          </div>
        ))}
      </div>

      {/* Row 2: Attendance Trend Chart (1.5fr) + Dashboard Calendar (1fr) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '18px', alignItems: 'stretch' }}>
        {/* Trend Chart Card */}
        <div className="glass-card" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', minHeight: '340px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Skeleton variant="circle" width={24} height={24} />
              <Skeleton width={140} height={16} />
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <Skeleton width={150} height={24} style={{ borderRadius: 'var(--radius-sm)' }} />
              <Skeleton width={90} height={24} style={{ borderRadius: 'var(--radius-sm)' }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            <Skeleton width={60} height={20} style={{ borderRadius: 'var(--radius-sm)' }} />
            <Skeleton width={60} height={20} style={{ borderRadius: 'var(--radius-sm)' }} />
            <Skeleton width={60} height={20} style={{ borderRadius: 'var(--radius-sm)' }} />
            <Skeleton width={60} height={20} style={{ borderRadius: 'var(--radius-sm)' }} />
          </div>
          <div style={{ flex: 1, minHeight: '200px' }}>
            <Skeleton width="100%" height="100%" style={{ borderRadius: 'var(--radius-md)' }} />
          </div>
        </div>

        {/* Calendar Card */}
        <div className="glass-card" style={{ padding: '14px 20px', display: 'flex', flexDirection: 'column', minHeight: '340px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Skeleton variant="circle" width={22} height={22} />
              <Skeleton width={120} height={15} />
            </div>
            <Skeleton width={110} height={24} style={{ borderRadius: 'var(--radius-sm)' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '3px', marginBottom: '6px' }}>
            {[1, 2, 3, 4, 5, 6, 7].map(d => (
              <Skeleton key={d} height={16} style={{ borderRadius: '4px' }} />
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '3px', marginBottom: '10px' }}>
            {Array.from({ length: 35 }).map((_, idx) => (
              <Skeleton key={idx} height={27} style={{ borderRadius: '5px' }} />
            ))}
          </div>
          <Skeleton height={50} style={{ borderRadius: 'var(--radius-sm)' }} />
        </div>
      </div>

      {/* Row 3: 2 Alert Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px' }}>
        <div className="glass-card" style={{ padding: '18px 20px', minHeight: '160px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <Skeleton variant="circle" width={22} height={22} />
            <Skeleton width={150} height={16} />
          </div>
          <Skeleton width="100%" height={36} style={{ marginBottom: '8px' }} />
          <Skeleton width="100%" height={36} />
        </div>
        <div className="glass-card" style={{ padding: '18px 20px', minHeight: '160px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <Skeleton variant="circle" width={22} height={22} />
            <Skeleton width={150} height={16} />
          </div>
          <Skeleton width="100%" height={36} style={{ marginBottom: '8px' }} />
          <Skeleton width="100%" height={36} />
        </div>
      </div>
    </div>
  );
}

/**
 * Skeleton khusus untuk Data Table (Karyawan, Absensi, Laporan, dsb)
 */
export function SkeletonTable({ rows = 6, cols = 7 }: { rows?: number; cols?: number }) {
  return (
    <div className="animate-fadeIn" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Top Filter Bar */}
      <div className="glass-card" style={{ padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', gap: '10px', flex: 1, maxWidth: '500px' }}>
          <Skeleton width="100%" height={36} style={{ borderRadius: 'var(--radius-md)' }} />
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Skeleton width={100} height={36} style={{ borderRadius: 'var(--radius-md)' }} />
          <Skeleton width={120} height={36} style={{ borderRadius: 'var(--radius-md)' }} />
        </div>
      </div>

      {/* Table Wrapper */}
      <div className="table-wrapper" style={{ padding: '12px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: '12px', padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} height={14} width="80%" />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, r) => (
          <div 
            key={r} 
            style={{ 
              display: 'grid', 
              gridTemplateColumns: `repeat(${cols}, 1fr)`, 
              gap: '12px', 
              padding: '14px 14px', 
              borderBottom: r < rows - 1 ? '1px solid var(--border)' : 'none',
              alignItems: 'center'
            }}
          >
            {Array.from({ length: cols }).map((_, c) => (
              <div key={c} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {c === 1 && <Skeleton variant="circle" width={28} height={28} />}
                <Skeleton height={14} width={c === 0 ? '40%' : c === 1 ? '70%' : '85%'} />
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Pagination Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 8px' }}>
        <Skeleton width={140} height={16} />
        <div style={{ display: 'flex', gap: '6px' }}>
          <Skeleton width={32} height={32} style={{ borderRadius: 'var(--radius-sm)' }} />
          <Skeleton width={32} height={32} style={{ borderRadius: 'var(--radius-sm)' }} />
          <Skeleton width={32} height={32} style={{ borderRadius: 'var(--radius-sm)' }} />
        </div>
      </div>
    </div>
  );
}

/**
 * Skeleton khusus untuk Daily Attendance Page
 */
export function SkeletonDaily() {
  return (
    <div className="animate-fadeIn" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header & Date Picker */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <Skeleton width={200} height={28} style={{ marginBottom: 6 }} />
          <Skeleton width={160} height={14} />
        </div>
        <Skeleton width={180} height={36} style={{ borderRadius: 'var(--radius-md)' }} />
      </div>

      {/* 4 Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="glass-card" style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <Skeleton width={90} height={12} />
            <Skeleton width={70} height={26} />
            <Skeleton width={120} height={12} />
          </div>
        ))}
      </div>

      {/* Section Breakdown Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} className="glass-card" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Skeleton width={140} height={16} />
              <Skeleton width={60} height={20} style={{ borderRadius: '100px' }} />
            </div>
            <Skeleton width="100%" height={24} />
            <Skeleton width="100%" height={40} style={{ borderRadius: 'var(--radius-sm)' }} />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Skeleton khusus untuk Cuti & Perizinan Page
 */
export function SkeletonCuti() {
  return (
    <div className="animate-fadeIn" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <Skeleton width={200} height={28} style={{ marginBottom: 6 }} />
          <Skeleton width={180} height={14} />
        </div>
        <Skeleton width={140} height={36} style={{ borderRadius: 'var(--radius-md)' }} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="glass-card" style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <Skeleton width={80} height={12} />
            <Skeleton width={60} height={24} />
          </div>
        ))}
      </div>

      <SkeletonTable rows={5} cols={6} />
    </div>
  );
}
