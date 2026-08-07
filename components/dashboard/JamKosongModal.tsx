import React, { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import * as XLSX from 'xlsx';
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
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [localData, setLocalData] = useState<JamKosongRecord[]>(data);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [notSynced, setNotSynced] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Sync initial data if date is today, else keep localData
  useEffect(() => {
    if (selectedDate === new Date().toISOString().split('T')[0]) {
      setLocalData(data);
      setNotSynced(data.length === 0 && !loading);
    }
  }, [data, selectedDate, loading]);

  // Fetch data on date change
  useEffect(() => {
    if (!isOpen) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/dashboard/jam-kosong?date=${selectedDate}`);
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
    
    // Only fetch if it's not today (today is passed from props)
    if (selectedDate !== new Date().toISOString().split('T')[0]) {
      fetchData();
    }
  }, [selectedDate, isOpen]);

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

  const handleExport = () => {
    if (!filteredData || filteredData.length === 0) return;

    // Prepare data for export
    const exportData = filteredData.map((item, index) => ({
      No: index + 1,
      NIK: item.EMP_CD,
      'Nama Karyawan': item.EMP_NM,
      'Unit Kerja': item.BAGIAN || '-',
      'Tim': item.TEAM || '-',
      'Waktu Masuk': item.WORK_IN || '-',
      'Waktu Pulang': item.WORK_OUT || '-',
      'Status Presensi': item.keterangan_kosong
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Presensi Belum Lengkap');
    
    // Auto-size columns
    const wscols = [
      { wch: 5 },
      { wch: 15 },
      { wch: 30 },
      { wch: 25 },
      { wch: 20 },
      { wch: 15 },
      { wch: 15 },
      { wch: 25 }
    ];
    worksheet['!cols'] = wscols;

    XLSX.writeFile(workbook, `Rekap_Presensi_Belum_Lengkap_${selectedDate}.xlsx`);
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
                {localData.length} {lang === 'id' ? 'Karyawan terdeteksi hadir namun catatan waktu masuk/pulang belum lengkap.' : 'Employees with incomplete attendance records requiring review.'}
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
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
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
              <thead style={{ position: 'sticky', top: 0, zIndex: 10, backdropFilter: 'blur(10px)', backgroundColor: 'rgba(255, 255, 255, 0.05)' }}>
                <tr>
                  <th style={{ padding: '8px 16px', color: 'var(--text-secondary)', fontWeight: 600, borderBottom: '1px solid var(--border)', fontSize: 11 }}>{lang === 'id' ? 'Informasi Karyawan' : 'Employee'}</th>
                  <th style={{ padding: '8px 12px', color: 'var(--text-secondary)', fontWeight: 600, borderBottom: '1px solid var(--border)', fontSize: 11 }}>{lang === 'id' ? 'Unit Kerja & Tim' : 'Section & Team'}</th>
                  <th style={{ padding: '8px 12px', color: 'var(--text-secondary)', fontWeight: 600, borderBottom: '1px solid var(--border)', fontSize: 11 }}>{lang === 'id' ? 'Waktu Masuk' : 'Clock In'}</th>
                  <th style={{ padding: '8px 12px', color: 'var(--text-secondary)', fontWeight: 600, borderBottom: '1px solid var(--border)', fontSize: 11 }}>{lang === 'id' ? 'Waktu Pulang' : 'Clock Out'}</th>
                  <th style={{ padding: '8px 16px', color: 'var(--text-secondary)', fontWeight: 600, borderBottom: '1px solid var(--border)', fontSize: 11 }}>{lang === 'id' ? 'Status Presensi' : 'Attendance Status'}</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.map((k, i) => (
                  <tr key={k.EMP_CD} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'var(--bg-subtle)' }}>
                    <td style={{ padding: '8px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--accent-glow)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 11 }}>
                          {k.EMP_NM.charAt(0)}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 12 }}>{k.EMP_NM}</div>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{k.EMP_CD}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>
                      <div style={{ fontWeight: 500, color: 'var(--text-primary)', fontSize: 11.5 }}>{k.BAGIAN || '-'}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{k.TEAM || '-'}</div>
                    </td>
                    <td style={{ padding: '8px 12px', fontSize: 11 }}>
                      {k.WORK_IN ? (
                        <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{k.WORK_IN}</span>
                      ) : (
                        <span style={{ color: '#ef4444', fontWeight: 600, background: 'rgba(239, 68, 68, 0.1)', padding: '2px 6px', borderRadius: '4px' }}>
                          {lang === 'id' ? 'Belum Tercatat' : 'Missing'}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '8px 12px', fontSize: 11 }}>
                      {k.WORK_OUT ? (
                        <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{k.WORK_OUT}</span>
                      ) : (
                        <span style={{ color: '#ef4444', fontWeight: 600, background: 'rgba(239, 68, 68, 0.1)', padding: '2px 6px', borderRadius: '4px' }}>
                          {lang === 'id' ? 'Belum Tercatat' : 'Missing'}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '8px 16px' }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 7px', borderRadius: '4px', fontSize: 10.5, fontWeight: 550,
                        background: k.keterangan_kosong === 'Lupa Tap Masuk' ? 'rgba(234, 179, 8, 0.12)' : 'rgba(249, 115, 22, 0.12)',
                        color: k.keterangan_kosong === 'Lupa Tap Masuk' ? '#ca8a04' : '#ea580c'
                      }}>
                        <AlertTriangle size={11} />
                        {k.keterangan_kosong === 'Lupa Tap Masuk' 
                          ? (lang === 'id' ? 'Presensi Masuk Belum Tercatat' : 'Missing Clock In') 
                          : (lang === 'id' ? 'Presensi Pulang Belum Tercatat' : 'Missing Clock Out')}
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
