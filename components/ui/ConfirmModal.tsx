'use client';
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  description: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'primary';
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  isOpen, title, description, confirmText = 'Konfirmasi', cancelText = 'Batal', variant = 'danger', onConfirm, onCancel
}: ConfirmModalProps) {
  const confirmBtnRef = useRef<HTMLButtonElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleEsc);
      setTimeout(() => confirmBtnRef.current?.focus(), 50);
    }
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onCancel]);

  if (!isOpen || !mounted || typeof document === 'undefined') return null;

  return createPortal(
    <div className="modal-overlay" onClick={onCancel} style={{ zIndex: 9999 }}>
      <div 
        className="modal animate-fadeIn" 
        role="dialog" 
        aria-modal="true" 
        aria-labelledby="confirm-title"
        aria-describedby="confirm-desc"
        onClick={e => e.stopPropagation()} 
        style={{ maxWidth: '400px' }}
      >
        <div className="modal-header">
          <h3 id="confirm-title" className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {variant === 'danger' ? '⚠️' : '❓'} {title}
          </h3>
        </div>
        <div className="modal-body" style={{ padding: '16px 20px' }}>
          <div id="confirm-desc" style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            {description}
          </div>
        </div>
        <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', padding: '16px 20px', borderTop: '1px solid var(--border)' }}>
          <button className="btn btn-secondary" onClick={onCancel}>{cancelText}</button>
          <button 
            ref={confirmBtnRef}
            className={`btn ${variant === 'danger' ? 'btn-danger' : 'btn-primary'}`} 
            onClick={() => { onConfirm(); onCancel(); }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
