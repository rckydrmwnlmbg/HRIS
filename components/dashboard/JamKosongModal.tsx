import React, { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Download, AlertTriangle, Calendar, Loader2, Search, Clock } from 'lucide-react';
import type { JamKosongRecord } from '@/types';

interface JamKosongModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: JamKosongRecord[];
  lang: 'id' | 'en';
}

export default function JamKosongModal({ isOpen, onClose, data, lang }: JamKosongModalProps) {
  const [mounted, setMounted] = useState(false);
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [localData, setLocalData] = useState<JamKosongRecord[]>(data);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [notSynced, setNotSynced] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Sync initial data if date range is today, else keep localData
  useEffect(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    if (startDate === todayStr && endDate === todayStr) {
      setLocalData(data);
      setNotSynced(data.length === 0 && !loading);
    }
  }, [data, startDate, endDate, loading]);

  // Fetch data on date change
  useEffect(() => {
    if (!isOpen) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/dashboard/jam-kosong?startDate=${startDate}&endDate=${endDate}`);
        if (res.ok) {
          const result = await res.json();
          setLocalData(result.data || []);
          setNotSynced(!!result.notSynced);
        }
      } catch (err) {
        console.error('Failed to fetch jam kosong data:', err);
      } finally {
        setLoading(false);
      }
    };
    
    // Only fetch if it's not strictly today (today is passed from props)
    const todayStr = new Date().toISOString().split('T')[0];
    if (startDate !== todayStr || endDate !== todayStr) {
      fetchData();
    }
  }, [startDate, endDate, isOpen]);

  // Use Escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const filteredData = useMemo(() => {
    if (!search.trim()) return localData;
    const q = search.toLowerCase();
    return localData.filter(item => 
      item.EMP_NM.toLowerCase().includes(q) ||
      item.EMP_CD.toLowerCase().includes(q) ||
      (item.BAGIAN || '').toLowerCase().includes(q)
    );
  }, [localData, search]);

  if (!isOpen || !mounted) return null;

  const handleExport = async () => {
    if (!filteredData || filteredData.length === 0) return;

    const ExcelJS = (await import('exceljs')).default;
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Rekap Jam Kosong', { views: [{ showGridLines: true }] });

    const headers = [
      { header: 'NO', key: 'NO', width: 5 },
      { header: 'TANGGAL', key: 'TANGGAL', width: 14 },
      { header: 'NIK', key: 'NIK', width: 13 },
      { header: 'NAMA', key: 'NAMA', width: 28 },
      { header: 'L/P', key: 'LP', width: 6 },
      { header: 'JABATAN', key: 'JABATAN', width: 20 },
      { header: 'TEAM', key: 'TEAM', width: 18 },
      { header: 'BAGIAN', key: 'BAGIAN', width: 20 },
      { header: 'MASUK', key: 'MASUK', width: 10 },
      { header: 'PULANG', key: 'PULANG', width: 10 },
      { header: 'STATUS HARI', key: 'STATUS_HARI', width: 14 },
      { header: 'ALASAN', key: 'ALASAN', width: 22 },
      { header: 'KETERANGAN', key: 'KETERANGAN', width: 28 },
    ];

    worksheet.columns = headers;

    // Style Header Row
    const headerRow = worksheet.getRow(1);
    headerRow.height = 24;
    headerRow.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF000000' } };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } };
      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    });

    // Format dates for filename
    const [sy, sm, sd] = startDate.split('-');
    const [ey, em, ed] = endDate.split('-');
    const formattedStartDate = `${sd}-${sm}-${sy}`;
    const formattedEndDate = `${ed}-${em}-${ey}`;
    const dateRangeStr = startDate === endDate ? formattedStartDate : `${formattedStartDate}_sd_${formattedEndDate}`;

    filteredData.forEach((item, index) => {
      const addedRow = worksheet.addRow({
        NO: index + 1,
        TANGGAL: item.DATE_TRANS || '-',
        NIK: item.EMP_CD,
        NAMA: item.EMP_NM,
        LP: item.SEX || '-',
        JABATAN: item.JOB_DESC || '-',
        TEAM: item.TEAM || '-',
        BAGIAN: item.BAGIAN || '-',
        MASUK: item.WORK_IN || '',
        PULANG: item.WORK_OUT || '',
        STATUS_HARI: item.STATUS_HARI || '',
        ALASAN: item.REASON || '',
        KETERANGAN: item.keterangan_kosong,
      });

      addedRow.height = 19;
      addedRow.font = { name: 'Calibri', size: 10 };

      // Center-align specific columns
      const centerCols = [1, 2, 3, 5, 9, 10, 11];
      centerCols.forEach(colIdx => {
        addedRow.getCell(colIdx).alignment = { horizontal: 'center', vertical: 'middle' };
      });

      // Borders
      addedRow.eachCell((cell) => {
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
      });
    });

    // Generate and download
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Rekap_Jam_Kosong_${dateRangeStr}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return createPortal(
    <div className="liquid-glass-overlay" onClick={onClose} style={{ cursor: 'pointer' }}>
      <div 
        className="liquid-glass-modal" 
        role="dialog" 
        aria-modal="true" 
        onClick={e => e.stopPropagation()} 
        style={{ 
          width: '90%', maxWidth: '850px', maxHeight: '90vh', display: 'flex', flexDirection: 'column',
          cursor: 'default', padding: 0
        }}
      >
        <button onClick={onClose} className="liquid-glass-close" style={{ position: 'absolute', right: '12px', top: '12px', cursor: 'pointer', zIndex: 20 }}>
          <X size={16} />
        </button>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 20px', borderBottom: '1px solid var(--border)', position: 'relative', zIndex: 10
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ 
              width: 32, height: 32, borderRadius: 'var(--radius-sm)', background: 'rgba(234, 179, 8, 0.12)', 
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#eab308', border: '1px solid rgba(234, 179, 8, 0.25)' 
            }}>
              <Clock size={16} />
            </div>
            <div>
              <h2 className="liquid-glass-modal-title" style={{ margin: 0, fontSize: 14.5, fontWeight: 700 }}>
                {lang === 'id' ? 'Daftar Presensi Belum Lengkap' : 'Incomplete Attendance Records'}
              </h2>
              <p className="liquid-glass-modal-desc" style={{ margin: 0, fontSize: 11.5, marginTop: 2 }}>
                {localData.length} {lang === 'id' ? 'Karyawan dengan catatan presensi yang memerlukan peninjauan (Jam Kosong, Cuti, atau Ijin).' : 'Employees with attendance records requiring review (Missing punch, Leave, or Permission).'}
              </p>
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div style={{ padding: '10px 20px', display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', background: 'rgba(255, 255, 255, 0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--glass-bg)', padding: '4px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--glass-border)' }}>
              <Calendar size={13} color="var(--text-secondary)" />
              <input 
                type="date" 
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{
                  border: 'none', background: 'transparent', color: 'var(--text-primary)', fontSize: 12, outline: 'none', cursor: 'pointer'
                }}
              />
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>-</span>
              <input 
                type="date" 
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={{
                  border: 'none', background: 'transparent', color: 'var(--text-primary)', fontSize: 12, outline: 'none', cursor: 'pointer'
                }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--glass-bg)', padding: '4px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--glass-border)', width: 220 }}>
              <Search size={13} color="var(--text-muted)" />
              <input 
                type="text" 
                placeholder={lang === 'id' ? 'Cari nama, NIK, atau bagian...' : 'Search by name, ID, or section...'}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  border: 'none', background: 'transparent', color: 'var(--text-primary)', fontSize: 12, outline: 'none', width: '100%'
                }}
              />
              {search && (
                <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--text-muted)' }}>
                  <X size={12} />
                </button>
              )}
            </div>

            {loading && <Loader2 size={14} className="spin" color="var(--text-secondary)" />}
          </div>
          
          {filteredData.length > 0 && (
            <button
              onClick={handleExport}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px',
                background: '#10B981', color: 'white', border: 'none', borderRadius: 'var(--radius-sm)',
                fontSize: 11.5, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s'
              }}
            >
              <Download size={13} />
              {lang === 'id' ? 'Unduh Excel' : 'Export Excel'}
            </button>
          )}
        </div>

        {/* Content (Table) */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0' }}>
          {loading ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
              <Loader2 size={20} className="spin" style={{ margin: '0 auto 8px' }} />
              {lang === 'id' ? 'Memuat data presensi...' : 'Loading attendance data...'}
            </div>
          ) : notSynced ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <AlertTriangle size={24} style={{ margin: '0 auto 8px', opacity: 0.7, color: '#eab308' }} />
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2, fontSize: 13 }}>
                {lang === 'id' ? 'Data Kehadiran Belum Disinkronkan' : 'Attendance Data Not Synchronized'}
              </div>
              <div style={{ fontSize: 11.5 }}>
                {lang === 'id' ? 'Silakan lakukan sinkronisasi data kehadiran terlebih dahulu untuk meninjau status terkini.' : 'Please synchronize attendance records first to review the latest status.'}
              </div>
            </div>
          ) : filteredData.length > 0 ? (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 12 }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 10, backdropFilter: 'blur(16px)', backgroundColor: 'var(--table-header-bg)' }}>
                <tr>
                  <th style={{ padding: '10px 16px', color: 'var(--text-secondary)', fontWeight: 700, borderBottom: '2px solid var(--border)', fontSize: 11, letterSpacing: '0.02em' }}>{lang === 'id' ? 'Tanggal' : 'Date'}</th>
                  <th style={{ padding: '10px 16px', color: 'var(--text-secondary)', fontWeight: 700, borderBottom: '2px solid var(--border)', fontSize: 11, letterSpacing: '0.02em' }}>{lang === 'id' ? 'Informasi Karyawan' : 'Employee'}</th>
                  <th style={{ padding: '10px 12px', color: 'var(--text-secondary)', fontWeight: 700, borderBottom: '2px solid var(--border)', fontSize: 11, letterSpacing: '0.02em' }}>{lang === 'id' ? 'Unit Kerja & Tim' : 'Section & Team'}</th>
                  <th style={{ padding: '10px 12px', color: 'var(--text-secondary)', fontWeight: 700, borderBottom: '2px solid var(--border)', fontSize: 11, letterSpacing: '0.02em' }}>{lang === 'id' ? 'Waktu Masuk' : 'Clock In'}</th>
                  <th style={{ padding: '10px 12px', color: 'var(--text-secondary)', fontWeight: 700, borderBottom: '2px solid var(--border)', fontSize: 11, letterSpacing: '0.02em' }}>{lang === 'id' ? 'Waktu Pulang' : 'Clock Out'}</th>
                  <th style={{ padding: '10px 16px', color: 'var(--text-secondary)', fontWeight: 700, borderBottom: '2px solid var(--border)', fontSize: 11, letterSpacing: '0.02em' }}>{lang === 'id' ? 'Status Presensi' : 'Attendance Status'}</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.map((k, i) => (
                  <tr key={`${k.EMP_CD}-${k.DATE_TRANS}`} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'var(--bg-secondary)' : 'var(--bg-subtle)' }}>
                    <td style={{ padding: '10px 16px', fontSize: 11.5, fontWeight: 600, color: 'var(--text-primary)' }}>
                      {k.DATE_TRANS?.split('-').reverse().join('-')}
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'rgba(2, 132, 199, 0.15)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 750, fontSize: 11 }}>
                          {k.EMP_NM.charAt(0)}
                        </div>
                        <div>
                          <div style={{ fontWeight: 650, color: 'var(--text-primary)', fontSize: 12 }}>{k.EMP_NM}</div>
                          <div style={{ fontSize: 10.5, color: 'var(--text-muted)', fontWeight: 500 }}>{k.EMP_CD}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 11.5 }}>{k.BAGIAN || '-'}</div>
                      <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{k.TEAM || '-'}</div>
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: 11.5 }}>
                      {k.WORK_IN ? (
                        <span style={{ color: 'var(--text-primary)', fontWeight: 650 }}>{k.WORK_IN}</span>
                      ) : (
                        <span style={{ color: '#b91c1c', fontWeight: 650, background: '#fee2e2', border: '1px solid #fca5a5', padding: '2px 8px', borderRadius: '6px', fontSize: '10.5px' }}>
                          {lang === 'id' ? 'Belum Tercatat' : 'Missing'}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: 11.5 }}>
                      {k.WORK_OUT ? (
                        <span style={{ color: 'var(--text-primary)', fontWeight: 650 }}>{k.WORK_OUT}</span>
                      ) : (
                        <span style={{ color: '#b91c1c', fontWeight: 650, background: '#fee2e2', border: '1px solid #fca5a5', padding: '2px 8px', borderRadius: '6px', fontSize: '10.5px' }}>
                          {lang === 'id' ? 'Belum Tercatat' : 'Missing'}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: '6px', fontSize: 11, fontWeight: 600,
                        background: k.keterangan_kosong.startsWith('Alasan') || k.keterangan_kosong.includes('(') ? '#eff6ff'
                          : k.keterangan_kosong === 'Lupa Tap Masuk' ? '#fef9c3'
                          : k.keterangan_kosong === 'Lupa Tap Pulang' ? '#ffedd5'
                          : '#fee2e2',
                        color: k.keterangan_kosong.startsWith('Alasan') || k.keterangan_kosong.includes('(') ? '#1d4ed8'
                          : k.keterangan_kosong === 'Lupa Tap Masuk' ? '#854d0e'
                          : k.keterangan_kosong === 'Lupa Tap Pulang' ? '#9a3412'
                          : '#991b1b',
                        border: k.keterangan_kosong.startsWith('Alasan') || k.keterangan_kosong.includes('(') ? '1px solid #bfdbfe'
                          : k.keterangan_kosong === 'Lupa Tap Masuk' ? '1px solid #fde047'
                          : k.keterangan_kosong === 'Lupa Tap Pulang' ? '1px solid #fdba74'
                          : '1px solid #fca5a5',
                      }}>
                        <AlertTriangle size={11} />
                        {k.keterangan_kosong}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ padding: '60px 40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              {lang === 'id' ? 'Seluruh data presensi tercatat lengkap dan tertib pada tanggal ini.' : 'All attendance records are complete for this date.'}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
