'use client';
import React, { useState } from 'react';
import type { AbsensiRecord, Reason, Language } from '@/types';
import { STATUS_HARI_MAP } from '@/types';
import { Modal } from '@/components/ui/Modal';
import { Calendar } from 'lucide-react';

interface AbsensiRekapCardsProps {
  rekap: Record<string, number>;
  records: AbsensiRecord[];
  masterReasons: Reason[];
  lang: Language;
}

export function AbsensiRekapCards({
  rekap,
  records,
  masterReasons,
  lang,
}: AbsensiRekapCardsProps) {
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);

  const normalizeStatus = (s: string | null | undefined) => (s || '').trim().toUpperCase();

  const filteredDetailRecords = selectedStatus
    ? records.filter(r => {
        let key = 'O'; // Default Hadir
        const statusHari = normalizeStatus(r.STATUS_HARI);
        const rg = r.REASON_GROUP ? normalizeStatus(r.REASON_GROUP) : '';
        const reason = normalizeStatus(r.REASON);

        if (statusHari === 'L' || statusHari === 'LIBUR') {
          key = 'L';
        } else if (rg === 'S' || ['15', '16'].includes(reason)) {
          key = 'S';
        } else if (rg === 'I' || ['05', '06', '07'].includes(reason)) {
          key = 'I';
        } else if (['C', 'H'].includes(rg) || ['08', '09', '10', '11', '12', '13', '14', '17', '18'].includes(reason)) {
          key = 'C';
        } else if (rg === 'A' || reason === '02' || ((!r.WORK_IN && !r.WORK_OUT) && (!reason || reason === ''))) {
          key = 'A';
        } else {
          key = 'O';
        }

        return key === selectedStatus;
      })
    : [];

  const statusInfo = selectedStatus ? STATUS_HARI_MAP[selectedStatus] : null;

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '14px', marginBottom: '22px' }}>
        {Object.entries(STATUS_HARI_MAP)
          .filter(([code]) => code !== 'L')
          .map(([code, info]) => {
            const count = rekap[code] || 0;
            return (
              <div
                key={code}
                className="glass-card"
                style={{
                  padding: '18px 16px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  position: 'relative',
                  overflow: 'hidden'
                }}
                onClick={() => setSelectedStatus(code)}
                title={lang === 'id' ? `Klik untuk rincian ${info.label_id}` : `Click to view ${info.label_en} details`}
              >
                <div
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '1.85rem',
                    fontWeight: 800,
                    color: 'var(--text-secondary, #475569)',
                    letterSpacing: '-0.03em',
                    lineHeight: 1.15,
                    textShadow: 'none',
                    filter: 'none'
                  }}
                >
                  {count}
                </div>
                <div
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: 'var(--text-muted, #64748b)',
                    marginTop: '6px',
                    letterSpacing: '0.01em'
                  }}
                >
                  {lang === 'id' ? info.label_id : info.label_en}
                </div>
              </div>
            );
          })}
      </div>

      <Modal
        isOpen={!!selectedStatus}
        onClose={() => setSelectedStatus(null)}
        title={
          <span>
            {lang === 'id' ? 'Rincian' : 'Details'}: {statusInfo ? (lang === 'id' ? statusInfo.label_id : statusInfo.label_en) : ''}
          </span>
        }
        icon={<Calendar size={18} color={statusInfo?.color || 'var(--accent-blue)'} />}
        maxWidth={500}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '55vh', overflowY: 'auto' }}>
          {filteredDetailRecords.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>
              {lang === 'id' ? 'Tidak ada catatan tanggal untuk status ini.' : 'No date records found for this status.'}
            </div>
          ) : (
            filteredDetailRecords.map(r => (
              <div
                key={r.DATE_TRANS}
                style={{
                  padding: '12px 14px',
                  background: 'var(--bg-subtle)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border)'
                }}
              >
                <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>
                  {new Date(r.DATE_TRANS).toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-US', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                  })}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '6px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                  <div>IN: <span style={{ fontFamily: 'var(--font-mono)' }}>{r.WORK_IN ? (r.WORK_IN_STR?.split(' ')[1] || r.WORK_IN.substring(11, 19)) : '-'}</span></div>
                  <div>OUT: <span style={{ fontFamily: 'var(--font-mono)' }}>{r.WORK_OUT ? (r.WORK_OUT_STR?.split(' ')[1] || r.WORK_OUT.substring(11, 19)) : '-'}</span></div>
                </div>
                {r.REASON && (
                  <div style={{ fontSize: '12px', marginTop: '6px', color: 'var(--warning)' }}>
                    Alasan: {(Array.isArray(masterReasons) ? masterReasons : []).find(m => m.REASON_CODE === r.REASON)?.REASON_DESC || r.REASON}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </Modal>
    </>
  );
}
