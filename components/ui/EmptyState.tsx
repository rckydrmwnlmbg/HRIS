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
    <div className={`animate-fadeIn ${className}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px', textAlign: 'center', minHeight: '180px' }}>
      <div 
        style={{
          width: '40px',
          height: '40px',
          borderRadius: '50%',
          background: 'var(--bg-input)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '10px',
          color: 'var(--text-muted)'
        }}
      >
        <IconComponent size={20} strokeWidth={1.5} />
      </div>
      <h3 style={{ fontSize: '13px', fontWeight: 650, color: 'var(--text-primary)', marginBottom: '4px' }}>
        {title}
      </h3>
      <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)', maxWidth: '340px', margin: '0 auto 14px', lineHeight: 1.45 }}>
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
