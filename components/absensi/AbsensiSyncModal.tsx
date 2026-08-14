'use client';
import React from 'react';
import { Modal } from '@/components/ui/Modal';
import { Clock, CheckSquare } from 'lucide-react';
import type { Language } from '@/types';
import { t } from '@/lib/i18n';

interface AbsensiSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  startDate: string;
  setStartDate: (s: string) => void;
  endDate: string;
  setEndDate: (e: string) => void;
  loading: boolean;
  progress: number;
  message: string;
  onStartSync: () => void;
  lang: Language;
}

export function AbsensiSyncModal({
  isOpen,
  onClose,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  loading,
  progress,
  message,
  onStartSync,
  lang,
}: AbsensiSyncModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={loading ? () => {} : onClose}
      title={lang === 'id' ? 'Tarik Data Mesin Absensi' : 'Sync Device Attendance Data'}
      icon={<Clock size={18} color="var(--accent-blue)" />}
      maxWidth={520}
      showCloseButton={!loading}
      closeOnOverlayClick={!loading}
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', width: '100%' }}>
          <button className="btn btn-secondary" onClick={onClose} disabled={loading}>
            {t(lang, 'batal')}
          </button>
          <button
            className="btn btn-primary"
            onClick={onStartSync}
            disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            {loading ? (
              <>
                <div className="spinner" style={{ width: 14, height: 14 }} />
                {lang === 'id' ? 'Menyinkronkan...' : 'Syncing...'}
              </>
            ) : (
              <>
                <CheckSquare size={14} />
                {lang === 'id' ? 'Mulai Tarik Data' : 'Start Sync'}
              </>
            )}
          </button>
        </div>
      }
    >
      {loading ? (
        <div style={{ padding: '24px 16px', textAlign: 'center' }}>
          <div style={{ marginBottom: '16px', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
            {message}
          </div>
          <div
            style={{
              width: '100%',
              height: '8px',
              background: 'var(--bg-subtle)',
              borderRadius: '9999px',
              overflow: 'hidden',
              border: '1px solid var(--border)'
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${progress}%`,
                background: 'linear-gradient(90deg, var(--accent-blue), var(--accent-light))',
                transition: 'width 0.3s ease-out'
              }}
            />
          </div>
          <div style={{ marginTop: '10px', fontSize: '13px', color: 'var(--accent-blue)', fontWeight: 700 }}>
            {progress}%
          </div>
        </div>
      ) : (
        <div>
          <div
            style={{
              padding: '12px 14px',
              background: 'rgba(14, 165, 233, 0.08)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid rgba(14, 165, 233, 0.2)',
              marginBottom: '18px',
              fontSize: '13px',
              color: 'var(--text-secondary)',
              lineHeight: 1.5
            }}
          >
            {lang === 'id'
              ? 'Tentukan rentang tanggal absensi yang ingin ditarik dari mesin (DataSolution). Data absensi di HRIS akan diperbarui dengan aman tanpa menghapus jam lembur.'
              : 'Specify the date range to sync from the attendance devices (DataSolution). HRIS data will be updated safely without overwriting overtime.'}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div className="form-group">
              <label className="form-label">{lang === 'id' ? 'Tanggal Mulai' : 'Start Date'}</label>
              <input
                type="date"
                className="form-input"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">{lang === 'id' ? 'Tanggal Selesai' : 'End Date'}</label>
              <input
                type="date"
                className="form-input"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
              />
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
