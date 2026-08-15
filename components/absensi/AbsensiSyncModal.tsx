'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Clock, CheckSquare, Hourglass, Zap, Timer } from 'lucide-react';
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
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Live Timer Stopwatch
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (loading) {
      setElapsedSeconds(0);
      timer = setInterval(() => {
        setElapsedSeconds(prev => prev + 1);
      }, 1000);
    } else {
      setElapsedSeconds(0);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [loading]);

  // Extract row counts if present in message (e.g. "(1500/17420)")
  const countMatch = useMemo(() => {
    const m = message.match(/\((\d+)\/(\d+)\)/);
    if (m) {
      return {
        current: parseInt(m[1], 10),
        total: parseInt(m[2], 10)
      };
    }
    return null;
  }, [message]);

  // Calculate Throughput Speed & Dynamic Remaining Time
  const metrics = useMemo(() => {
    if (!loading || elapsedSeconds < 2) {
      return {
        etaStr: lang === 'id' ? 'Menghitung...' : 'Calculating...',
        speedStr: '- baris/dtk',
        elapsedStr: '00:00'
      };
    }

    const pad = (n: number) => String(n).padStart(2, '0');
    const elapsedMinutes = Math.floor(elapsedSeconds / 60);
    const elapsedSecs = elapsedSeconds % 60;
    const elapsedStr = `${pad(elapsedMinutes)}:${pad(elapsedSecs)}`;

    let speed = 0;
    let remainingSec = 0;

    if (countMatch && countMatch.current > 0) {
      speed = countMatch.current / elapsedSeconds;
      const remainingItems = Math.max(0, countMatch.total - countMatch.current);
      remainingSec = speed > 0 ? Math.round(remainingItems / speed) : 0;
    } else if (progress > 5 && progress < 100) {
      const totalEstimatedSec = (elapsedSeconds / progress) * 100;
      remainingSec = Math.max(0, Math.round(totalEstimatedSec - elapsedSeconds));
    }

    let etaStr = '-';
    if (progress >= 100) {
      etaStr = lang === 'id' ? 'Selesai' : 'Completed';
    } else if (remainingSec > 0) {
      const rMin = Math.floor(remainingSec / 60);
      const rSec = remainingSec % 60;
      if (rMin > 0) {
        etaStr = `~${rMin} mnt ${rSec > 0 ? `${rSec} dtk` : ''}`;
      } else {
        etaStr = `~${rSec} detik`;
      }
    } else {
      etaStr = lang === 'id' ? 'Menghitung...' : 'Calculating...';
    }

    const speedStr = speed > 0 ? `~${Math.round(speed)} baris/dtk` : '-';

    return { etaStr, speedStr, elapsedStr };
  }, [loading, elapsedSeconds, progress, countMatch, lang]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={loading ? () => {} : onClose}
      title={lang === 'id' ? 'Tarik Data Mesin Absensi' : 'Sync Device Attendance Data'}
      icon={<Clock size={18} color="var(--accent)" />}
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
        <div style={{ padding: '16px 12px', textAlign: 'center' }}>
          <div style={{ marginBottom: '14px', fontSize: '13.5px', fontWeight: 650, color: 'var(--text-primary)' }}>
            {message}
          </div>

          {/* Progress Bar */}
          <div
            style={{
              width: '100%',
              height: '9px',
              background: 'var(--bg-subtle)',
              borderRadius: '9999px',
              overflow: 'hidden',
              border: '1px solid var(--border)',
              boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.06)'
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${progress}%`,
                background: 'linear-gradient(90deg, #0284c7 0%, #38bdf8 100%)',
                borderRadius: '9999px',
                transition: 'width 0.35s ease-out',
                boxShadow: '0 0 12px rgba(14, 165, 233, 0.5)'
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', padding: '0 2px' }}>
            <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: 500 }}>
              {countMatch ? `${countMatch.current.toLocaleString()} / ${countMatch.total.toLocaleString()} baris` : `${progress}%`}
            </span>
            <span style={{ fontSize: '13px', color: 'var(--accent)', fontWeight: 750 }}>
              {progress}%
            </span>
          </div>

          {/* Live Metrics Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: '8px',
            marginTop: '16px',
            textAlign: 'left'
          }}>
            {/* 1. Elapsed Time */}
            <div style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              padding: '8px 10px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--text-muted)', fontSize: '10.5px', fontWeight: 600 }}>
                <Timer size={12} color="var(--accent)" />
                {lang === 'id' ? 'Berjalan' : 'Elapsed'}
              </div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
                {metrics.elapsedStr}
              </div>
            </div>

            {/* 2. Dynamic ETA */}
            <div style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              padding: '8px 10px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--text-muted)', fontSize: '10.5px', fontWeight: 600 }}>
                <Hourglass size={12} color="#f59e0b" />
                {lang === 'id' ? 'Sisa Waktu' : 'ETA'}
              </div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#f59e0b', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {metrics.etaStr}
              </div>
            </div>

            {/* 3. Speed Rate */}
            <div style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              padding: '8px 10px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--text-muted)', fontSize: '10.5px', fontWeight: 600 }}>
                <Zap size={12} color="#10b981" />
                {lang === 'id' ? 'Kecepatan' : 'Speed'}
              </div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#10b981', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {metrics.speedStr}
              </div>
            </div>
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
