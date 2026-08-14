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

      <div className="glass-card" style={{ padding: '20px', marginBottom: '20px', overflow: 'visible', zIndex: 30 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: '12px', alignItems: 'end' }}>
          <div className="form-group" style={{ position: 'relative' }}>
            <label className="form-label">{lang === 'id' ? 'Cari Karyawan' : 'Search Employee'}</label>
            <div className="search-wrapper">
              <Search size={15} className="search-icon" />
              <input
                className="form-input"
                placeholder={t(lang, 'cariKaryawanAbs')}
                value={searchEmp}
                onChange={e => { setSearchEmp(e.target.value); setSelectedEmp(null); }}
              />
            </div>
            {searchEmp && !selectedEmp && filteredKaryawan.length > 0 && (
              <div className={styles.dropdown}>
                {filteredKaryawan.map(k => (
                  <div key={k.EMP_CD} className={styles.dropdownItem} onClick={() => { setSelectedEmp(k); setSearchEmp(''); }}>
                    <span style={{ color: 'var(--accent-blue)', fontSize: '12px', minWidth: 80, fontWeight: 600 }}>{k.EMP_CD}</span>
                    <span style={{ fontWeight: 500 }}>{k.EMP_NM}</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '11px', marginLeft: 'auto' }}>{k.SEC_DESC || k.SEC_CD}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="form-group">
            <label className="form-label">{t(lang, 'bulan')}</label>
            <select className="form-select" value={bulan} onChange={e => setBulan(Number(e.target.value))} style={{ width: '120px' }}>
              {months.map(m => <option key={m} value={m}>{new Date(2024, m - 1).toLocaleString(lang === 'id' ? 'id-ID' : 'en-US', { month: 'long' })}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">{t(lang, 'tahun')}</label>
            <select className="form-select" value={tahun} onChange={e => setTahun(Number(e.target.value))} style={{ width: '100px' }}>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
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
              <div style={{ fontWeight: 600, fontSize: '14px' }}>{selectedEmp.EMP_NM}</div>
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
