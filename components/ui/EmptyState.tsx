import React from 'react';
import { FileQuestion, FolderOpen, SearchX, UserX } from 'lucide-react';

export type EmptyStateIcon = 'folder' | 'search' | 'user' | 'document';

type EmptyStateProps = {
  icon?: EmptyStateIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
};

export function EmptyState({ 
  icon = 'folder', 
  title, 
  description, 
  action,
  className = ''
}: EmptyStateProps) {
  
  const IconComponent = {
    'folder': FolderOpen,
    'search': SearchX,
    'user': UserX,
    'document': FileQuestion
  }[icon];

  return (
    <div className={`animate-fadeIn ${className}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px', textAlign: 'center', minHeight: '300px' }}>
      <div 
        style={{
          width: '72px',
          height: '72px',
          borderRadius: '50%',
          background: 'var(--bg-input)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '20px',
          color: 'var(--text-muted)'
        }}
      >
        <IconComponent size={32} strokeWidth={1.5} />
      </div>
      <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
        {title}
      </h3>
      <p style={{ fontSize: '14px', color: 'var(--text-secondary)', maxWidth: '400px', margin: '0 auto 24px', lineHeight: 1.5 }}>
        {description}
      </p>
      {action && (
        <div>
          {action}
        </div>
      )}
    </div>
  );
}
