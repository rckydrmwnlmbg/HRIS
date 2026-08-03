import React from 'react';

type SkeletonProps = {
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
    backgroundColor: 'var(--border)',
    opacity: 0.4,
    width: width || (variant === 'text' ? '100%' : undefined),
    height: height || (variant === 'text' ? '1rem' : undefined),
    borderRadius: variant === 'circle' ? '50%' : (variant === 'text' ? '4px' : 'var(--radius-md)'),
    ...style
  };

  return (
    <div 
      className={`animate-pulse ${className}`} 
      style={baseStyle}
    />
  );
}
