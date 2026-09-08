'use client';
import React, { ReactNode, useRef, useState, useEffect } from 'react';

export type BadgeVariant =
  | 'hadir'
  | 'alpha'
  | 'izin'
  | 'cuti'
  | 'sakit'
  | 'libur'
  | 'haid'
  | 'success'
  | 'danger'
  | 'warning'
  | 'info'
  | 'purple'
  | 'orange'
  | 'gray';

export type BadgeSize = 'sm' | 'md' | 'lg';

export interface BadgeProps {
  variant?: BadgeVariant;
  size?: BadgeSize;
  children: ReactNode;
  icon?: ReactNode;
  dot?: boolean;
  className?: string;
  style?: React.CSSProperties;
  title?: string;
  maxWidth?: number | string;
}

export function Badge({
  variant = 'gray',
  size = 'md',
  children,
  icon,
  dot = false,
  className = '',
  style,
  title,
  maxWidth
}: BadgeProps) {
  const sizeClass = size === 'sm' ? 'badge-sm' : size === 'lg' ? 'badge-lg' : '';
  const containerRef = useRef<HTMLSpanElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [marqueeOffset, setMarqueeOffset] = useState<number>(0);

  const textContent = typeof children === 'string' ? children : undefined;

  useEffect(() => {
    if (containerRef.current && textRef.current) {
      const paddingReduction = dot || icon ? 26 : 18;
      const cW = containerRef.current.clientWidth - paddingReduction;
      const tW = textRef.current.scrollWidth;
      if (tW > cW && cW > 0) {
        setMarqueeOffset(cW - tW);
      } else {
        setMarqueeOffset(0);
      }
    }
  }, [children, maxWidth, dot, icon]);

  const isMarquee = marqueeOffset < 0;

  return (
    <span
      ref={containerRef}
      className={`badge badge-${variant} ${sizeClass} ${className}`.trim()}
      style={{
        maxWidth: maxWidth || undefined,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        flexShrink: 0,
        ...style
      }}
      title={title || textContent}
    >
      {dot && (
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            backgroundColor: 'currentColor',
            display: 'inline-block',
            flexShrink: 0
          }}
        />
      )}
      {icon && <span style={{ display: 'inline-flex', flexShrink: 0 }}>{icon}</span>}
      <span
        ref={textRef}
        style={{
          display: 'inline-block',
          whiteSpace: 'nowrap',
          willChange: isMarquee ? 'transform' : 'auto',
          animation: isMarquee ? 'marqueeBadge 4.5s ease-in-out infinite alternate' : 'none',
          ['--marquee-offset' as any]: `${marqueeOffset}px`
        }}
      >
        {children}
      </span>
    </span>
  );
}
