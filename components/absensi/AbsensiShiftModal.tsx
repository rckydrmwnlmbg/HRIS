'use client';
import React from 'react';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { ShieldAlert, ShieldCheck } from 'lucide-react';
import type { Language } from '@/types';

interface AbsensiShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  loading: boolean;
  data: any;
  onApply: () => void;
  lang: Language;
}

export function AbsensiShiftModal({
  isOpen,
  onClose,
  loading,
  data,
  onApply,
  lang,
}: AbsensiShiftModalProps) {
  const getShiftLabel = (code: string | null | undefined) => {
    if (!code) return '-';
    const c = String(code).trim().toUpperCase();
    if (c === '1') return 'Pagi';
    if (c === '2S') return 'Siang';
    if (c === '3S') return 'Siang';
    if (c === '4S') return 'Malam';
    return c;
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={loading ? () => {} : onClose}
      title={lang === 'id' ? 'Sinkronisasi Shift Security' : 'Security Shift Sync'}
      icon={<ShieldAlert size={18} color="var(--warning)" />}
      maxWidth={620}
      showCloseButton={!loading}
      closeOnOverlayClick={!loading}
      footer={
        data && data.mismatch_count > 0 ? (
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', width: '100%' }}>
            <button className="btn btn-secondary" onClick={onClose} disabled={loading}>
              {lang === 'id' ? 'Batal' : 'Cancel'}
            </button>
            <button
              className="btn btn-primary"
              onClick={onApply}
              disabled={loading}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              {loading ? (
                <>
                  <div className="spinner" style={{ width: 14, height: 14 }} />
                  {lang === 'id' ? 'Menerapkan...' : 'Applying...'}
                </>
              ) : (
                <>
                  <ShieldCheck size={14} />
                  {lang === 'id' ? 'Terapkan Koreksi Shift' : 'Apply Shift Corrections'}
                </>
              )}
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
            <button className="btn btn-secondary" onClick={onClose}>
              {lang === 'id' ? 'Tutup' : 'Close'}
            </button>
          </div>
        )
      }
    >
      {loading && !data && (
        <div style={{ textAlign: 'center', padding: '36px 20px', color: 'var(--text-secondary)' }}>
          <div className="spinner" style={{ margin: '0 auto 14px' }} />
          {lang === 'id' ? 'Memindai kesesuaian shift...' : 'Scanning shifts...'}
        </div>
      )}

      {data && data.mismatch_count === 0 && (
        <div style={{ textAlign: 'center', padding: '36px 20px' }}>
          <ShieldCheck size={52} style={{ color: 'var(--success)', marginBottom: '14px' }} />
          <div style={{ fontWeight: 700, fontSize: '16px', marginBottom: '6px', color: 'var(--text-primary)' }}>
            {lang === 'id' ? 'Semua shift sudah sesuai!' : 'All shifts are correct!'}
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            {data.total_security_rows} {lang === 'id' ? 'record Security diperiksa, tidak ada mismatch.' : 'Security records checked, no mismatches.'}
          </div>
        </div>
      )}

      {data && data.mismatch_count > 0 && (
        <div>
          <div
            style={{
              padding: '12px 14px',
              background: 'rgba(217, 119, 6, 0.08)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid rgba(217, 119, 6, 0.22)',
              marginBottom: '16px'
            }}
          >
            <div style={{ fontWeight: 600, color: 'var(--warning)', marginBottom: '4px' }}>
              ⚠ {data.mismatch_count} {lang === 'id' ? 'shift tidak sesuai ditemukan' : 'shift mismatches found'}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
              {lang === 'id'
                ? `Dari ${data.total_security_rows} record Security, ${data.mismatch_count} memiliki kode shift yang berbeda dari jam aktual fingerprint.`
                : `Out of ${data.total_security_rows} Security records, ${data.mismatch_count} have mismatched shift codes.`}
            </div>
          </div>

          <div style={{ maxHeight: '300px', overflowY: 'auto', marginBottom: '16px' }}>
            <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '8px' }}>{lang === 'id' ? 'Tanggal' : 'Date'}</th>
                  <th style={{ padding: '8px' }}>IN</th>
                  <th style={{ padding: '8px' }}>OUT</th>
                  <th style={{ padding: '8px', textAlign: 'center' }}>{lang === 'id' ? 'Saat Ini' : 'Current'}</th>
                  <th style={{ padding: '8px', textAlign: 'center' }}>→</th>
                  <th style={{ padding: '8px', textAlign: 'center' }}>{lang === 'id' ? 'Terdeteksi' : 'Detected'}</th>
                </tr>
              </thead>
              <tbody>
                {data.mismatches.map((m: any) => (
                  <tr key={`${m.EMP_CD}-${m.DATE_TRANS}`} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px', fontWeight: 500 }}>
                      {new Date(m.DATE_TRANS).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}
                    </td>
                    <td style={{ padding: '8px', fontFamily: 'var(--font-mono)' }}>{m.WORK_IN?.substring(11, 16) || '-'}</td>
                    <td style={{ padding: '8px', fontFamily: 'var(--font-mono)' }}>{m.WORK_OUT?.substring(11, 16) || '-'}</td>
                    <td style={{ padding: '8px', textAlign: 'center' }}>
                      <Badge variant="warning" size="sm" title={`Kode: ${m.current_shift}`}>
                        {getShiftLabel(m.current_shift)}
                      </Badge>
                      {m.current_status && m.detected_status && m.current_status !== m.detected_status && (
                        <div style={{ fontSize: '10px', marginTop: '3px', color: 'var(--text-muted)' }}>{m.current_status}</div>
                      )}
                    </td>
                    <td style={{ padding: '8px', textAlign: 'center', color: 'var(--text-muted)' }}>→</td>
                    <td style={{ padding: '8px', textAlign: 'center' }}>
                      <Badge variant="success" size="sm" title={`Kode: ${m.detected_shift}`}>
                        {getShiftLabel(m.detected_shift)}
                      </Badge>
                      {m.current_status && m.detected_status && m.current_status !== m.detected_status && (
                        <div style={{ fontSize: '10px', marginTop: '3px', color: 'var(--success)' }}>{m.detected_status}</div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Modal>
  );
}
