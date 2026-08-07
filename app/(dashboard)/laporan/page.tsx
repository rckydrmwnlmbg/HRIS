'use client';
import { useState, useEffect } from 'react';
import { useApp } from '@/lib/context';
import { t } from '@/lib/i18n';
import { EmptyState } from '@/components/ui/EmptyState';
import type { Department, Seksi, Jabatan } from '@/types';
import { FileText, Download, BarChart3, Filter, Loader2, Calendar as CalendarIcon } from 'lucide-react';

type Tab = 'absensi' | 'ot' | 'cuti' | 'skorsing';

export default function LaporanPage() {
  const { settings } = useApp();
  const lang = settings.language;

  const [tab, setTab] = useState<Tab>('absensi');
  const [bulan, setBulan] = useState(new Date().getMonth() + 1);
  const [tahun, setTahun] = useState(new Date().getFullYear());
  const [filterSec, setFilterSec] = useState('');
  const [filterJob, setFilterJob] = useState('');
  const [filterShift, setFilterShift] = useState('');

  const today = new Date().toISOString().split('T')[0];
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);

  const [otDate, setOtDate] = useState(today);
  const [autoCorrection, setAutoCorrection] = useState(true);
  const [applyToDb, setApplyToDb] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [previewData, setPreviewData] = useState<any[] | null>(null);

  const [masterSec, setMasterSec] = useState<Seksi[]>([]);
  const [masterJob, setMasterJob] = useState<Jabatan[]>([]);

  useEffect(() => {
    fetch('/api/master')
      .then(res => res.json())
      .then(data => {
        setMasterSec(data.seksi || []);
        setMasterJob(data.jabatan || []);
      })
      .catch(err => console.error(err));
  }, []);

  const seksiForDep = masterSec;

  const handleGenerate = async () => {
    setGenerating(true);
    setPreviewData(null);
    try {
      let url = `/api/laporan/export?type=${tab}${filterSec ? `&sec=${filterSec}` : ''}${filterJob ? `&job=${filterJob}` : ''}&format=json`;
      if (tab === 'cuti' || tab === 'skorsing') {
        url += `&start=${startDate}&end=${endDate}`;
      } else if (tab === 'ot') {
        url += `&date=${otDate}&autoCorrection=${autoCorrection}&applyToDb=${applyToDb}`;
      } else {
        url += `&bulan=${bulan}&tahun=${tahun}`;
        if (filterShift) url += `&shift=${filterShift}`;
      }
      const res = await fetch(url, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setPreviewData(data);
      } else {
        alert(lang === 'id' ? 'Gagal mengambil data laporan dari server.' : 'Failed to fetch report data from server.');
      }
    } catch (e) {
      alert(lang === 'id' ? 'Gagal membuat pratinjau' : 'Failed to generate preview');
    }
    setGenerating(false);
  };

  const handleExport = async () => {
    setGenerating(true);
    try {
      let url = `/api/laporan/export?type=${tab}${filterSec ? `&sec=${filterSec}` : ''}${filterJob ? `&job=${filterJob}` : ''}&format=excel`;
      if (tab === 'cuti' || tab === 'skorsing') {
        url += `&start=${startDate}&end=${endDate}`;
      } else if (tab === 'ot') {
        url += `&date=${otDate}&autoCorrection=${autoCorrection}&applyToDb=${applyToDb}`;
      } else {
        url += `&bulan=${bulan}&tahun=${tahun}`;
        if (filterShift) url += `&shift=${filterShift}`;
      }
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error('Network error');
      const blob = await res.blob();
      const objUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objUrl;

      if (tab === 'ot') {
        const parts = otDate.split('-');
        const inputDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        const day = inputDate.getDay();
        const diff = day === 0 ? -6 : 1 - day;
        const startD = new Date(inputDate);
        startD.setDate(inputDate.getDate() + diff);
        const endD = new Date(startD);
        endD.setDate(startD.getDate() + 6);

        const fmt = (d: Date) => {
          const dd = String(d.getDate()).padStart(2, '0');
          const mm = String(d.getMonth() + 1).padStart(2, '0');
          const yyyy = d.getFullYear();
          return `${dd}-${mm}-${yyyy}`;
        };

        a.download = `Laporan Analysis OT ${fmt(startD)} sd ${fmt(endD)}.xlsx`;
      } else {
        a.download = `Laporan_${tab}_${tahun}${String(bulan).padStart(2, '0')}.xlsx`;
      }

      a.click();
      window.URL.revokeObjectURL(objUrl);
    } catch (e) {
      alert(lang === 'id' ? 'Gagal mengekspor laporan' : 'Failed to export report');
    }
    setGenerating(false);
  };

  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const years = [2024, 2025, 2026];

  return (
    <div className="animate-fadeIn">
      <div className="page-header">
        <div>
          <h1 className="page-title">{lang === 'id' ? 'Laporan & Rekapitulasi' : 'Reports & Analytics'}</h1>
          <p className="page-subtitle">{lang === 'id' ? 'Pusat unduhan dan pratinjau rekapitulasi presensi, lembur, serta perizinan kerja' : 'Central hub for downloading and previewing attendance, overtime, and leave summaries'}</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '290px minmax(0, 1fr)', gap: '20px', minHeight: 'calc(100vh - 150px)', height: 'calc(100vh - 150px)' }}>
        {/* Panel Filter */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            <h3 style={{ margin: 0, fontWeight: 650, fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Filter size={17} /> {lang === 'id' ? 'Parameter Laporan' : 'Report Parameters'}
            </h3>
          </div>
          <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div className="form-group">
              <label className="form-label">{lang === 'id' ? 'Jenis Laporan' : 'Report Type'}</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <button
                  className={`btn ${tab === 'absensi' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => { setTab('absensi'); setPreviewData(null); }}
                  style={{ display: 'flex', flexDirection: 'column', padding: '10px 8px', height: 'auto', gap: '5px', fontSize: '12px' }}
                >
                  <FileText size={18} />
                  <span>{lang === 'id' ? 'Rekap Presensi' : 'Attendance'}</span>
                </button>
                <button
                  className={`btn ${tab === 'ot' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => { setTab('ot'); setPreviewData(null); }}
                  style={{ display: 'flex', flexDirection: 'column', padding: '10px 8px', height: 'auto', gap: '5px', fontSize: '12px' }}
                >
                  <BarChart3 size={18} />
                  <span>{lang === 'id' ? 'Rekap Lembur' : 'Overtime'}</span>
                </button>
                <button
                  className={`btn ${tab === 'cuti' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => { setTab('cuti'); setPreviewData(null); }}
                  style={{ display: 'flex', flexDirection: 'column', padding: '10px 8px', height: 'auto', gap: '5px', fontSize: '12px' }}
                >
                  <CalendarIcon size={18} />
                  <span>{lang === 'id' ? 'Rekap Cuti' : 'Leave'}</span>
                </button>
                <button
                  className={`btn ${tab === 'skorsing' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => { setTab('skorsing'); setPreviewData(null); }}
                  style={{ display: 'flex', flexDirection: 'column', padding: '10px 8px', height: 'auto', gap: '5px', fontSize: '12px' }}
                >
                  <FileText size={18} />
                  <span>{lang === 'id' ? 'Disiplin' : 'Disciplinary'}</span>
                </button>
              </div>
            </div>

            {tab === 'cuti' || tab === 'skorsing' ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '10px' }}>
                <div className="form-group">
                  <label className="form-label">{lang === 'id' ? 'Dari Tanggal' : 'Start Date'}</label>
                  <input type="date" className="form-input" value={startDate} onChange={e => { setStartDate(e.target.value); setPreviewData(null); }} />
                </div>
                <div className="form-group">
                  <label className="form-label">{lang === 'id' ? 'Sampai Tanggal' : 'End Date'}</label>
                  <input type="date" className="form-input" value={endDate} onChange={e => { setEndDate(e.target.value); setPreviewData(null); }} />
                </div>
              </div>
            ) : tab === 'ot' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">{lang === 'id' ? 'Pilih Tanggal (Rentang 1 Pekan)' : 'Select Date (1 Week)'}</label>
                  <input type="date" className="form-input" value={otDate} onChange={e => { setOtDate(e.target.value); setPreviewData(null); }} />
                </div>

                {/* Toggle Koreksi Otomatis Presensi & Lembur */}
                <div style={{
                  background: 'var(--table-row-hover, rgba(56, 189, 248, 0.04))',
                  border: '1px solid var(--border)',
                  borderRadius: '10px',
                  padding: '12px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 650, color: 'var(--text-primary)' }}>
                      {lang === 'id' ? 'Koreksi Otomatis Presensi' : 'Auto Correction'}
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={autoCorrection}
                      onClick={() => { setAutoCorrection(!autoCorrection); setPreviewData(null); }}
                      style={{
                        width: '40px',
                        height: '22px',
                        borderRadius: '12px',
                        background: autoCorrection ? 'var(--primary, #0284c7)' : 'rgba(148, 163, 184, 0.3)',
                        border: 'none',
                        cursor: 'pointer',
                        position: 'relative',
                        padding: '2px',
                        transition: 'background-color 0.2s ease',
                        display: 'inline-flex',
                        alignItems: 'center',
                        flexShrink: 0
                      }}
                    >
                      <span
                        style={{
                          display: 'block',
                          width: '18px',
                          height: '18px',
                          borderRadius: '50%',
                          background: '#ffffff',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                          transform: autoCorrection ? 'translateX(18px)' : 'translateX(0px)',
                          transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                        }}
                      />
                    </button>
                  </div>
                  <div style={{ fontSize: '11px', lineHeight: '1.4', color: autoCorrection ? 'var(--accent)' : 'var(--text-muted)' }}>
                    {autoCorrection
                      ? (lang === 'id' ? '🟢 ON: Standar pembulatan audit (Compliance).' : '🟢 ON: Compliance audit rounding.')
                      : (lang === 'id' ? '⚪ OFF: Menampilkan data real tanpa koreksi otomatis.' : '⚪ OFF: Real TR_ABSEN & native INUS 0.5 decimals.')
                    }
                  </div>

                  {autoCorrection && (
                    <div style={{
                      marginTop: '6px',
                      paddingTop: '10px',
                      borderTop: '1px dashed var(--border)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px'
                    }}>
                      <label style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '9px',
                        cursor: 'pointer',
                        userSelect: 'none'
                      }}>
                        <input
                          type="checkbox"
                          checked={applyToDb}
                          onChange={e => { setApplyToDb(e.target.checked); setPreviewData(null); }}
                          style={{
                            accentColor: 'var(--primary, #0284c7)',
                            width: '16px',
                            height: '16px',
                            cursor: 'pointer',
                            marginTop: '2px',
                            flexShrink: 0
                          }}
                        />
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          <span style={{
                            fontSize: '12px',
                            fontWeight: 650,
                            color: applyToDb ? 'var(--text-primary)' : 'var(--text-secondary)',
                            lineHeight: '1.3'
                          }}>
                            {lang === 'id' ? 'Sinkronkan Jam Kerja ke Database Absensi' : 'Sync Working Hours to Attendance Database'}
                          </span>
                          <span style={{
                            fontSize: '11px',
                            lineHeight: '1.4',
                            color: applyToDb ? 'var(--accent)' : 'var(--text-muted)'
                          }}>
                            {applyToDb
                              ? (lang === 'id'
                                ? 'Data jam masuk, jam pulang, & durasi kerja di tabel presensi akan otomatis diperbarui mengikuti hasil koreksi ini.'
                                : 'Clock-in, clock-out, & duration in attendance table will be automatically updated with these corrections.')
                              : (lang === 'id'
                                ? 'Hanya terapkan pada berkas laporan; data jam kerja di database tetap mempertahankan catatan aslinya.'
                                : 'Applied to the report file only; database attendance records will remain unchanged.')
                            }
                          </span>
                        </div>
                      </label>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div className="form-group">
                  <label className="form-label">{t(lang, 'bulan')}</label>
                  <select className="form-select" value={bulan} onChange={e => { setBulan(Number(e.target.value)); setPreviewData(null); }}>
                    {months.map(m => <option key={m} value={m}>{new Date(2024, m - 1).toLocaleString(lang === 'id' ? 'id-ID' : 'en-US', { month: 'long' })}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">{t(lang, 'tahun')}</label>
                  <select className="form-select" value={tahun} onChange={e => { setTahun(Number(e.target.value)); setPreviewData(null); }}>
                    {years.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              </div>
            )}

            {tab === 'absensi' && (
              <div className="form-group">
                <label className="form-label">{lang === 'id' ? 'Jadwal Kerja' : 'Work Shift'}</label>
                <select className="form-select" value={filterShift} onChange={e => { setFilterShift(e.target.value); setPreviewData(null); }}>
                  <option value="">{lang === 'id' ? 'Semua Jadwal Kerja' : 'All Work Shifts'}</option>
                  <option value="pagi">{lang === 'id' ? 'Jadwal Pagi (Security)' : 'Morning Shift (Security)'}</option>
                  <option value="sore">{lang === 'id' ? 'Jadwal Sore / Malam (Security)' : 'Afternoon/Night Shift (Security)'}</option>
                </select>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">{t(lang, 'bagian')}</label>
              <select className="form-select" value={filterSec} onChange={e => { setFilterSec(e.target.value); setPreviewData(null); }}>
                <option value="">{t(lang, 'semua')}</option>
                {masterSec.map(s => <option key={s.SEC_CD} value={s.SEC_CD}>{s.SEC_DESC}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">{t(lang, 'jabatan')}</label>
              <select className="form-select" value={filterJob} onChange={e => { setFilterJob(e.target.value); setPreviewData(null); }}>
                <option value="">{t(lang, 'semua')}</option>
                {masterJob.map(j => <option key={j.JOB_CD} value={j.JOB_CD}>{j.JOB_DESC}</option>)}
              </select>
            </div>

            <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button className="btn btn-secondary" onClick={handleGenerate} disabled={generating}>
                {generating ? <><Loader2 size={15} className="spinner" /> {lang === 'id' ? 'Memproses...' : 'Processing...'}</> : (lang === 'id' ? 'Tampilkan Pratinjau' : 'Show Preview')}
              </button>
              <button className="btn btn-primary" onClick={handleExport} disabled={generating}>
                <Download size={15} /> {lang === 'id' ? 'Unduh Berkas Excel' : 'Export Excel'}
              </button>
            </div>
          </div>
        </div>

        {/* Panel Preview */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', height: '100%', minWidth: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            <h3 style={{ margin: 0, fontWeight: 650, fontSize: '15px' }}>{lang === 'id' ? 'Pratinjau Data' : 'Data Preview'}</h3>
          </div>
          <div style={{ padding: '16px', flex: 1, overflow: 'auto', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            {!previewData ? (
              <EmptyState
                icon="document"
                title={lang === 'id' ? 'Belum Ada Pratinjau' : 'No Preview Available'}
                description={lang === 'id' ? 'Klik tombol Tampilkan Pratinjau di panel parameter sebelah kiri untuk melihat rangkuman data laporan sebelum mengunduh berkas Excel.' : 'Click Show Preview button to view the report summary before downloading it to Excel.'}
              />
            ) : (
              <div className="table-wrapper">
                <table className="data-table">
                  {tab === 'absensi' ? (
                    <>
                      <thead>
                        <tr>
                          <th>{lang === 'id' ? 'Tanggal' : 'Date'}</th>
                          <th>{t(lang, 'nik')}</th>
                          <th>{t(lang, 'nama')}</th>
                          <th>{lang === 'id' ? 'Jenis Kelamin' : 'Gender'}</th>
                          <th>{lang === 'id' ? 'Kategori Karyawan' : 'Category'}</th>
                          <th>{t(lang, 'jabatan')}</th>
                          <th>{lang === 'id' ? 'Tim' : 'Team'}</th>
                          <th>{t(lang, 'bagian')}</th>
                          <th style={{ textAlign: 'center' }}>{lang === 'id' ? 'Waktu Masuk' : 'Clock In'}</th>
                          <th style={{ textAlign: 'center' }}>{lang === 'id' ? 'Waktu Pulang' : 'Clock Out'}</th>
                          <th style={{ textAlign: 'center' }}>{lang === 'id' ? 'Status Kehadiran' : 'Attendance Status'}</th>
                          <th>{lang === 'id' ? 'Keterangan' : 'Notes'}</th>
                          <th style={{ textAlign: 'center' }}>{lang === 'id' ? 'Jam Normal' : 'Regular Hours'}</th>
                          <th style={{ textAlign: 'center' }}>{lang === 'id' ? 'Lembur 1' : 'OT 1'}</th>
                          <th style={{ textAlign: 'center' }}>{lang === 'id' ? 'Lembur 2' : 'OT 2'}</th>
                          <th style={{ textAlign: 'center' }}>{lang === 'id' ? 'Lembur 3' : 'OT 3'}</th>
                          <th style={{ textAlign: 'center' }}>{lang === 'id' ? 'Lembur 4' : 'OT 4'}</th>
                          <th style={{ textAlign: 'center' }}>{lang === 'id' ? 'Total Lembur' : 'Total OT'}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewData.length === 0 ? (
                          <tr><td colSpan={18} style={{ textAlign: 'center', padding: '20px' }}>{lang === 'id' ? 'Tidak ada catatan laporan pada parameter yang dipilih' : 'No records found'}</td></tr>
                        ) : previewData.slice(0, 150).map((r, i) => (
                          <tr key={i}>
                            <td style={{ fontSize: '12px', whiteSpace: 'nowrap' }}>{r.TANGGAL}</td>
                            <td><span style={{ fontSize: '12px', fontFamily: 'monospace' }}>{r.NIK}</span></td>
                            <td style={{ fontWeight: 500, whiteSpace: 'nowrap' }}>{r.NAMA}</td>
                            <td style={{ textAlign: 'center' }}>{r.LP}</td>
                            <td style={{ fontSize: '12px' }}>{r.JNSKAR}</td>
                            <td style={{ fontSize: '12px', whiteSpace: 'nowrap' }}>{r.JABATAN || '-'}</td>
                            <td style={{ fontSize: '12px' }}>{r.TEAM || '-'}</td>
                            <td style={{ fontSize: '12px', whiteSpace: 'nowrap' }}>{r.BAGIAN || '-'}</td>
                            <td style={{ textAlign: 'center', fontFamily: 'monospace' }}>{r.MASUK || '-'}</td>
                            <td style={{ textAlign: 'center', fontFamily: 'monospace' }}>{r.PULANG || '-'}</td>
                            <td style={{ textAlign: 'center' }}>
                              <span className={`badge badge-${(r.STATUS_HARI || '').toLowerCase().includes('kerja') ? 'hadir' : (r.STATUS_HARI || '').toLowerCase().includes('libur') ? 'netral' : 'alpha'}`}>
                                {r.STATUS_HARI || '-'}
                              </span>
                            </td>
                            <td style={{ fontSize: '12px' }}>{r.ALASAN || '-'}</td>
                            <td style={{ textAlign: 'center', fontWeight: 600 }}>{r.BASIC}</td>
                            <td style={{ textAlign: 'center', color: r.OT1 > 0 ? '#0ea5e9' : 'inherit', fontWeight: r.OT1 > 0 ? 600 : 400 }}>{r.OT1}</td>
                            <td style={{ textAlign: 'center', color: r.OT2 > 0 ? '#3b82f6' : 'inherit', fontWeight: r.OT2 > 0 ? 600 : 400 }}>{r.OT2}</td>
                            <td style={{ textAlign: 'center', color: r.OT3 > 0 ? '#8b5cf6' : 'inherit', fontWeight: r.OT3 > 0 ? 600 : 400 }}>{r.OT3}</td>
                            <td style={{ textAlign: 'center', color: r.OT4 > 0 ? '#ec4899' : 'inherit', fontWeight: r.OT4 > 0 ? 600 : 400 }}>{r.OT4}</td>
                            <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--accent)' }}>{r.TOTAL}</td>
                          </tr>
                        ))}
                      </tbody>
                    </>
                  ) : tab === 'ot' ? (
                    <>
                      <thead>
                        <tr>
                          <th>{t(lang, 'nik')}</th>
                          <th>{t(lang, 'nama')}</th>
                          <th>{t(lang, 'departemen')}</th>
                          <th>{t(lang, 'bagian')}</th>
                          <th>{t(lang, 'jabatan')}</th>
                          <th>{lang === 'id' ? 'Skema Kerja' : 'Scheme'}</th>
                          <th>{lang === 'id' ? 'Total Jam Kerja' : 'Total Work Hours'}</th>
                          <th>{lang === 'id' ? 'Total Jam Lembur' : 'Total Overtime'}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewData.length === 0 ? (
                          <tr><td colSpan={8} style={{ textAlign: 'center', padding: '20px' }}>{lang === 'id' ? 'Tidak ada catatan laporan pada parameter yang dipilih' : 'No records found'}</td></tr>
                        ) : previewData.slice(0, 100).map((r, i) => (
                          <tr key={i}>
                            <td><span style={{ fontSize: '12px', fontFamily: 'monospace' }}>{r.EMP_CD}</span></td>
                            <td style={{ fontWeight: 500 }}>{r.EMP_NM}</td>
                            <td style={{ fontSize: '12px' }}>{r.DEP_DESC || '-'}</td>
                            <td style={{ fontSize: '12px' }}>{r.SEC_DESC || '-'}</td>
                            <td style={{ fontSize: '12px' }}>{r.TEAM || r.JOB_DESC || '-'}</td>
                            <td>{r.isAllIn ? (lang === 'id' ? 'Paket ALL IN' : 'ALL IN Package') : (lang === 'id' ? 'Harian' : 'Daily')}</td>
                            <td><span style={{ fontWeight: 'bold' }}>{r.totalKerja || 0} {lang === 'id' ? 'Jam' : 'Hrs'}</span></td>
                            <td><span style={{ fontWeight: 'bold' }}>{r.totalOt || 0} {lang === 'id' ? 'Jam' : 'Hrs'}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </>
                  ) : tab === 'cuti' ? (
                    <>
                      <thead>
                        <tr>
                          <th>{t(lang, 'nik')}</th>
                          <th>{t(lang, 'nama')}</th>
                          <th>{t(lang, 'departemen')}</th>
                          <th>{t(lang, 'bagian')}</th>
                          <th>{t(lang, 'jabatan')}</th>
                          <th>{lang === 'id' ? 'Jenis Cuti' : 'Leave Type'}</th>
                          <th>{lang === 'id' ? 'Tanggal Mulai' : 'Start Date'}</th>
                          <th>{lang === 'id' ? 'Tanggal Selesai' : 'End Date'}</th>
                          <th>{lang === 'id' ? 'Durasi (Hari)' : 'Duration (Days)'}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewData.length === 0 ? (
                          <tr><td colSpan={9} style={{ textAlign: 'center', padding: '20px' }}>{lang === 'id' ? 'Tidak ada catatan laporan pada parameter yang dipilih' : 'No records found'}</td></tr>
                        ) : previewData.slice(0, 100).map((r, i) => (
                          <tr key={i}>
                            <td><span style={{ fontSize: '12px', fontFamily: 'monospace' }}>{r.EMP_CD}</span></td>
                            <td style={{ fontWeight: 500 }}>{r.EMP_NM}</td>
                            <td style={{ fontSize: '12px' }}>{r.DEP_DESC || '-'}</td>
                            <td style={{ fontSize: '12px' }}>{r.SEC_DESC || '-'}</td>
                            <td style={{ fontSize: '12px' }}>{r.TEAM || r.JOB_DESC || '-'}</td>
                            <td><span className="badge badge-cuti">{r.type}</span></td>
                            <td>{new Date(r.startDate).toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-US')}</td>
                            <td>{new Date(r.endDate).toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-US')}</td>
                            <td>{r.days} {lang === 'id' ? 'Hari' : 'Days'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </>
                  ) : tab === 'skorsing' ? (
                    <>
                      <thead>
                        <tr>
                          <th>{t(lang, 'nik')}</th>
                          <th>{t(lang, 'nama')}</th>
                          <th>{t(lang, 'departemen')}</th>
                          <th>{t(lang, 'bagian')}</th>
                          <th>{t(lang, 'jabatan')}</th>
                          <th>{lang === 'id' ? 'Tanggal Kejadian' : 'Incident Date'}</th>
                          <th>{lang === 'id' ? 'Waktu Masuk' : 'Clock In'}</th>
                          <th>{lang === 'id' ? 'Waktu Pulang' : 'Clock Out'}</th>
                          <th>{lang === 'id' ? 'Catatan Tindakan Disiplin' : 'Disciplinary Note'}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewData.length === 0 ? (
                          <tr><td colSpan={9} style={{ textAlign: 'center', padding: '20px' }}>{lang === 'id' ? 'Tidak ditemukan catatan tindakan disiplin pada periode ini' : 'No disciplinary records found'}</td></tr>
                        ) : previewData.slice(0, 100).map((r, i) => (
                          <tr key={i}>
                            <td><span style={{ fontSize: '12px', fontFamily: 'monospace' }}>{r.EMP_CD}</span></td>
                            <td style={{ fontWeight: 500 }}>{r.EMP_NM}</td>
                            <td style={{ fontSize: '12px' }}>{r.DEP_DESC || '-'}</td>
                            <td style={{ fontSize: '12px' }}>{r.SEC_DESC || '-'}</td>
                            <td style={{ fontSize: '12px' }}>{r.TEAM || r.JOB_DESC || '-'}</td>
                            <td>{r.dateStr}</td>
                            <td><span style={{ color: 'var(--error)' }}>{r.WORK_IN_STR || '-'}</span></td>
                            <td><span style={{ color: 'var(--error)' }}>{r.WORK_OUT_STR || '-'}</span></td>
                            <td><span style={{ fontSize: '12px', color: 'var(--error)' }}>{r.reason}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </>
                  ) : null}
                </table>
                {previewData.length > 100 && (
                  <div style={{ padding: '10px', textAlign: 'center', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    {lang === 'id' ? `Menampilkan 100 baris pertama. Unduh berkas Excel untuk meninjau seluruh data (${previewData.length} baris).` : `Showing first 100 rows. Export to Excel to view all data (${previewData.length} rows).`}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
