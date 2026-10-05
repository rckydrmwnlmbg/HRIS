'use client';
import React, { ReactNode, useRef, useState, useEffect, memo } from 'react';

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

export const Badge = memo(function Badge({
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
  const isShortText = typeof content === 'string' && content.length <= 14;

  useEffect(() => {
    // Skip expensive forced layout calculation for short strings that never overflow
    if (isShortText) {
      if (marqueeOffset !== 0) setMarqueeOffset(0);
      return;
    }

    let rafId: number;
    const measure = () => {
      if (textContainerRef.current && textRef.current) {
        const availableW = textContainerRef.current.clientWidth;
        const textW = textRef.current.scrollWidth;
        if (textW > availableW && availableW > 0) {
          const diff = availableW - textW - 2;
          setMarqueeOffset(prev => (prev !== diff ? diff : prev));
        } else if (marqueeOffset !== 0) {
          setMarqueeOffset(0);
        }
      }
    };

    // Single requestAnimationFrame avoids blocking synchronous render pipeline
    rafId = requestAnimationFrame(measure);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [content, maxWidth, minWidth, width, isShortText]);

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
          textOverflow: isMarquee ? 'clip' : 'ellipsis',
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
});

export const MarqueeBadge = memo(function MarqueeBadge(props: BadgeProps) {
  return <Badge {...props} />;
});
