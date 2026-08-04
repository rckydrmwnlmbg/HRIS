import React, { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import * as XLSX from 'xlsx';
import { X, Download, AlertCircle, Calendar, Loader2, Search, Clock, Zap } from 'lucide-react';
import type { PerluPerhatianRecord } from '@/types';

interface PerluPerhatianModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: PerluPerhatianRecord[];
  lang: 'id' | 'en';
}

type TabType = 'ALL' | 'PULANG_CEPAT' | 'TERLAMBAT' | 'DURASI_SINGKAT';

export default function PerluPerhatianModal({ isOpen, onClose, initialData = [], lang }: PerluPerhatianModalProps) {
  const [mounted, setMounted] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [data, setData] = useState<PerluPerhatianRecord[]>(initialData);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('ALL');

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch data on date change
  useEffect(() => {
    if (!isOpen) return;

    const isInitialToday = selectedDate === new Date().toISOString().split('T')[0] && initialData.length > 0;
    if (isInitialToday) {
      setData(initialData);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/dashboard/perlu-perhatian?date=${selectedDate}`);
        if (res.ok) {
          const result = await res.json();
          setData(result.data || []);
        }
      } catch (err) {
        console.error('Failed to fetch perlu perhatian data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedDate, isOpen, initialData]);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Tab counts
  const counts = useMemo(() => {
    let pulangCepat = 0;
    let terlambat = 0;
    let durasiSingkat = 0;

    data.forEach(item => {
      if (item.jenis_anomali === 'PULANG_CEPAT') pulangCepat++;
      else if (item.jenis_anomali === 'TERLAMBAT') terlambat++;
      else if (item.jenis_anomali === 'DURASI_SINGKAT') durasiSingkat++;
    });

    return {
      all: data.length,
      pulangCepat,
      terlambat,
      durasiSingkat
    };
  }, [data]);

  // Filtered data by Tab and Search
  const filteredData = useMemo(() => {
    return data.filter(item => {
      // Filter tab
      if (activeTab !== 'ALL' && item.jenis_anomali !== activeTab) {
        return false;
      }
      // Filter search
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchName = item.EMP_NM.toLowerCase().includes(q);
        const matchNik = item.EMP_CD.toLowerCase().includes(q);
        const matchBagian = (item.BAGIAN || '').toLowerCase().includes(q);
        return matchName || matchNik || matchBagian;
      }
      return true;
    });
  }, [data, activeTab, search]);

  if (!isOpen || !mounted) return null;

  const handleExport = () => {
    if (!filteredData || filteredData.length === 0) return;

    const exportData = filteredData.map((item, index) => ({
      No: index + 1,
      NIK: item.EMP_CD,
      'Nama Karyawan': item.EMP_NM,
      'Unit Kerja': item.BAGIAN || '-',
      'Tim': item.TEAM || '-',
      'Waktu Masuk': item.WORK_IN || '-',
      'Waktu Pulang': item.WORK_OUT || '-',
      'Durasi Kerja (Jam)': item.jam_kerja,
      'Kategori Penyesuaian': item.jenis_anomali === 'PULANG_CEPAT' ? 'Pulang Lebih Awal' : (item.jenis_anomali === 'TERLAMBAT' ? 'Keterlambatan' : 'Durasi Singkat'),
      'Catatan': item.keterangan
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Perlu Penyesuaian');

    const wscols = [
      { wch: 5 },
      { wch: 15 },
      { wch: 30 },
      { wch: 25 },
      { wch: 20 },
      { wch: 14 },
      { wch: 14 },
      { wch: 18 },
      { wch: 22 },
      { wch: 45 }
    ];
    worksheet['!cols'] = wscols;

    XLSX.writeFile(workbook, `Rekap_Perlu_Penyesuaian_${selectedDate}.xlsx`);
  };

  return createPortal(
    <div className="liquid-glass-overlay" onClick={onClose} style={{ cursor: 'pointer' }}>
      <div 
        className="liquid-glass-modal" 
        role="dialog" 
        aria-modal="true" 
        onClick={e => e.stopPropagation()} 
        style={{ 
          width: '92%', maxWidth: '900px', maxHeight: '90vh', display: 'flex', flexDirection: 'column',
          cursor: 'default', padding: 0
        }}
      >
        <button onClick={onClose} className="liquid-glass-close" style={{ position: 'absolute', right: '16px', top: '16px', cursor: 'pointer', zIndex: 20 }}>
          <X size={24} />
        </button>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '22px 32px', borderBottom: '1px solid var(--border)', position: 'relative', zIndex: 10
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ 
              width: 44, height: 44, borderRadius: '12px', background: 'rgba(245, 158, 11, 0.15)', 
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.3)' 
            }}>
              <Zap size={22} />
            </div>
            <div>
              <h2 className="liquid-glass-modal-title" style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
                {lang === 'id' ? 'Daftar Karyawan Perlu Penyesuaian Presensi' : 'Attendance Exceptions & Review'}
              </h2>
              <p className="liquid-glass-modal-desc" style={{ margin: 0, fontSize: 13, marginTop: 4 }}>
                {counts.all} {lang === 'id' ? 'karyawan memerlukan peninjauan catatan kehadiran (Pulang Lebih Awal, Keterlambatan, atau Durasi Singkat).' : 'employees require attendance review.'}
              </p>
            </div>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div style={{ padding: '14px 32px', display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', background: 'var(--bg-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-card)', padding: '6px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
              <Calendar size={15} color="var(--text-secondary)" />
              <input 
                type="date" 
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                style={{
                  border: 'none', background: 'transparent', color: 'var(--text-primary)', fontSize: 13, outline: 'none', cursor: 'pointer'
                }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-card)', padding: '6px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', width: 240 }}>
              <Search size={14} color="var(--text-muted)" />
              <input 
                type="text" 
                placeholder={lang === 'id' ? 'Cari nama, NIK, atau bagian...' : 'Search name, ID, or section...'}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  border: 'none', background: 'transparent', color: 'var(--text-primary)', fontSize: 13, outline: 'none', width: '100%'
                }}
              />
              {search && (
                <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--text-muted)' }}>
                  <X size={14} />
                </button>
              )}
            </div>

            {loading && <Loader2 size={16} className="spin" color="var(--text-secondary)" />}
          </div>
          
          {filteredData.length > 0 && (
            <button
              onClick={handleExport}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '7px 16px',
                background: '#10B981', color: 'white', border: 'none', borderRadius: 'var(--radius-md)',
                fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 2px 6px rgba(16, 185, 129, 0.2)'
              }}
              onMouseOver={e => (e.currentTarget.style.transform = 'translateY(-1px)')}
              onMouseOut={e => (e.currentTarget.style.transform = 'none')}
            >
              <Download size={15} />
              {lang === 'id' ? 'Unduh Excel' : 'Export Excel'}
            </button>
          )}
        </div>

        {/* Tab Pills */}
        <div style={{ display: 'flex', gap: 8, padding: '12px 32px', borderBottom: '1px solid var(--border)', background: 'var(--bg-card)' }}>
          {[
            { id: 'ALL' as TabType, label: lang === 'id' ? 'Semua' : 'All', count: counts.all, color: 'var(--text-secondary)' },
            { id: 'PULANG_CEPAT' as TabType, label: lang === 'id' ? 'Pulang Lebih Awal' : 'Early Leave', count: counts.pulangCepat, color: '#f59e0b' },
            { id: 'TERLAMBAT' as TabType, label: lang === 'id' ? 'Keterlambatan' : 'Late Arrival', count: counts.terlambat, color: '#ef4444' },
            { id: 'DURASI_SINGKAT' as TabType, label: lang === 'id' ? 'Durasi Singkat' : 'Short Duration', count: counts.durasiSingkat, color: '#8b5cf6' },
          ].map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: '6px 14px', borderRadius: '100px', fontSize: 12, fontWeight: 600,
                  border: isActive ? `1px solid ${tab.color}` : '1px solid var(--border)',
                  background: isActive ? (tab.id === 'ALL' ? 'var(--accent-glow)' : `${tab.color}18`) : 'transparent',
                  color: isActive ? (tab.id === 'ALL' ? 'var(--accent)' : tab.color) : 'var(--text-secondary)',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.15s'
                }}
              >
                <span>{tab.label}</span>
                <span style={{ 
                  background: isActive ? (tab.id === 'ALL' ? 'var(--accent)' : tab.color) : 'var(--border)', 
                  color: isActive ? 'white' : 'var(--text-muted)',
                  fontSize: 10, padding: '1px 6px', borderRadius: '10px'
                }}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Content Table */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0' }}>
          {loading ? (
            <div style={{ padding: '60px 40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <Loader2 size={24} className="spin" style={{ margin: '0 auto 12px' }} />
              {lang === 'id' ? 'Memuat data...' : 'Loading data...'}
            </div>
          ) : filteredData.length > 0 ? (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 10, backdropFilter: 'blur(10px)', backgroundColor: 'var(--bg-subtle)' }}>
                <tr>
                  <th style={{ padding: '12px 24px', color: 'var(--text-secondary)', fontWeight: 600, borderBottom: '1px solid var(--border)' }}>{lang === 'id' ? 'Informasi Karyawan' : 'Employee'}</th>
                  <th style={{ padding: '12px 18px', color: 'var(--text-secondary)', fontWeight: 600, borderBottom: '1px solid var(--border)' }}>{lang === 'id' ? 'Unit Kerja & Tim' : 'Section & Team'}</th>
                  <th style={{ padding: '12px 18px', color: 'var(--text-secondary)', fontWeight: 600, borderBottom: '1px solid var(--border)' }}>{lang === 'id' ? 'Waktu Masuk & Pulang' : 'Clock In / Out'}</th>
                  <th style={{ padding: '12px 18px', color: 'var(--text-secondary)', fontWeight: 600, borderBottom: '1px solid var(--border)' }}>{lang === 'id' ? 'Durasi Kerja' : 'Work Hours'}</th>
                  <th style={{ padding: '12px 24px', color: 'var(--text-secondary)', fontWeight: 600, borderBottom: '1px solid var(--border)' }}>{lang === 'id' ? 'Catatan Penyesuaian' : 'Adjustment Details'}</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.map((k, i) => (
                  <tr key={k.EMP_CD} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'var(--bg-subtle)' }}>
                    <td style={{ padding: '14px 24px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--accent-glow)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13 }}>
                          {k.EMP_NM.charAt(0)}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{k.EMP_NM}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{k.EMP_CD}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '14px 18px', color: 'var(--text-secondary)' }}>
                      <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{k.BAGIAN || '-'}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{k.TEAM || '-'}</div>
                    </td>
                    <td style={{ padding: '14px 18px', fontSize: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ color: k.jenis_anomali === 'TERLAMBAT' ? '#ef4444' : 'var(--text-primary)', fontWeight: k.jenis_anomali === 'TERLAMBAT' ? 700 : 500 }}>
                          {lang === 'id' ? 'Masuk' : 'In'}: {k.WORK_IN || '-'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                        <span style={{ color: k.jenis_anomali === 'PULANG_CEPAT' ? '#f59e0b' : 'var(--text-primary)', fontWeight: k.jenis_anomali === 'PULANG_CEPAT' ? 700 : 500 }}>
                          {lang === 'id' ? 'Pulang' : 'Out'}: {k.WORK_OUT || '-'}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: '14px 18px' }}>
                      <span style={{
                        display: 'inline-block', padding: '3px 8px', borderRadius: '6px', fontSize: 12, fontWeight: 700,
                        background: k.jam_kerja < 7.0 ? 'rgba(239, 68, 68, 0.12)' : 'var(--bg-subtle)',
                        color: k.jam_kerja < 7.0 ? '#ef4444' : 'var(--text-primary)'
                      }}>
                        {k.jam_kerja} {lang === 'id' ? 'Jam' : 'Hrs'}
                      </span>
                    </td>
                    <td style={{ padding: '14px 24px' }}>
                      <div style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: '8px', fontSize: 11, fontWeight: 600,
                        background: k.jenis_anomali === 'PULANG_CEPAT' ? 'rgba(245, 158, 11, 0.12)' : (k.jenis_anomali === 'TERLAMBAT' ? 'rgba(239, 68, 68, 0.12)' : 'rgba(139, 92, 246, 0.12)'),
                        color: k.jenis_anomali === 'PULANG_CEPAT' ? '#f59e0b' : (k.jenis_anomali === 'TERLAMBAT' ? '#ef4444' : '#8b5cf6')
                      }}>
                        <AlertCircle size={13} />
                        {k.keterangan}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ padding: '60px 40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              {lang === 'id' ? 'Seluruh presensi karyawan tercatat sesuai jadwal & tidak memerlukan penyesuaian pada tanggal ini.' : 'No attendance exceptions found for this date.'}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
