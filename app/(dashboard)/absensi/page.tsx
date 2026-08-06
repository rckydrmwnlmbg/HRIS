'use client';
import { useState, useEffect, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'next/navigation';
import { useApp } from '@/lib/context';
import { t } from '@/lib/i18n';
import type { Karyawan, AbsensiRecord, Reason } from '@/types';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { DataTable } from '@/components/ui/DataTable';
import { STATUS_HARI_MAP } from '@/types';
import { Search, AlertCircle, CheckCircle, Clock, Edit2, CheckSquare, X, CloudDownload, ShieldAlert, ShieldCheck } from 'lucide-react';
import styles from './absensi.module.css';

function AbsensiContent() {
  const { settings, user } = useApp();
  const lang = settings.language;
  const searchParams = useSearchParams();
  const empParam = searchParams.get('emp');

  const now = new Date();
  const [searchEmp, setSearchEmp] = useState('');
  const [selectedEmp, setSelectedEmp] = useState<Karyawan | null>(null);
  const [bulan, setBulan] = useState(now.getMonth() + 1);
  const [tahun, setTahun] = useState(now.getFullYear());
  const [records, setRecords] = useState<AbsensiRecord[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [koreksiTarget, setKoreksiTarget] = useState<AbsensiRecord | null>(null);
  const [rekapDetailMode, setRekapDetailMode] = useState<string | null>(null);
  const [draftKoreksi, setDraftKoreksi] = useState<Partial<AbsensiRecord & { notes: string }>>({});
  const [corrections, setCorrections] = useState<Map<string, AbsensiRecord>>(new Map());
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'warning' } | null>(null);
  const [masterReasons, setMasterReasons] = useState<Reason[]>([]);
  const [karyawanList, setKaryawanList] = useState<Karyawan[]>([]);
  
  // Sync States
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [syncStart, setSyncStart] = useState('');
  const [syncEnd, setSyncEnd] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);

  const syncParam = searchParams.get('sync');
  useEffect(() => {
    if (syncParam === 'true') {
      const hMin1 = new Date();
      hMin1.setDate(hMin1.getDate() - 1);
      const defaultDate = hMin1.toISOString().split('T')[0];
      setSyncStart(defaultDate);
      setSyncEnd(defaultDate);
      if (selectedEmp) {
        setShowSyncModal(true);
      }
      window.history.replaceState(null, '', '/absensi');
    }
  }, [syncParam, selectedEmp]);

  // Load masters and initial params
  useEffect(() => {
    async function loadMaster() {
      try {
        const res = await fetch('/api/master');
        if (res.ok) {
          const data = await res.json();
          setMasterReasons(data.reasons || []);
        }
      } catch (err) { console.error('Error loading master reasons:', err); }
    }
    loadMaster();
  }, []);

  useEffect(() => {
    async function fetchEmpList() {
      try {
        const res = await fetch('/api/karyawan?status=aktif&limit=10000');
        if (res.ok) {
          const json = await res.json();
          const data = Array.isArray(json) ? json : (json.data || []);
          setKaryawanList(data);

          if (empParam) {
            const k = data.find((x: Karyawan) => x.EMP_CD === empParam);
            if (k) {
              setSelectedEmp(k);
              setSearchEmp('');
              loadAbsensi(k.EMP_CD, bulan, tahun);
            }
          }
        }
      } catch (err) { console.error('Error fetching employees:', err); }
    }
    fetchEmpList();
  }, [empParam]);

  const filteredKaryawan = karyawanList.filter(k =>
    searchEmp && (
      String(k.EMP_CD || '').toLowerCase().includes(searchEmp.toLowerCase()) ||
      String(k.EMP_NM || '').toLowerCase().includes(searchEmp.toLowerCase())
    )
  ).slice(0, 8);

  const loadAbsensi = async (empCd: string, bln: number, thn: number) => {
    setLoaded(false);
    try {
      const res = await fetch(`/api/absensi?emp=${empCd}&bulan=${bln}&tahun=${thn}`);
      if (res.ok) {
        const data = await res.json();
        setRecords(data);
      } else {
        setRecords([]);
      }
    } catch (error) {
      console.error(error);
      setRecords([]);
    }
    setLoaded(true);
  };

  const selectEmployee = (k: Karyawan) => {
    setSelectedEmp(k);
    setSearchEmp('');
    loadAbsensi(k.EMP_CD, bulan, tahun);
  };

  const handleLoadAbsensi = () => {
    if (selectedEmp) loadAbsensi(selectedEmp.EMP_CD, bulan, tahun);
  };

  const isJamKosong = (r: AbsensiRecord) => {
    const status = (r.STATUS_HARI || '').trim().toUpperCase();
    const hasIn = !(!r.WORK_IN || r.WORK_IN.toString().trim() === '' || r.WORK_IN.toString().includes('00:00:00'));
    const hasOut = !(!r.WORK_OUT || r.WORK_OUT.toString().trim() === '' || r.WORK_OUT.toString().includes('00:00:00'));
    return (status === 'O' || status === 'KERJA' || status === '') && ((hasIn && !hasOut) || (!hasIn && hasOut));
  };

  const showToast = (msg: string, type: 'success' | 'warning') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleSaveDraft = () => {
    if (!koreksiTarget) return;
    const key = koreksiTarget.DATE_TRANS;

    let newWorkIn = koreksiTarget.WORK_IN;
    let newWorkOut = koreksiTarget.WORK_OUT;

    const dateStr = koreksiTarget.DATE_TRANS.split('T')[0];

    if (draftKoreksi.WORK_IN && typeof draftKoreksi.WORK_IN === 'string') {
      const [h, m, s = '0'] = (draftKoreksi.WORK_IN as unknown as string).split(':');
      newWorkIn = `${dateStr}T${h.padStart(2, '0')}:${m.padStart(2, '0')}:${s.padStart(2, '0')}.000`;
    } else if (draftKoreksi.WORK_IN === '') {
      newWorkIn = null as any;
    }

    if (draftKoreksi.WORK_OUT && typeof draftKoreksi.WORK_OUT === 'string') {
      const [h, m, s = '0'] = (draftKoreksi.WORK_OUT as unknown as string).split(':');
      newWorkOut = `${dateStr}T${h.padStart(2, '0')}:${m.padStart(2, '0')}:${s.padStart(2, '0')}.000`;
    } else if (draftKoreksi.WORK_OUT === '') {
      newWorkOut = null as any;
    }

    const updated: AbsensiRecord = {
      ...koreksiTarget,
      WORK_IN: newWorkIn,
      WORK_OUT: newWorkOut,
      corrected_reason: draftKoreksi.corrected_reason || null,
      corrected_status: draftKoreksi.corrected_status || null,
      correction_status: 'draft',
      correction_by: user?.nama || 'Admin',
      correction_at: new Date().toISOString(),
    };

    // Hapus _STR agar fallback selalu menggunakan jam baru (WORK_IN/WORK_OUT Date)
    delete (updated as any).WORK_IN_STR;
    delete (updated as any).WORK_OUT_STR;
    delete (updated as any).WORK_IN1_STR;
    delete (updated as any).WORK_OUT1_STR;

    setCorrections(prev => new Map(prev).set(key, updated));
    setKoreksiTarget(null);
    showToast(lang === 'id' ? 'Draft koreksi tersimpan' : 'Draft correction saved', 'warning');
  };

  const handleApply = async (key: string) => {
    const rec = corrections.get(key);
    if (!rec) return;

    try {
      const res = await fetch('/api/absensi/koreksi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          DATE_TRANS: rec.DATE_TRANS,
          EMP_CD: rec.EMP_CD,
          WORK_IN: rec.WORK_IN,
          WORK_OUT: rec.WORK_OUT,
          corrected_status: rec.corrected_status,
          corrected_reason: rec.corrected_reason,
          notes: draftKoreksi.notes || '',
          correction_by: user?.nama || 'Admin'
        })
      });

      if (res.ok) {
        setCorrections(prev => {
          const map = new Map(prev);
          map.set(key, { ...rec, correction_status: 'applied' });
          return map;
        });
        showToast(lang === 'id' ? 'Penyesuaian presensi berhasil diterapkan!' : 'Attendance adjustment applied successfully!', 'success');
        handleLoadAbsensi();
      } else {
        const err = await res.json();
        showToast(lang === 'id' ? 'Gagal menyimpan: ' + err.error : 'Failed to save: ' + err.error, 'warning');
      }
    } catch (err) {
      console.error(err);
      showToast(lang === 'id' ? 'Terjadi kendala pada sistem' : 'A system error occurred', 'warning');
    }
  };

  const handleApplyAll = async () => {
    const drafts = Array.from(corrections.entries()).filter(([_, rec]) => rec.correction_status !== 'applied');
    if (drafts.length === 0) return;
    
    let successCount = 0;
    for (const [key, rec] of drafts) {
      try {
        const res = await fetch('/api/absensi/koreksi', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            DATE_TRANS: rec.DATE_TRANS,
            EMP_CD: rec.EMP_CD,
            WORK_IN: rec.WORK_IN,
            WORK_OUT: rec.WORK_OUT,
            corrected_status: rec.corrected_status,
            corrected_reason: rec.corrected_reason,
            notes: draftKoreksi.notes || '',
            correction_by: user?.nama || 'Admin'
          })
        });

        if (res.ok) {
          setCorrections(prev => {
            const map = new Map(prev);
            map.set(key, { ...rec, correction_status: 'applied' });
            return map;
          });
          successCount++;
        }
      } catch (e) {
        console.error(e);
      }
    }
    
    if (successCount > 0) {
      showToast(lang === 'id' ? `${successCount} koreksi berhasil diterapkan!` : `${successCount} corrections applied!`, 'success');
      handleLoadAbsensi();
    }
  };


  const getDisplayRecord = (r: AbsensiRecord): AbsensiRecord => {
    return corrections.get(r.DATE_TRANS) || r;
  };

  const normalizeStatus = (s: string) => (s || '').trim().toUpperCase();

  const getStatusBadge = (status: string) => {
    const norm = normalizeStatus(status);
    const info = STATUS_HARI_MAP[norm] || { label_id: status, label_en: status, color: '#888' };

    let cls = 'badge-gray';
    if (norm === 'O' || norm === 'KERJA') cls = 'badge-hadir';
    else if (norm === 'A' || norm === 'ALPHA') cls = 'badge-alpha';
    else if (norm === 'I' || norm === 'IJIN') cls = 'badge-izin';
    else if (norm === 'C' || norm === 'CUTI') cls = 'badge-cuti';
    else if (norm === 'H' || norm === 'HAID') cls = 'badge-haid';
    else if (norm === 'S' || norm === 'SAKIT') cls = 'badge-sakit';
    else if (norm === 'L' || norm === 'LIBUR') cls = 'badge-libur';

    return <span className={`badge ${cls}`}>{lang === 'id' ? (info.label_id || status) : (info.label_en || status)}</span>;
  };

  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const years = [2024, 2025, 2026];

  // Rekapitulasi
  const rekap = records.reduce((acc, r) => {
    let key = 'O'; // Default Hadir
    const statusHari = normalizeStatus(r.STATUS_HARI);
    const reasonGroup = r.REASON_GROUP ? normalizeStatus(r.REASON_GROUP) : '';

    if (statusHari === 'L' || statusHari === 'LIBUR') {
      key = 'L'; // Libur
    } else if (r.REASON && reasonGroup) {
      if (['C', 'CUTI'].includes(reasonGroup)) key = 'C';
      else if (['S', 'SAKIT'].includes(reasonGroup)) key = 'S';
      else if (['A', 'ALPHA'].includes(reasonGroup)) key = 'A';
      else if (['I', 'IJIN'].includes(reasonGroup)) key = 'I';
    }

    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const rekapDetailRecords = rekapDetailMode ? records.filter(r => {
    let key = 'O'; // Default Hadir
    const statusHari = normalizeStatus(r.STATUS_HARI);
    const reasonGroup = r.REASON_GROUP ? normalizeStatus(r.REASON_GROUP) : '';
    
    if (statusHari === 'L' || statusHari === 'LIBUR') {
      key = 'L'; // Libur
    } else if (r.REASON && reasonGroup) {
      if (['C', 'CUTI'].includes(reasonGroup)) key = 'C';
      else if (['S', 'SAKIT'].includes(reasonGroup)) key = 'S';
      else if (['A', 'ALPHA'].includes(reasonGroup)) key = 'A';
      else if (['I', 'IJIN'].includes(reasonGroup)) key = 'I';
    }
    
    return key === rekapDetailMode;
  }) : [];

  const isSecurityEmployee = (emp: Karyawan | null) => {
    if (!emp) return false;
    const job = (emp.JOB_DESC || emp.JOB_CD || '').toUpperCase();
    const sec = (emp.SEC_DESC || emp.SEC_CD || '').toUpperCase();
    return job.includes('SECURITY') || job.includes('SATPAM') || sec.includes('SECURITY') || sec.includes('SATPAM');
  };

  const handleOpenSyncModal = () => {
    if (!selectedEmp) {
      showToast(
        lang === 'id'
          ? 'Silakan tentukan personel terlebih dahulu sebelum melakukan sinkronisasi presensi.'
          : 'Please select an employee before performing attendance synchronization.',
        'warning'
      );
      return;
    }
    const hMin1 = new Date();
    hMin1.setDate(hMin1.getDate() - 1);
    const defaultDate = hMin1.toISOString().split('T')[0];
    setSyncStart(defaultDate);
    setSyncEnd(defaultDate);
    setShowSyncModal(true);
  };

  return (
    <div className="animate-fadeIn">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title">{t(lang, 'absensiKaryawan')}</h1>
          <p className="page-subtitle">{lang === 'id' ? 'Manajemen dan penyesuaian catatan presensi kehadiran karyawan' : 'Manage and adjust employee attendance records'}</p>
        </div>
        <button 
          className="btn btn-warning" 
          onClick={handleOpenSyncModal}
          title={selectedEmp ? `Sinkronisasi presensi untuk NIK ${selectedEmp.EMP_CD}` : (lang === 'id' ? 'Pilih karyawan terlebih dahulu' : 'Select an employee first')}
        >
          <CloudDownload size={16} /> {selectedEmp ? `${lang === 'id' ? 'Sinkronisasi Kehadiran' : 'Sync Attendance'} (${selectedEmp.EMP_CD})` : (lang === 'id' ? 'Sinkronisasi Kehadiran' : 'Sync Attendance')}
        </button>
      </div>

      {/* Search + Filter */}
      <div className="glass-card" style={{ padding: '20px', marginBottom: '20px', overflow: 'visible', zIndex: 100 }}>
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
                  <div key={k.EMP_CD} className={styles.dropdownItem} onClick={() => selectEmployee(k)}>
                    <span style={{ color: 'var(--accent-blue)', fontSize: '12px', minWidth: 80 }}>{k.EMP_CD}</span>
                    <span>{k.EMP_NM}</span>
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
          <div className="form-group" style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-primary" onClick={handleLoadAbsensi} disabled={!selectedEmp}>
              {t(lang, 'tampilkanAbsensi')}
            </button>
          </div>
        </div>

        {selectedEmp && (
          <div style={{ marginTop: '12px', padding: '10px 14px', background: 'rgba(79,158,248,0.08)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(79,158,248,0.2)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,var(--accent-blue),var(--accent-dark))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#fff', flexShrink: 0 }}>{selectedEmp.EMP_NM.charAt(0)}</div>
            <div>
              <div style={{ fontWeight: 600 }}>{selectedEmp.EMP_NM}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{selectedEmp.EMP_CD} · {['1', 'Y', 'TRUE'].includes(String(selectedEmp.ALL_IN).toUpperCase()) ? 'ALL IN' : 'HARIAN'} · {selectedEmp.TEAM || selectedEmp.JOB_DESC || selectedEmp.JOB_CD} · {selectedEmp.SEC_DESC || selectedEmp.SEC_CD}</div>
            </div>
            <button className="btn btn-sm btn-secondary btn-icon" style={{ marginLeft: 'auto' }} onClick={() => { setSelectedEmp(null); setSearchEmp(''); setRecords([]); setLoaded(false); }}>
              <X size={13} />
            </button>
          </div>
        )}
      </div>

      {loaded && records.length > 0 && (
        <>
          {/* Rekap */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '10px', marginBottom: '20px' }}>
            {Object.entries(STATUS_HARI_MAP).filter(([code]) => code !== 'L').map(([code, info]) => (
              <div 
                key={code} 
                className="glass-card" 
                style={{ padding: '14px', textAlign: 'center', cursor: 'pointer', transition: 'transform 0.1s' }}
                onClick={() => setRekapDetailMode(code)}
                onMouseOver={e => e.currentTarget.style.transform = 'scale(1.02)'}
                onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
              >
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: info.color }}>{rekap[code] || 0}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>{lang === 'id' ? info.label_id : info.label_en}</div>
              </div>
            ))}
          </div>

          {/* Table */}
          <div className="glass-card">
            {Array.from(corrections.values()).some(c => c.correction_status !== 'applied') && (
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(39,174,96,0.1)' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--success)' }}>
                  {lang === 'id' ? 'Ada koreksi yang belum diterapkan (Draft)' : 'There are unapplied corrections (Draft)'}
                </span>
                <button className="btn btn-sm btn-success" onClick={handleApplyAll}>
                  <CheckSquare size={14} /> {lang === 'id' ? 'Terapkan Semua' : 'Apply All'} ({Array.from(corrections.values()).filter(c => c.correction_status !== 'applied').length})
                </button>
              </div>
            )}
            <DataTable>
                <thead>
                  <tr>
                    <th>{t(lang, 'tanggal')}</th>
                    <th>{t(lang, 'statusHari')}</th>
                    <th>{t(lang, 'dataAsli')}</th>
                    <th>{t(lang, 'dataKoreksi')}</th>
                    <th>{t(lang, 'jamKerja')}</th>
                    <th>{lang === 'id' ? 'Lembur' : 'OT'}</th>
                    <th style={{ textAlign: 'center' }}>{t(lang, 'koreksi')}</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map(r => {
                    const disp = getDisplayRecord(r);
                    const kosong = isJamKosong(r);
                    const hasCorrection = corrections.has(r.DATE_TRANS);
                    const corrStatus = disp.correction_status;
                    return (
                      <tr key={r.DATE_TRANS} className={kosong ? 'row-warning' : hasCorrection && corrStatus === 'applied' ? 'row-success' : ''}>
                        <td>
                          <div style={{ fontWeight: 500 }}>
                            {new Date(r.DATE_TRANS).toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-US', { weekday: 'short', day: '2-digit', month: 'short' })}
                          </div>
                        </td>
                        <td>{getStatusBadge(disp.corrected_status || r.STATUS_HARI)}</td>
                        <td>
                          {(r as any).WORK_IN1 || (r as any).WORK_OUT1 ? (
                            <div style={{ fontSize: '12px' }}>
                              {(r as any).WORK_IN1_STR ? <span style={{ color: 'var(--success)' }}>{lang === 'id' ? 'Masuk' : 'In'}: {(r as any).WORK_IN1_STR.split(' ')[1]}</span> : ((r as any).WORK_IN1 ? <span style={{ color: 'var(--success)' }}>{lang === 'id' ? 'Masuk' : 'In'}: {new Date((r as any).WORK_IN1).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span> : <span style={{ color: 'var(--danger)' }}>{lang === 'id' ? 'Masuk' : 'In'}: --:--:--</span>)}
                              {' · '}
                              {(r as any).WORK_OUT1_STR ? <span style={{ color: 'var(--info)' }}>{lang === 'id' ? 'Pulang' : 'Out'}: {(r as any).WORK_OUT1_STR.split(' ')[1]}</span> : ((r as any).WORK_OUT1 ? <span style={{ color: 'var(--info)' }}>{lang === 'id' ? 'Pulang' : 'Out'}: {new Date((r as any).WORK_OUT1).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span> : <span style={{ color: 'var(--danger)' }}>{lang === 'id' ? 'Pulang' : 'Out'}: --:--:--</span>)}
                            </div>
                          ) : (
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>
                              {normalizeStatus(r.STATUS_HARI) === 'L' || normalizeStatus(r.STATUS_HARI) === 'LIBUR' ? (lang === 'id' ? 'Hari Libur' : 'Holiday') : (r.REASON ? (masterReasons.find(mr => mr.REASON_CODE === r.REASON)?.REASON_DESC || r.REASON) : (lang === 'id' ? 'Belum ada catatan presensi' : 'No attendance record'))}
                            </div>
                          )}
                          {kosong && !r.REASON && <span className={`badge badge-warning`} style={{ marginTop: '2px', fontSize: '10px' }}>⚠ {t(lang, 'jamKosongLabel')}</span>}
                        </td>
                        <td>
                          {hasCorrection || (r.WORK_IN_STR !== r.DATE_IN_STR || r.WORK_OUT_STR !== r.DATE_OUT_STR) ? (
                            <div style={{ fontSize: '12px' }}>
                              {hasCorrection && (
                                <span className={`badge ${corrStatus === 'applied' ? 'badge-success' : 'badge-warning'}`} style={{ marginBottom: '4px', display: 'inline-block' }}>
                                  {corrStatus === 'applied' ? '✓ ' + t(lang, 'applied') : '⏳ ' + t(lang, 'draft')}
                                </span>
                              )}
                              <div>
                                {disp.WORK_IN_STR || (hasCorrection && disp.WORK_IN) ? <span style={{ color: 'var(--success)' }}>{lang === 'id' ? 'Masuk' : 'In'}: {(disp as any).WORK_IN_STR ? (disp as any).WORK_IN_STR.split(' ')[1] : new Date(disp.WORK_IN!).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span> : <span style={{ color: 'var(--text-secondary)' }}>{lang === 'id' ? 'Masuk' : 'In'}: --:--:--</span>}
                                {' · '}
                                {disp.WORK_OUT_STR || (hasCorrection && disp.WORK_OUT) ? <span style={{ color: 'var(--info)' }}>{lang === 'id' ? 'Pulang' : 'Out'}: {(disp as any).WORK_OUT_STR ? (disp as any).WORK_OUT_STR.split(' ')[1] : new Date(disp.WORK_OUT!).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span> : <span style={{ color: 'var(--text-secondary)' }}>{lang === 'id' ? 'Pulang' : 'Out'}: --:--:--</span>}
                              </div>
                              {disp.corrected_reason && <div style={{ color: 'var(--text-secondary)', marginTop: '2px' }}>{masterReasons.find(mr => mr.REASON_CODE === disp.corrected_reason)?.REASON_DESC}</div>}
                              {corrStatus === 'draft' && (
                                <button className="btn btn-sm btn-success" style={{ marginTop: '4px', fontSize: '10px', padding: '3px 8px' }} onClick={() => handleApply(r.DATE_TRANS)}>
                                  <CheckSquare size={11} /> {t(lang, 'terapkan')}
                                </button>
                              )}
                            </div>
                          ) : <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>—</span>}
                        </td>
                        <td>
                          <span style={{ fontSize: '12px', fontFamily: 'monospace' }}>
                            {r.JAM_KERJA != null ? `${r.JAM_KERJA.toFixed(1)} jam` : '—'}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontSize: '12px', color: (r.OT1 || 0) > 0 ? 'var(--warning)' : 'var(--text-muted)', fontFamily: 'monospace' }}>
                            {(r.OT1 || 0) > 0 ? `${r.OT1}j` : '—'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {r.STATUS_HARI !== 'L' && (
                            <button
                              className="btn btn-sm btn-secondary btn-icon"
                              title={t(lang, 'koreksi')}
                              onClick={() => {
                                setKoreksiTarget(r);

                                const getHHMMSS = (d: any, str?: string) => {
                                  if (str) return str.split(' ')[1];
                                  if (!d) return '';
                                  const dt = new Date(d);
                                  return `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}:${String(dt.getSeconds()).padStart(2, '0')}`;
                                };

                                setDraftKoreksi({
                                  corrected_reason: disp.corrected_reason || r.REASON || '',
                                  corrected_status: disp.corrected_status || r.STATUS_HARI,
                                  WORK_IN: getHHMMSS(disp.WORK_IN, (disp as any).WORK_IN_STR),
                                  WORK_OUT: getHHMMSS(disp.WORK_OUT, (disp as any).WORK_OUT_STR)
                                });
                              }}
                            >
                              <Edit2 size={13} />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
            </DataTable>
          </div>
        </>
      )}

      {loaded && records.length === 0 && (
        <div className="glass-card">
          <EmptyState 
            icon="document"
            title={lang === 'id' ? 'Tidak Ada Data' : 'No Data Found'}
            description={lang === 'id' ? 'Tidak ada data absensi untuk periode ini.' : 'No attendance data for this period.'}
          />
        </div>
      )}

      {!selectedEmp && !loaded && (
        <div className="glass-card">
          <EmptyState 
            icon="search"
            title={lang === 'id' ? 'Cari Karyawan' : 'Search Employee'}
            description={lang === 'id' ? 'Ketik NIK atau nama di kolom pencarian di atas untuk mulai melihat dan mengoreksi data absensi.' : 'Type employee ID or name in the search field above to view and correct attendance.'}
          />
        </div>
      )}

      {!loaded && selectedEmp && (
        <div className="glass-card">
           <DataTable>
                <thead>
                  <tr>
                    <th>{t(lang, 'tanggal')}</th>
                    <th>{t(lang, 'statusHari')}</th>
                    <th>{t(lang, 'dataAsli')}</th>
                    <th>{t(lang, 'dataKoreksi')}</th>
                    <th>{t(lang, 'jamKerja')}</th>
                    <th>{lang === 'id' ? 'Lembur' : 'OT'}</th>
                    <th style={{ textAlign: 'center' }}>{t(lang, 'koreksi')}</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 10 }).map((_, i) => (
                    <tr key={i}>
                      <td><Skeleton width={100} height={16} /></td>
                      <td><Skeleton width={60} height={20} style={{ borderRadius: '100px' }} /></td>
                      <td>
                        <Skeleton width={120} height={12} style={{ marginBottom: 4 }} />
                        <Skeleton width={120} height={12} />
                      </td>
                      <td><Skeleton width={120} height={16} /></td>
                      <td><Skeleton width={50} height={16} /></td>
                      <td><Skeleton width={50} height={16} /></td>
                      <td style={{ textAlign: 'center' }}><Skeleton variant="circle" width={24} height={24} style={{ margin: '0 auto' }} /></td>
                    </tr>
                  ))}
                </tbody>
           </DataTable>
        </div>
      )}

      {/* Koreksi Modal */}
      {koreksiTarget && typeof document !== 'undefined' && createPortal(
        <div className="modal-overlay" onClick={() => setKoreksiTarget(null)}>
          <div className="modal" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">✏️ {t(lang, 'formKoreksi')}</h3>
              <button className="btn btn-sm btn-secondary btn-icon" onClick={() => setKoreksiTarget(null)}><X size={14} /></button>
            </div>
            <div className="modal-body">
              <div style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius-md)', marginBottom: '16px', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>{t(lang, 'tanggal')}</div>
                <div style={{ fontWeight: 600 }}>{new Date(koreksiTarget.DATE_TRANS).toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '8px' }}>{t(lang, 'dataAsli')}:</div>
                <div style={{ fontFamily: 'monospace', fontSize: '13px' }}>
                  IN: {(koreksiTarget as any).WORK_IN1 ? ((koreksiTarget as any).WORK_IN1_STR?.split(' ')[1] || new Date((koreksiTarget as any).WORK_IN1).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })) : '⚠ Kosong'}
                  {' · '}
                  OUT: {(koreksiTarget as any).WORK_OUT1 ? ((koreksiTarget as any).WORK_OUT1_STR?.split(' ')[1] || new Date((koreksiTarget as any).WORK_OUT1).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })) : '⚠ Kosong'}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">{t(lang, 'statusHari')}</label>
                    <select
                      className="form-select"
                      value={draftKoreksi.corrected_status || ''}
                      onChange={e => setDraftKoreksi(p => ({ ...p, corrected_status: e.target.value }))}
                    >
                      <option value="KERJA">KERJA</option>
                      <option value="L">LIBUR</option>
                      <option value="O">OFF (O)</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">{t(lang, 'alasan')}</label>
                    <select
                      className="form-select"
                      value={draftKoreksi.corrected_reason || ''}
                      onChange={e => setDraftKoreksi(p => ({ ...p, corrected_reason: e.target.value }))}
                    >
                      <option value="">-- Tidak Ada Alasan --</option>
                      {masterReasons.map(r => (
                        <option key={r.REASON_CODE} value={r.REASON_CODE}>[{r.REASON_CODE}] {r.REASON_DESC}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">{lang === 'id' ? 'Waktu Masuk Disesuaikan' : 'Adjusted Clock In'}</label>
                    <input
                      type="time"
                      step="1"
                      className="form-input"
                      value={draftKoreksi.WORK_IN as unknown as string || ''}
                      onChange={e => setDraftKoreksi(p => ({ ...p, WORK_IN: e.target.value }))}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">{lang === 'id' ? 'Waktu Pulang Disesuaikan' : 'Adjusted Clock Out'}</label>
                    <input
                      type="time"
                      step="1"
                      className="form-input"
                      value={draftKoreksi.WORK_OUT as unknown as string || ''}
                      onChange={e => setDraftKoreksi(p => ({ ...p, WORK_OUT: e.target.value }))}
                    />
                  </div>
                </div>

                <div style={{ padding: '10px 14px', background: 'rgba(245,158,11,0.08)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(245,158,11,0.2)', fontSize: '12px', color: 'var(--warning)' }}>
                  ℹ {lang === 'id'
                    ? 'Rekaman presensi awal akan tetap diarsipkan dengan aman sebagai data historis.'
                    : 'Original attendance records remain safely archived as history.'}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setKoreksiTarget(null)}>{t(lang, 'batal')}</button>
              <button
                className="btn btn-warning"
                onClick={handleSaveDraft}
              >
                <Clock size={14} /> {t(lang, 'simpanDraft')}
              </button>
            </div>
          </div>
        </div>
      , document.body)}

      {/* Sync Modal */}
      {showSyncModal && selectedEmp && (
        <div className="modal-overlay" onClick={() => !isSyncing && setShowSyncModal(false)}>
          <div className="modal" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            {isSecurityEmployee(selectedEmp) ? (
              <>
                <div className="modal-header">
                  <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ShieldAlert size={20} color="var(--accent-orange)" />
                    {lang === 'id' ? 'Proteksi Presensi Divisi Pengamanan' : 'Security Attendance Protection'}
                  </h3>
                  <button className="btn btn-sm btn-secondary btn-icon" onClick={() => setShowSyncModal(false)}><X size={14} /></button>
                </div>
                <div className="modal-body">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', background: 'rgba(245,158,11,0.08)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(245,158,11,0.25)', marginBottom: '16px' }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg,#f59e0b,#d97706)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                      {selectedEmp.EMP_NM.charAt(0)}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>{selectedEmp.EMP_NM}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        NIK: <span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--text-primary)' }}>{selectedEmp.EMP_CD}</span>
                        {selectedEmp.SEC_DESC ? ` · ${selectedEmp.SEC_DESC}` : ''}
                        {selectedEmp.JOB_DESC ? ` · ${selectedEmp.JOB_DESC}` : ''}
                      </div>
                    </div>
                  </div>

                  <div style={{ padding: '14px', background: 'rgba(59,130,246,0.06)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(59,130,246,0.2)', fontSize: '13px', lineHeight: '1.6', color: 'var(--text-primary)', marginBottom: '12px' }}>
                    <p style={{ margin: '0 0 8px 0', fontWeight: 600, color: 'var(--accent-blue)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <ShieldCheck size={16} /> {lang === 'id' ? 'Jadwal Khusus Rotasi Shift Terlindungi' : 'Protected Shift Rotation Schedule'}
                    </p>
                    <p style={{ margin: '0 0 8px 0' }}>
                      {lang === 'id'
                        ? 'Personel ini beroperasi dengan sistem kerja rotasi shift khusus (Shift Pagi, Siang, dan Malam).'
                        : 'This employee operates under specialized shift rotations (Morning, Afternoon, and Night Shifts).'}
                    </p>
                    <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
                      {lang === 'id'
                        ? 'Untuk menjaga keutuhan serta akurasi rekaman jam tugas jaga pos dan serah terima dinas operasional, proses penyesuaian toleransi jam kantor reguler otomatis dikecualikan pada personel ini.'
                        : 'To maintain the integrity of security post duty logs and shifts handover, regular office tolerance adjustments are safely excluded for this employee.'}
                    </p>
                  </div>
                </div>
                <div className="modal-footer">
                  <button className="btn btn-primary" onClick={() => setShowSyncModal(false)} style={{ width: '100%' }}>
                    {lang === 'id' ? 'Saya Mengerti' : 'I Understand'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="modal-header">
                  <h3 className="modal-title">☁️ {lang === 'id' ? 'Sinkronisasi Presensi Personel' : 'Employee Attendance Synchronization'}</h3>
                  <button className="btn btn-sm btn-secondary btn-icon" onClick={() => !isSyncing && setShowSyncModal(false)}><X size={14} /></button>
                </div>
                <div className="modal-body">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', background: 'rgba(79,158,248,0.08)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(79,158,248,0.2)', marginBottom: '14px' }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg,var(--accent-blue),var(--accent-dark))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                      {selectedEmp.EMP_NM.charAt(0)}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>{selectedEmp.EMP_NM}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        NIK: <span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--text-primary)' }}>{selectedEmp.EMP_CD}</span>
                        {selectedEmp.SEC_DESC ? ` · ${selectedEmp.SEC_DESC}` : ''}
                        {selectedEmp.JOB_DESC ? ` · ${selectedEmp.JOB_DESC}` : ''}
                      </div>
                    </div>
                  </div>

                  <div style={{ padding: '12px', background: 'rgba(59,130,246,0.08)', borderRadius: 'var(--radius-md)', marginBottom: '16px', border: '1px solid rgba(59,130,246,0.2)', fontSize: '13px', lineHeight: '1.5' }}>
                    {['1', 'Y', 'TRUE'].includes(String(selectedEmp.ALL_IN).toUpperCase()) ? (
                      lang === 'id'
                        ? `Personel ini memiliki status paket kerja ALL IN. Proses ini akan menyelaraskan catatan kehadiran dengan data jam kerja riil (rekaman asli mesin presensi) untuk ${selectedEmp.EMP_NM} (NIK: ${selectedEmp.EMP_CD}) tanpa pengacakan toleransi jam kantor reguler, serta mengkalkulasi lembur secara normal berdasarkan jam kerja riil tersebut. Seluruh catatan penyesuaian yang telah disetujui akan tetap terlindungi.`
                        : `This employee has an ALL IN status. This process will synchronize attendance records with authentic real working hours for ${selectedEmp.EMP_NM} (NIK: ${selectedEmp.EMP_CD}) without artificial office tolerance adjustments, and calculate overtime normally based on real working hours. All verified manual adjustments will remain securely protected.`
                    ) : (
                      lang === 'id'
                        ? `Proses ini akan menyelaraskan rekaman kehadiran, menstandarisasi toleransi jam kerja, dan memperbarui kalkulasi lembur secara otomatis untuk personel ${selectedEmp.EMP_NM} (NIK: ${selectedEmp.EMP_CD}) pada periode yang ditentukan. Seluruh catatan penyesuaian yang telah disetujui akan tetap terlindungi.`
                        : `This process will synchronize attendance records, standardize working hours, and update overtime calculations automatically for ${selectedEmp.EMP_NM} (NIK: ${selectedEmp.EMP_CD}) over the selected period. All verified manual adjustments will remain securely protected.`
                    )}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div className="form-group">
                      <label className="form-label">{lang === 'id' ? 'Tanggal Mulai' : 'Start Date'}</label>
                      <input type="date" className="form-input" value={syncStart} onChange={e => setSyncStart(e.target.value)} disabled={isSyncing} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">{lang === 'id' ? 'Tanggal Selesai' : 'End Date'}</label>
                      <input type="date" className="form-input" value={syncEnd} onChange={e => setSyncEnd(e.target.value)} disabled={isSyncing} />
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button className="btn btn-secondary" onClick={() => setShowSyncModal(false)} disabled={isSyncing}>{t(lang, 'batal')}</button>
                  <button
                    className="btn btn-primary"
                    onClick={async () => {
                      if (!syncStart || !syncEnd) return showToast(lang === 'id' ? 'Silakan tentukan rentang tanggal periode presensi.' : 'Please select the date range.', 'warning');
                      setIsSyncing(true);
                      try {
                        const res = await fetch('/api/absensi/sync-finger', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ startDate: syncStart, endDate: syncEnd, empCd: selectedEmp.EMP_CD })
                        });
                        const result = await res.json();
                        if (result.success) {
                          showToast(
                            ['1', 'Y', 'TRUE'].includes(String(selectedEmp.ALL_IN).toUpperCase())
                              ? (lang === 'id' 
                                  ? `Sinkronisasi data riil presensi untuk ${selectedEmp.EMP_NM} (NIK: ${selectedEmp.EMP_CD}) berhasil diselesaikan.` 
                                  : `Real attendance synchronization for ${selectedEmp.EMP_NM} (NIK: ${selectedEmp.EMP_CD}) completed successfully.`)
                              : (lang === 'id' 
                                  ? `Sinkronisasi presensi untuk ${selectedEmp.EMP_NM} (NIK: ${selectedEmp.EMP_CD}) berhasil diselesaikan.` 
                                  : `Attendance synchronization for ${selectedEmp.EMP_NM} (NIK: ${selectedEmp.EMP_CD}) completed successfully.`), 
                            'success'
                          );
                          setShowSyncModal(false);
                          handleLoadAbsensi();
                        } else {
                          showToast((lang === 'id' ? 'Kendala sinkronisasi: ' : 'Sync issue: ') + (result.error || 'Terjadi kendala pada sistem'), 'warning');
                        }
                      } catch (e) {
                        showToast(lang === 'id' ? 'Terjadi kendala koneksi sistem' : 'Connection error occurred', 'warning');
                      } finally {
                        setIsSyncing(false);
                      }
                    }}
                    disabled={isSyncing}
                  >
                    {isSyncing 
                      ? (lang === 'id' ? 'Memproses Sinkronisasi...' : 'Synchronizing...') 
                      : (['1', 'Y', 'TRUE'].includes(String(selectedEmp.ALL_IN).toUpperCase())
                          ? (lang === 'id' ? 'Mulai Sinkronisasi Data Riil' : 'Start Real Attendance Sync')
                          : (lang === 'id' ? 'Mulai Sinkronisasi Presensi' : 'Start Synchronization'))}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Rekap Detail Modal */}
      {rekapDetailMode && typeof document !== 'undefined' && createPortal(
        <div className="liquid-glass-overlay" onClick={() => setRekapDetailMode(null)} style={{ cursor: 'pointer' }}>
          {/* Hidden SVG Filter for Convex Lens Distortion */}
          <svg style={{ position: 'absolute', width: 0, height: 0 }} aria-hidden="true">
            <filter id="glass-distortion" x="0%" y="0%" width="100%" height="100%">
              <feImage result="mapX" preserveAspectRatio="none" href="data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPScxMDAnIGhlaWdodD0nMTAwJz48bGluZWFyR3JhZGllbnQgaWQ9J2cnIHgxPScwJyB5MT0nMCcgeDI9JzEwMCUnIHkyPScwJz48c3RvcCBvZmZzZXQ9JzAnIHN0b3AtY29sb3I9JyNmZjAwMDAnLz48c3RvcCBvZmZzZXQ9JzE1JScgc3RvcC1jb2xvcj0nI2MwMDAwMCcvPjxzdG9wIG9mZnNldD0nODUlJyBzdG9wLWNvbG9yPScjNDAwMDAwJy8+PHN0b3Agb2Zmc2V0PScxMDAlJyBzdG9wLWNvbG9yPScjMDAwMDAwJy8+PC9saW5lYXJHcmFkaWVudD48cmVjdCB3aWR0aD0nMTAwJyBoZWlnaHQ9JzEwMCcgZmlsbD0ndXJsKCNnKScvPjwvc3ZnPg==" />
              <feImage result="mapY" preserveAspectRatio="none" href="data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPScxMDAnIGhlaWdodD0nMTAwJz48bGluZWFyR3JhZGllbnQgaWQ9J2cnIHgxPScwJyB5MT0nMCcgeDI9JzAnIHkyPScxMDAlJz48c3RvcCBvZmZzZXQ9JzAnIHN0b3AtY29sb3I9JyMwMGZmMDAnLz48c3RvcCBvZmZzZXQ9JzE1JScgc3RvcC1jb2xvcj0nIzAwYzAwMCcvPjxzdG9wIG9mZnNldD0nODUlJyBzdG9wLWNvbG9yPScjMDA0MDAwJy8+PHN0b3Agb2Zmc2V0PScxMDAlJyBzdG9wLWNvbG9yPScjMDAwMDAwJy8+PC9saW5lYXJHcmFkaWVudD48cmVjdCB3aWR0aD0nMTAwJyBoZWlnaHQ9JzEwMCcgZmlsbD0ndXJsKCNnKScvPjwvc3ZnPg==" />
              <feBlend mode="screen" in="mapX" in2="mapY" result="lensMap" />
              <feDisplacementMap in="SourceGraphic" in2="lensMap" scale="50" xChannelSelector="R" yChannelSelector="G" />
            </filter>
          </svg>
          <div className="liquid-glass-modal" onClick={e => e.stopPropagation()} style={{ cursor: 'default', maxWidth: '500px' }}>
            <button onClick={() => setRekapDetailMode(null)} className="liquid-glass-close" style={{ position: 'absolute', right: '16px', top: '16px', cursor: 'pointer', zIndex: 10 }}>
              <X size={24} />
            </button>
            <h2 className="liquid-glass-modal-title" style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px', zIndex: 10, position: 'relative' }}>
              Rincian {STATUS_HARI_MAP[rekapDetailMode]?.label_id}
            </h2>
            <div style={{ maxHeight: '60vh', overflowY: 'auto', zIndex: 10, position: 'relative' }}>
              {rekapDetailRecords.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '20px' }}>Tidak ada data</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {rekapDetailRecords.map(r => (
                    <div key={r.DATE_TRANS} style={{ padding: '10px', background: 'var(--bg-primary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                      <div style={{ fontWeight: 600, fontSize: '13px' }}>{new Date(r.DATE_TRANS).toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '6px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                        <div>IN: {r.WORK_IN ? (r.WORK_IN_STR?.split(' ')[1] || r.WORK_IN.substring(11, 19)) : '-'}</div>
                        <div>OUT: {r.WORK_OUT ? (r.WORK_OUT_STR?.split(' ')[1] || r.WORK_OUT.substring(11, 19)) : '-'}</div>
                      </div>
                      {r.REASON && <div style={{ fontSize: '12px', marginTop: '4px', color: 'var(--accent-orange)' }}>Alasan: {masterReasons.find(m => m.REASON_CODE === r.REASON)?.REASON_DESC || r.REASON}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      , document.body)}

      {/* Toast */}
      {toast && (
        <div className="toast-container">
          <div className={`toast toast-${toast.type}`}>
            {toast.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
            {toast.msg}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AbsensiPage() {
  return (
    <Suspense fallback={<div className="loading-overlay"><div className="spinner" /></div>}>
      <AbsensiContent />
    </Suspense>
  );
}
