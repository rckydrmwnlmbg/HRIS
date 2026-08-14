'use client';
import React, { ReactNode } from 'react';

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
}

export function Badge({
  variant = 'gray',
  size = 'md',
  children,
  icon,
  dot = false,
  className = '',
  style,
  title
}: BadgeProps) {
  const sizeClass = size === 'sm' ? 'badge-sm' : size === 'lg' ? 'badge-lg' : '';

  return (
    <span
      className={`badge badge-${variant} ${sizeClass} ${className}`.trim()}
      style={style}
      title={title}
    >
      {dot && (
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            backgroundColor: 'currentColor',
            display: 'inline-block'
          }}
        />
      )}
      {icon && <span style={{ display: 'inline-flex' }}>{icon}</span>}
      {children}
    </span>
  );
}
