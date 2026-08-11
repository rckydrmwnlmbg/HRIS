'use client';
import { useState, useEffect } from 'react';
import { useApp } from '@/lib/context';
import { t } from '@/lib/i18n';
import { DataTable } from '@/components/ui/DataTable';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { Search, CheckSquare, Clock, AlertTriangle, Users } from 'lucide-react';
import type { Seksi } from '@/types';
import styles from './check-bagian.module.css';

interface CheckRecord {
  NIK: string;
  NAMA: string;
  JABATAN: string;
  MASUK: string | null;
  MASUK_FULL: string | null;
  PULANG: string | null;
  PULANG_FULL: string | null;
  STATUS_HARI: string;
  REASON: string;
  REASON_DESC: string;
  REASON_GROUP: string;
  SHIFT: string;
  DATE_TRANS: string;
  JAM_KERJA: number;
  ALPHA: boolean;
  LIBUR?: boolean;
  STATUS_DISPLAY: string;
}

interface DraftCorrection {
  EMP_CD: string;
  WORK_IN: string | null;
  WORK_OUT: string | null;
}

export default function CheckBagianPage() {
  const { settings } = useApp();
  const lang = settings.language;

  const [sections, setSections] = useState<Seksi[]>([]);
  const [selectedSec, setSelectedSec] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [records, setRecords] = useState<CheckRecord[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'warning' } | null>(null);
  const [otHours, setOtHours] = useState('');
  const [drafts, setDrafts] = useState<Map<string, DraftCorrection>>(new Map());
  const [applyLoading, setApplyLoading] = useState(false);

  useEffect(() => {
    fetch('/api/master')
      .then(res => res.json())
      .then(data => setSections(data.seksi || []))
      .catch(err => console.error(err));
  }, []);

  const showToast = (msg: string, type: 'success' | 'warning') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadData = async () => {
    if (!selectedSec || !selectedDate) return;
    setLoading(true);
    setLoaded(false);
    setDrafts(new Map());
    setOtHours('');
    try {
      const res = await fetch(`/api/check-bagian?sec_cd=${encodeURIComponent(selectedSec)}&date=${selectedDate}`);
      const json = await res.json();
      if (json.future) {
        setRecords([]);
        showToast(json.message || (lang === 'id' ? 'Tanggal yang dipilih belum terjadi.' : 'Selected date is in the future.'), 'warning');
      } else if (Array.isArray(json)) {
        setRecords(json);
      } else if (json.data) {
        setRecords(json.data);
      } else {
        setRecords([]);
      }
    } catch (err) {
      console.error(err);
      setRecords([]);
    }
    setLoaded(true);
    setLoading(false);
  };

  const generateJamPulang = () => {
    const ot = parseInt(otHours, 10);
    if (isNaN(ot) || ot < 1 || ot > 4) {
      showToast(lang === 'id' ? 'Masukkan jumlah jam lembur (1-4)' : 'Enter OT hours (1-4)', 'warning');
      return;
    }
    const targetHour = 16 + ot;
    const newDrafts = new Map<string, DraftCorrection>();
    records.forEach(r => {
      if (r.ALPHA) return;
      const dateStr = r.DATE_TRANS || selectedDate;
      const inStr = r.MASUK_FULL || r.MASUK || '07:00:00';
      // Randomize minutes 0-10 and seconds 0-59 for natural variation
      const randomMinute = Math.floor(Math.random() * 11);
      const randomSecond = Math.floor(Math.random() * 60);
      const outStr = `${String(targetHour).padStart(2, '0')}:${String(randomMinute).padStart(2, '0')}:${String(randomSecond).padStart(2, '0')}`;
      newDrafts.set(r.NIK, {
        EMP_CD: r.NIK,
        WORK_IN: `${dateStr}T${inStr}`,
        WORK_OUT: `${dateStr}T${outStr}`,
      });
    });
    setDrafts(newDrafts);
    showToast(lang === 'id'
      ? `Jam pulang digenerate ke ${String(targetHour).padStart(2, '0')}:00-${String(targetHour).padStart(2, '0')}:10 untuk ${newDrafts.size} karyawan`
      : `Clock-out generated to ${String(targetHour).padStart(2, '0')}:00-${String(targetHour).padStart(2, '0')}:10 for ${newDrafts.size} employees`, 'success');
  };

  const updateDraftTime = (empCd: string, field: 'WORK_IN' | 'WORK_OUT', timeStr: string) => {
    const existing = drafts.get(empCd) || { EMP_CD: empCd, WORK_IN: null, WORK_OUT: null };
    // timeStr from <input type="time"> step="1" can be HH:MM or HH:MM:SS
    const fullTime = timeStr && timeStr.includes(':') && timeStr.split(':').length === 2 ? `${timeStr}:00` : timeStr;
    const newVal = fullTime ? `${selectedDate}T${fullTime}` : null;
    setDrafts(new Map(drafts).set(empCd, { ...existing, [field]: newVal }));
  };

  const applyAll = async () => {
    if (drafts.size === 0) {
      showToast(lang === 'id' ? 'Tidak ada koreksi untuk diterapkan' : 'No corrections to apply', 'warning');
      return;
    }
    setApplyLoading(true);
    try {
      const corrections = Array.from(drafts.values());
      const res = await fetch('/api/check-bagian', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sec_cd: selectedSec, date: selectedDate, corrections }),
      });
      if (res.ok) {
        const result = await res.json();
        showToast(lang === 'id'
          ? `${result.applied} koreksi berhasil diterapkan!`
          : `${result.applied} corrections applied!`, 'success');
        setDrafts(new Map());
        loadData();
      } else {
        const err = await res.json();
        showToast(lang === 'id' ? 'Gagal: ' + err.error : 'Failed: ' + err.error, 'warning');
      }
    } catch (err) {
      console.error(err);
      showToast(lang === 'id' ? 'Terjadi kendala pada sistem' : 'A system error occurred', 'warning');
    }
    setApplyLoading(false);
  };

  const getStatusBadge = (r: CheckRecord) => {
    if (r.LIBUR) return <span className="badge" style={{ background: 'var(--text-muted)', color: '#fff' }}>LIBUR</span>;
    if (r.ALPHA) return <span className="badge badge-danger">ALPHA</span>;
    if (r.REASON_DESC) {
      const g = r.REASON_GROUP;
      const cls = (g === 'C' || g === 'H') ? 'badge-info' : g === 'S' ? 'badge-warning' : g === 'I' ? 'badge-secondary' : 'badge-gray';
      return <span className={`badge ${cls}`}>{r.REASON_DESC}</span>;
    }
    if (r.STATUS_HARI === 'L' || r.STATUS_HARI === 'LIBUR') return <span className="badge" style={{ background: 'var(--text-muted)', color: '#fff' }}>Libur</span>;
    if (r.MASUK) return <span className="badge badge-success">Hadir</span>;
    return <span className="badge badge-gray">—</span>;
  };

  const getDraftTime = (r: CheckRecord, field: 'WORK_IN' | 'WORK_OUT') => {
    const draft = drafts.get(r.NIK);
    if (!draft) return null;
    const val = draft[field];
    if (!val) return null;
    const match = val.match(/T(\d{2}:\d{2}:\d{2})/);
    return match ? match[1] : val;
  };

  const hasDrafts = drafts.size > 0;
  const sectionName = sections.find(s => s.SEC_CD === selectedSec)?.SEC_DESC || selectedSec;

  return (
    <div className="animate-fadeIn">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">{lang === 'id' ? 'Check Per Bagian' : 'Section Check'}</h1>
          <p className="page-subtitle">
            {lang === 'id'
              ? 'Cek dan koreksi absensi massal berdasarkan bagian dan tanggal'
              : 'Bulk attendance check and correction by section and date'}
          </p>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`toast toast-${toast.type}`} style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 9999 }}>
          {toast.msg}
        </div>
      )}

      {/* Filter Controls */}
      <div className="glass-card" style={{ padding: '20px', marginBottom: '20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '12px', alignItems: 'end' }}>
          <div className="form-group">
            <label className="form-label">{lang === 'id' ? 'Bagian' : 'Section'}</label>
            <select className="form-select" value={selectedSec} onChange={e => setSelectedSec(e.target.value)}>
              <option value="">{lang === 'id' ? '— Pilih Bagian —' : '— Select Section —'}</option>
              {sections.map(s => (
                <option key={s.SEC_CD} value={s.SEC_CD}>{s.SEC_DESC} ({s.SEC_CD})</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">{t(lang, 'tanggal')}</label>
            <input type="date" className="form-input" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} style={{ width: '160px' }} />
          </div>
          <div className="form-group">
            <button className="btn btn-primary" onClick={loadData} disabled={loading || !selectedSec}>
              <Search size={16} /> {lang === 'id' ? 'Tampilkan' : 'Load'}
            </button>
          </div>
        </div>
      </div>

      {/* Generate + Apply Bar */}
      {loaded && records.length > 0 && (
        <div className="glass-card" style={{ padding: '16px 20px', marginBottom: '20px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: '12px' }}>{lang === 'id' ? 'Jam Lembur (1-4)' : 'OT Hours (1-4)'}</label>
              <input
                type="number" className="form-input" min="1" max="4"
                value={otHours} onChange={e => setOtHours(e.target.value)}
                placeholder="2" style={{ width: '80px' }}
              />
            </div>
            <button className="btn btn-secondary" onClick={generateJamPulang} disabled={!otHours} style={{ marginBottom: 0 }}>
              <Clock size={16} /> {lang === 'id' ? 'Generate Jam Pulang' : 'Generate Clock-Out'}
            </button>
          </div>
          {hasDrafts && (
            <button className="btn btn-success" onClick={applyAll} disabled={applyLoading}>
              <CheckSquare size={16} />
              {applyLoading ? (lang === 'id' ? 'Menyimpan...' : 'Saving...') : `${lang === 'id' ? 'Terapkan Semua' : 'Apply All'} (${drafts.size})`}
            </button>
          )}
        </div>
      )}

      {hasDrafts && (
        <div style={{ marginBottom: '12px', padding: '8px 16px', borderRadius: 'var(--radius-md)', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', fontSize: '12px', color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertTriangle size={14} />
          {lang === 'id' ? 'Jam pulang masih draft. Edit per orang jika perlu, lalu klik "Terapkan Semua".' : 'Clock-out times are drafts. Edit individually if needed, then click "Apply All".'}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="glass-card">
          <DataTable>
            <thead>
              <tr>
                <th>NIK</th>
                <th>{t(lang, 'nama')}</th>
                <th>{t(lang, 'jabatan')}</th>
                <th>{t(lang, 'jamMasuk')}</th>
                <th>{t(lang, 'jamPulang')}</th>
                <th>{t(lang, 'alasan')}</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 8 }).map((_, i) => (
                <tr key={i}>
                  <td><Skeleton width={80} height={14} /></td>
                  <td><Skeleton width={140} height={14} /></td>
                  <td><Skeleton width={100} height={14} /></td>
                  <td><Skeleton width={60} height={14} /></td>
                  <td><Skeleton width={60} height={14} /></td>
                  <td><Skeleton width={70} height={20} style={{ borderRadius: '100px' }} /></td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </div>
      )}

      {/* Empty state */}
      {loaded && !loading && records.length === 0 && (
        <div className="glass-card">
          <EmptyState
            icon="document"
            title={lang === 'id' ? 'Tidak Ada Data' : 'No Data'}
            description={lang === 'id' ? 'Pilih bagian dan tanggal untuk melihat data.' : 'Select a section and date to view data.'}
          />
        </div>
      )}

      {/* Data table */}
      {loaded && !loading && records.length > 0 && (
        <div className="glass-card">
          <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', fontWeight: 600 }}>
              {lang === 'id' ? 'Total' : 'Total'}: {records.length} {lang === 'id' ? 'karyawan' : 'employees'}
            </span>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              {selectedDate} · {sectionName}
            </span>
          </div>
          <DataTable>
            <thead>
              <tr>
                <th>NIK</th>
                <th>{t(lang, 'nama')}</th>
                <th>{t(lang, 'jabatan')}</th>
                <th>{lang === 'id' ? 'Masuk' : 'In'}</th>
                <th>{lang === 'id' ? 'Pulang' : 'Out'}</th>
                <th>{t(lang, 'alasan')}</th>
              </tr>
            </thead>
            <tbody>
              {records.map(r => {
                const draftIn = getDraftTime(r, 'WORK_IN');
                const draftOut = getDraftTime(r, 'WORK_OUT');
                const hasDraft = drafts.has(r.NIK);
                return (
                  <tr key={r.NIK} className={r.ALPHA ? 'row-warning' : hasDraft ? 'row-success' : ''}>
                    <td style={{ fontFamily: 'monospace', fontSize: '12px' }}>{r.NIK}</td>
                    <td style={{ fontWeight: 500 }}>{r.NAMA}</td>
                    <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{r.JABATAN || '—'}</td>
                    <td>
                      {hasDraft ? (
                        <input type="time" className="form-input" style={{ width: '110px', fontSize: '12px', padding: '4px 6px' }}
                          value={draftIn || r.MASUK || ''} onChange={e => updateDraftTime(r.NIK, 'WORK_IN', e.target.value)} step="1" />
                      ) : (
                        <span style={{ fontSize: '12px', fontFamily: 'monospace', color: r.MASUK ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                          {r.MASUK || '—'}
                        </span>
                      )}
                    </td>
                    <td>
                      {hasDraft ? (
                        <input type="time" className="form-input" style={{ width: '110px', fontSize: '12px', padding: '4px 6px' }}
                          value={draftOut || r.PULANG || ''} onChange={e => updateDraftTime(r.NIK, 'WORK_OUT', e.target.value)} step="1" />
                      ) : (
                        <span style={{ fontSize: '12px', fontFamily: 'monospace', color: r.PULANG ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                          {r.PULANG || '—'}
                        </span>
                      )}
                      {draftOut && draftOut !== r.PULANG && (
                        <span style={{ fontSize: '10px', color: 'var(--warning)', marginLeft: '6px' }}>↳ {draftOut}</span>
                      )}
                    </td>
                    <td>{getStatusBadge(r)}</td>
                  </tr>
                );
              })}
            </tbody>
          </DataTable>
        </div>
      )}
    </div>
  );
}
