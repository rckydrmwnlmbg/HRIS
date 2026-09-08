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
  children?: ReactNode;
  text?: string;
  icon?: ReactNode;
  dot?: boolean;
  className?: string;
  style?: React.CSSProperties;
  title?: string;
  maxWidth?: number | string;
  minWidth?: number | string;
  width?: number | string;
  height?: number | string;
}

export function Badge({
  variant = 'gray',
  size = 'md',
  children,
  text,
  icon,
  dot = false,
  className = '',
  style,
  title,
  maxWidth,
  minWidth,
  width,
  height
}: BadgeProps) {
  const content = text !== undefined ? text : children;
  const sizeClass = size === 'sm' ? 'badge-sm' : size === 'lg' ? 'badge-lg' : '';
  const textContainerRef = useRef<HTMLSpanElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [marqueeOffset, setMarqueeOffset] = useState<number>(0);

  const textContent = typeof content === 'string' ? content : undefined;

  useEffect(() => {
    const measure = () => {
      if (textContainerRef.current && textRef.current) {
        const availableW = textContainerRef.current.clientWidth;
        const textW = textRef.current.scrollWidth;
        if (textW > availableW && availableW > 0) {
          setMarqueeOffset(availableW - textW - 2);
        } else {
          setMarqueeOffset(0);
        }
      }
    };

    measure();
    const raf = requestAnimationFrame(measure);
    const timer = setTimeout(measure, 150);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, [content, maxWidth, minWidth, width]);

  const isMarquee = marqueeOffset < 0;

  return (
    <span
      className={`badge badge-${variant} ${sizeClass} ${className}`.trim()}
      style={{
        width: width || undefined,
        maxWidth: maxWidth || undefined,
        minWidth: minWidth || undefined,
        height: height || undefined,
        minHeight: height || undefined,
        maxHeight: height || undefined,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        display: 'inline-flex',
        alignItems: 'center',
        flexShrink: 0,
        boxSizing: 'border-box',
        lineHeight: 1,
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
            flexShrink: 0,
            marginRight: 5
          }}
        />
      )}
      {icon && (
        <span style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0, marginRight: 4 }}>
          {icon}
        </span>
      )}
      <span
        ref={textContainerRef}
        style={{
          display: 'inline-block',
          overflow: 'hidden',
          flex: 1,
          minWidth: 0,
          textAlign: isMarquee ? 'left' : 'center',
          whiteSpace: 'nowrap'
        }}
      >
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
          {content}
        </span>
      </span>
    </span>
  );
}

export function MarqueeBadge(props: BadgeProps) {
  return <Badge {...props} />;
}
