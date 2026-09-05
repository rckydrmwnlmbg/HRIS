'use client';
import React from 'react';
import type { Karyawan, Language } from '@/types';
import { t } from '@/lib/i18n';
import { Search, Clock, ShieldAlert, X } from 'lucide-react';
import styles from './absensi.module.css';

interface AbsensiFilterBarProps {
  searchEmp: string;
  setSearchEmp: (v: string) => void;
  selectedEmp: Karyawan | null;
  setSelectedEmp: (k: Karyawan | null) => void;
  filteredKaryawan: Karyawan[];
  bulan: number;
  setBulan: (b: number) => void;
  tahun: number;
  setTahun: (t: number) => void;
  months: number[];
  years: number[];
  loaded: boolean;
  syncLoading: boolean;
  isSecurity: boolean;
  onSyncModalOpen: () => void;
  onSyncShiftPreview: () => void;
  onLoadAbsensi: () => void;
  onClearEmp: () => void;
  lang: Language;
}

export function AbsensiFilterBar({
  searchEmp,
  setSearchEmp,
  selectedEmp,
  setSelectedEmp,
  filteredKaryawan,
  bulan,
  setBulan,
  tahun,
  setTahun,
  months,
  years,
  loaded,
  syncLoading,
  isSecurity,
  onSyncModalOpen,
  onSyncShiftPreview,
  onLoadAbsensi,
  onClearEmp,
  lang,
}: AbsensiFilterBarProps) {
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const [activeIndex, setActiveIndex] = React.useState<number>(0);

  // ⌨️ SHORTCUT GLOBAL CTRL + K: Fokus langsung ke kolom pencarian karyawan
  React.useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  // Reset indeks aktif ke 0 setiap kali teks pencarian berubah
  React.useEffect(() => {
    setActiveIndex(0);
  }, [searchEmp]);

  // ⬇️⬆️ Navigasi keyboard pada dropdown pencarian karyawan (Panah Bawah, Panah Atas, Enter, Escape)
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!searchEmp || filteredKaryawan.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(prev => (prev + 1) % filteredKaryawan.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(prev => (prev - 1 + filteredKaryawan.length) % filteredKaryawan.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < filteredKaryawan.length) {
        const chosen = filteredKaryawan[activeIndex];
        setSelectedEmp(chosen);
        setSearchEmp('');
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setSearchEmp('');
    }
  };

  return (
    <>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 className="page-title">{t(lang, 'absensiKaryawan')}</h1>
          <p className="page-subtitle">{lang === 'id' ? 'Manajemen dan penyesuaian catatan presensi kehadiran karyawan' : 'Manage and adjust employee attendance records'}</p>
        </div>
        <button 
          className="btn btn-primary" 
          onClick={onSyncModalOpen} 
          disabled={syncLoading}
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <Clock size={16} className={syncLoading ? 'spin' : ''} />
          {syncLoading ? (lang === 'id' ? 'Menyinkronkan...' : 'Syncing...') : (lang === 'id' ? 'Tarik Data Mesin' : 'Sync Device Data')}
        </button>
      </div>

      <div className="glass-card" style={{ padding: '18px 20px', marginBottom: '20px', overflow: 'visible', zIndex: 30 }}>
        <div className={styles.filterGrid}>
          <div className={`form-group ${styles.searchGroup}`}>
            <label className="form-label">{lang === 'id' ? 'Cari Karyawan' : 'Search Employee'}</label>
            <div className="search-wrapper">
              <Search size={15} className="search-icon" />
              <input
                ref={searchInputRef}
                className="form-input"
                placeholder={`${t(lang, 'cariKaryawanAbs')} (Ctrl + K)`}
                value={searchEmp}
                onKeyDown={handleSearchKeyDown}
                onChange={e => { setSearchEmp(e.target.value); setSelectedEmp(null); }}
              />
            </div>
            {searchEmp && !selectedEmp && filteredKaryawan.length > 0 && (
              <div className={styles.dropdown}>
                {filteredKaryawan.map((k, idx) => {
                  const isNonActive = !k.Act_NonAct || String(k.Act_NonAct) === '0';
                  const isActive = idx === activeIndex;
                  return (
                    <div
                      key={k.EMP_CD}
                      className={`${styles.dropdownItem} ${isActive ? styles.dropdownItemActive : ''}`}
                      onMouseEnter={() => setActiveIndex(idx)}
                      onClick={() => { setSelectedEmp(k); setSearchEmp(''); }}
                    >
                      <span style={{ color: 'var(--accent)', fontWeight: 600, minWidth: 65 }}>{k.EMP_CD}</span>
                      <span style={{ fontWeight: isActive ? 600 : 400 }}>{k.EMP_NM}</span>
                      {isNonActive && (
                        <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '4px', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', fontWeight: 600, marginLeft: '6px' }}>
                          Non-Aktif
                        </span>
                      )}
                      {(k.SEC_DESC || k.SEC_CD) && (
                        <span style={{ color: 'var(--text-muted)', fontSize: '11px', marginLeft: 'auto', marginRight: isActive ? '8px' : '0' }}>
                          {k.SEC_DESC || k.SEC_CD}
                        </span>
                      )}
                      {isActive && (
                        <span style={{ fontSize: '11px', color: 'var(--accent)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '2px' }}>
                          ↵ Enter
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <div className="form-group">
            <label className="form-label">{t(lang, 'bulan')}</label>
            <select className={`form-select ${styles.monthSelect}`} value={bulan} onChange={e => setBulan(Number(e.target.value))}>
              {months.map(m => <option key={m} value={m}>{new Date(2024, m - 1).toLocaleString(lang === 'id' ? 'id-ID' : 'en-US', { month: 'long' })}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">{t(lang, 'tahun')}</label>
            <select className={`form-select ${styles.yearSelect}`} value={tahun} onChange={e => setTahun(Number(e.target.value))}>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div className={`form-group ${styles.btnGroup}`}>
            {loaded && isSecurity && (
              <button className="btn btn-secondary" onClick={onSyncShiftPreview} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ShieldAlert size={14} /> {lang === 'id' ? 'Sinkronkan Shift' : 'Sync Shift'}
              </button>
            )}
            <button className="btn btn-primary" onClick={onLoadAbsensi} disabled={!selectedEmp}>
              {t(lang, 'tampilkanAbsensi')}
            </button>
          </div>
        </div>

        {selectedEmp && (
          <div style={{ marginTop: '14px', padding: '12px 16px', background: 'rgba(14, 165, 233, 0.08)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(14, 165, 233, 0.22)', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-dark))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#fff', flexShrink: 0 }}>
              {selectedEmp.EMP_NM.charAt(0)}
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>{selectedEmp.EMP_NM}</span>
                {(!selectedEmp.Act_NonAct || String(selectedEmp.Act_NonAct) === '0') && (
                  <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '4px', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', fontWeight: 600 }}>
                    Non-Aktif
                  </span>
                )}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                {selectedEmp.EMP_CD} · {['1', 'Y', 'TRUE'].includes(String(selectedEmp.ALL_IN).toUpperCase()) ? 'ALL IN' : 'HARIAN'} · {selectedEmp.TEAM || selectedEmp.JOB_DESC || selectedEmp.JOB_CD} · {selectedEmp.SEC_DESC || selectedEmp.SEC_CD}
              </div>
            </div>
            <button className="btn btn-sm btn-secondary btn-icon" style={{ marginLeft: 'auto' }} onClick={onClearEmp} title="Hapus Karyawan Terpilih">
              <X size={14} />
            </button>
          </div>
        )}
      </div>
    </>
  );
}
