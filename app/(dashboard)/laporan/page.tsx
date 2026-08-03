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
        url += `&date=${otDate}`;
      } else {
        url += `&bulan=${bulan}&tahun=${tahun}`;
        if (filterShift) url += `&shift=${filterShift}`;
      }
      const res = await fetch(url, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setPreviewData(data);
      } else {
        alert('Gagal mengambil data laporan dari server.');
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
        url += `&date=${otDate}`;
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
      a.download = `Laporan_${tab}_${tahun}${String(bulan).padStart(2, '0')}.xlsx`;
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
          <h1 className="page-title">{lang === 'id' ? 'Laporan & Export' : 'Reports & Export'}</h1>
          <p className="page-subtitle">{lang === 'id' ? 'Tarik data absensi dan lembur dalam format Excel' : 'Export attendance and overtime data in Excel format'}</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '24px', height: 'calc(100vh - 130px)' }}>
        {/* Panel Filter */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
            <h3 style={{ margin: 0, fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Filter size={18} /> Filter Laporan
            </h3>
          </div>
          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">{lang === 'id' ? 'Jenis Laporan' : 'Report Type'}</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <button 
                  className={`btn ${tab === 'absensi' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => { setTab('absensi'); setPreviewData(null); }}
                  style={{ display: 'flex', flexDirection: 'column', padding: '12px 8px', height: 'auto', gap: '6px' }}
                >
                  <FileText size={20} />
                  <span>Rekap Absensi</span>
                </button>
                <button 
                  className={`btn ${tab === 'ot' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => { setTab('ot'); setPreviewData(null); }}
                  style={{ display: 'flex', flexDirection: 'column', padding: '12px 8px', height: 'auto', gap: '6px' }}
                >
                  <BarChart3 size={20} />
                  <span>OT Analysis</span>
                </button>
                <button 
                  className={`btn ${tab === 'cuti' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => { setTab('cuti'); setPreviewData(null); }}
                  style={{ display: 'flex', flexDirection: 'column', padding: '12px 8px', height: 'auto', gap: '6px' }}
                >
                  <CalendarIcon size={20} />
                  <span>Laporan Cuti</span>
                </button>
                <button 
                  className={`btn ${tab === 'skorsing' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => { setTab('skorsing'); setPreviewData(null); }}
                  style={{ display: 'flex', flexDirection: 'column', padding: '12px 8px', height: 'auto', gap: '6px' }}
                >
                  <FileText size={20} />
                  <span>Laporan Skorsing</span>
                </button>
              </div>
            </div>

            {tab === 'cuti' || tab === 'skorsing' ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">{lang === 'id' ? 'Pilih Tanggal (Otomatis Senin s/d Sabtu)' : 'Select Date (Auto Mon - Sat)'}</label>
                  <input type="date" className="form-input" value={otDate} onChange={e => { setOtDate(e.target.value); setPreviewData(null); }} />
                </div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
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
                <label className="form-label">Shift</label>
                <select className="form-select" value={filterShift} onChange={e => { setFilterShift(e.target.value); setPreviewData(null); }}>
                  <option value="">Semua Waktu</option>
                  <option value="pagi">Shift Pagi (Khusus Security)</option>
                  <option value="sore">Shift Sore/Malam (Khusus Security)</option>
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

            <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button className="btn btn-secondary" onClick={handleGenerate} disabled={generating}>
                {generating ? <><Loader2 size={16} className="spinner" /> {lang === 'id' ? 'Memproses...' : 'Processing...'}</> : (lang === 'id' ? 'Tampilkan Pratinjau' : 'Show Preview')}
              </button>
              <button className="btn btn-primary" onClick={handleExport} disabled={generating}>
                <Download size={16} /> Export ke Excel
              </button>
            </div>
          </div>
        </div>

        {/* Panel Preview */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            <h3 style={{ margin: 0, fontWeight: 600 }}>{lang === 'id' ? 'Pratinjau Data' : 'Data Preview'}</h3>
          </div>
          <div style={{ padding: '20px', flex: 1, overflowY: 'auto' }}>
            {!previewData ? (
              <EmptyState 
                icon="document"
                title={lang === 'id' ? 'Belum Ada Pratinjau' : 'No Preview Available'}
                description={lang === 'id' ? 'Klik tombol Tampilkan Pratinjau di panel sebelah kiri untuk melihat rangkuman data laporan sebelum Anda mendownloadnya ke Excel.' : 'Click Show Preview button to view the report summary before downloading it to Excel.'}
              />
            ) : (
              <div className="table-wrapper">
                <table className="data-table">
                  {tab === 'absensi' ? (
                    <>
                      <thead>
                        <tr>
                          <th>{t(lang, 'nik')}</th>
                          <th>{t(lang, 'nama')}</th>
                          <th>{t(lang, 'departemen')}</th>
                          <th>{t(lang, 'bagian')}</th>
                          <th>{t(lang, 'jabatan')}</th>
                          <th>{t(lang, 'hadir')}</th>
                          <th>{t(lang, 'alpha')}</th>
                          <th>{t(lang, 'izin')}</th>
                          <th>{t(lang, 'cuti')}</th>
                          <th>{t(lang, 'sakit')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewData.length === 0 ? (
                          <tr><td colSpan={8} style={{ textAlign: 'center', padding: '20px' }}>Tidak ada data</td></tr>
                        ) : previewData.slice(0, 100).map((r, i) => (
                          <tr key={i}>
                            <td><span style={{ fontSize: '12px', fontFamily: 'monospace' }}>{r.EMP_CD}</span></td>
                            <td style={{ fontWeight: 500 }}>{r.EMP_NM}</td>
                            <td style={{ fontSize: '12px' }}>{r.DEP_DESC || '-'}</td>
                            <td style={{ fontSize: '12px' }}>{r.SEC_DESC || '-'}</td>
                            <td style={{ fontSize: '12px' }}>{r.TEAM || r.JOB_DESC || '-'}</td>
                            <td>{r.hadir > 0 ? <span className="badge badge-hadir">{r.hadir}</span> : '-'}</td>
                            <td>{r.alpha > 0 ? <span className="badge badge-alpha">{r.alpha}</span> : '-'}</td>
                            <td>{r.izin > 0 ? <span className="badge badge-izin">{r.izin}</span> : '-'}</td>
                            <td>{r.cuti > 0 ? <span className="badge badge-cuti">{r.cuti}</span> : '-'}</td>
                            <td>{r.sakit > 0 ? <span className="badge badge-sakit">{r.sakit}</span> : '-'}</td>
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
                          <th>Keterangan</th>
                          <th>Total Kerja</th>
                          <th>Total OT</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewData.length === 0 ? (
                          <tr><td colSpan={8} style={{ textAlign: 'center', padding: '20px' }}>Tidak ada data</td></tr>
                        ) : previewData.slice(0, 100).map((r, i) => (
                          <tr key={i}>
                            <td><span style={{ fontSize: '12px', fontFamily: 'monospace' }}>{r.EMP_CD}</span></td>
                            <td style={{ fontWeight: 500 }}>{r.EMP_NM}</td>
                            <td style={{ fontSize: '12px' }}>{r.DEP_DESC || '-'}</td>
                            <td style={{ fontSize: '12px' }}>{r.SEC_DESC || '-'}</td>
                            <td style={{ fontSize: '12px' }}>{r.TEAM || r.JOB_DESC || '-'}</td>
                            <td>{r.isAllIn ? 'ALL IN' : 'HARIAN'}</td>
                            <td><span style={{ fontWeight: 'bold' }}>{r.totalKerja || 0}</span></td>
                            <td><span style={{ fontWeight: 'bold' }}>{r.totalOt || 0}</span></td>
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
                          <th>Jenis Cuti</th>
                          <th>Mulai</th>
                          <th>Selesai</th>
                          <th>Hari</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewData.length === 0 ? (
                          <tr><td colSpan={9} style={{ textAlign: 'center', padding: '20px' }}>Tidak ada data</td></tr>
                        ) : previewData.slice(0, 100).map((r, i) => (
                          <tr key={i}>
                            <td><span style={{ fontSize: '12px', fontFamily: 'monospace' }}>{r.EMP_CD}</span></td>
                            <td style={{ fontWeight: 500 }}>{r.EMP_NM}</td>
                            <td style={{ fontSize: '12px' }}>{r.DEP_DESC || '-'}</td>
                            <td style={{ fontSize: '12px' }}>{r.SEC_DESC || '-'}</td>
                            <td style={{ fontSize: '12px' }}>{r.TEAM || r.JOB_DESC || '-'}</td>
                            <td><span className="badge badge-cuti">{r.type}</span></td>
                            <td>{new Date(r.startDate).toLocaleDateString('id-ID')}</td>
                            <td>{new Date(r.endDate).toLocaleDateString('id-ID')}</td>
                            <td>{r.days}</td>
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
                          <th>Tanggal</th>
                          <th>Jam Masuk</th>
                          <th>Jam Pulang</th>
                          <th>Keterangan Pelanggaran</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewData.length === 0 ? (
                          <tr><td colSpan={9} style={{ textAlign: 'center', padding: '20px' }}>Tidak ada pelanggaran skorsing</td></tr>
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
                    Menampilkan 100 baris pertama. Export ke Excel untuk melihat seluruh data ({previewData.length} baris).
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
