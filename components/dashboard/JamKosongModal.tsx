import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import * as XLSX from 'xlsx';
import { X, Download, AlertTriangle, Calendar, Loader2 } from 'lucide-react';
import type { JamKosongRecord } from '@/types';
import { t } from '@/lib/i18n';

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

  const [notSynced, setNotSynced] = useState(false);

  // Sync initial data if date is today, else keep localData
  useEffect(() => {
    if (selectedDate === new Date().toISOString().split('T')[0]) {
      setLocalData(data);
      setNotSynced(data.length === 0 && !loading);
    }
  }, [data, selectedDate]);

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
        console.error(err);
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
    setMounted(true);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !mounted) return null;

  const handleExport = () => {
    if (!localData || localData.length === 0) return;

    // Prepare data for export
    const exportData = localData.map((item, index) => ({
      No: index + 1,
      NIK: item.EMP_CD,
      'Nama Karyawan': item.EMP_NM,
      'Bagian': item.BAGIAN || '-',
      'Team': item.TEAM || '-',
      'Jam Masuk': item.WORK_IN || '-',
      'Jam Keluar': item.WORK_OUT || '-',
      'Keterangan Kosong': item.keterangan_kosong
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Jam Kosong');
    
    // Auto-size columns
    const wscols = [
      {wch: 5},
      {wch: 15},
      {wch: 30},
      {wch: 25},
      {wch: 20},
      {wch: 15},
      {wch: 15},
      {wch: 25}
    ];
    worksheet['!cols'] = wscols;

    XLSX.writeFile(workbook, `Rekap_Jam_Kosong_${selectedDate}.xlsx`);
  };

  return createPortal(
    <div className="liquid-glass-overlay" onClick={onClose} style={{ cursor: 'pointer' }}>
      {/* Hidden SVG Filter for Convex Lens Distortion */}
      <svg style={{ position: 'absolute', width: 0, height: 0 }} aria-hidden="true">
        <filter id="glass-distortion" x="0%" y="0%" width="100%" height="100%">
          <feImage result="mapX" preserveAspectRatio="none" href="data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPScxMDAnIGhlaWdodD0nMTAwJz48bGluZWFyR3JhZGllbnQgaWQ9J2cnIHgxPScwJyB5MT0nMCcgeDI9JzEwMCUnIHkyPScwJz48c3RvcCBvZmZzZXQ9JzAnIHN0b3AtY29sb3I9JyNmZjAwMDAnLz48c3RvcCBvZmZzZXQ9JzE1JScgc3RvcC1jb2xvcj0nI2MwMDAwMCcvPjxzdG9wIG9mZnNldD0nODUlJyBzdG9wLWNvbG9yPScjNDAwMDAwJy8+PHN0b3Agb2Zmc2V0PScxMDAlJyBzdG9wLWNvbG9yPScjMDAwMDAwJy8+PC9saW5lYXJHcmFkaWVudD48cmVjdCB3aWR0aD0nMTAwJyBoZWlnaHQ9JzEwMCcgZmlsbD0ndXJsKCNnKScvPjwvc3ZnPg==" />
          <feImage result="mapY" preserveAspectRatio="none" href="data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPScxMDAnIGhlaWdodD0nMTAwJz48bGluZWFyR3JhZGllbnQgaWQ9J2cnIHgxPScwJyB5MT0nMCcgeDI9JzAnIHkyPScxMDAlJz48c3RvcCBvZmZzZXQ9JzAnIHN0b3AtY29sb3I9JyMwMGZmMDAnLz48c3RvcCBvZmZzZXQ9JzE1JScgc3RvcC1jb2xvcj0nIzAwYzAwMCcvPjxzdG9wIG9mZnNldD0nODUlJyBzdG9wLWNvbG9yPScjMDA0MDAwJy8+PHN0b3Agb2Zmc2V0PScxMDAlJyBzdG9wLWNvbG9yPScjMDAwMDAwJy8+PC9saW5lYXJHcmFkaWVudD48cmVjdCB3aWR0aD0nMTAwJyBoZWlnaHQ9JzEwMCcgZmlsbD0ndXJsKCNnKScvPjwvc3ZnPg==" />
          <feBlend mode="screen" in="mapX" in2="mapY" result="lensMap" />
          <feDisplacementMap in="SourceGraphic" in2="lensMap" scale="50" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </svg>

      <div className="liquid-glass-modal" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()} style={{ 
        width: '90%', maxWidth: '800px', maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        cursor: 'default', padding: 0
      }}>
        <button onClick={onClose} className="liquid-glass-close" style={{ position: 'absolute', right: '16px', top: '16px', cursor: 'pointer', zIndex: 20 }}>
          <X size={24} />
        </button>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '24px 32px', borderBottom: '1px solid var(--border)', position: 'relative', zIndex: 10
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--warning-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--warning)' }}>
              <AlertTriangle size={20} />
            </div>
            <div>
              <h2 className="liquid-glass-modal-title" style={{ margin: 0, fontSize: 18 }}>{lang === 'id' ? 'Laporan Jam Kosong' : 'Missing Punches Report'}</h2>
              <p className="liquid-glass-modal-desc" style={{ margin: 0, fontSize: 13, marginTop: 4 }}>
                {localData.length} {lang === 'id' ? 'Karyawan memerlukan koreksi absen.' : 'Employees need attendance correction.'}
              </p>
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div style={{ padding: '16px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Calendar size={16} color="var(--text-secondary)" />
            <input 
              type="date" 
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{
                padding: '6px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
                background: 'var(--bg-subtle)', color: 'var(--text-primary)', fontSize: 13, outline: 'none'
              }}
            />
            {loading && <Loader2 size={16} className="spin" color="var(--text-secondary)" />}
          </div>
          
          {localData.length > 0 && (
            <button
              onClick={handleExport}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px',
                background: 'var(--success)', color: 'white', border: 'none', borderRadius: 'var(--radius-md)',
                fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s'
              }}
              onMouseOver={e => (e.currentTarget.style.transform = 'translateY(-1px)')}
              onMouseOut={e => (e.currentTarget.style.transform = 'none')}
            >
              <Download size={16} />
              Export to Excel
            </button>
          )}
        </div>

        {/* Content (Table) */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0' }}>
          {loading ? (
            <div style={{ padding: '60px 40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <Loader2 size={24} className="spin" style={{ margin: '0 auto 12px' }} />
              Memuat data...
            </div>
          ) : notSynced ? (
            <div style={{ padding: '60px 40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <AlertTriangle size={32} style={{ margin: '0 auto 12px', opacity: 0.5, color: 'var(--warning)' }} />
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                {lang === 'id' ? 'Data Absensi Belum Ditarik' : 'Attendance Data Not Synced'}
              </div>
              <div style={{ fontSize: 12 }}>
                {lang === 'id' ? 'Silakan lakukan sinkronisasi / tarik absensi dari mesin fingerprint terlebih dahulu.' : 'Please sync attendance from the fingerprint machine first.'}
              </div>
            </div>
          ) : localData.length > 0 ? (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 10, backdropFilter: 'blur(10px)', backgroundColor: 'var(--bg-subtle)' }}>
                <tr>
                  <th style={{ padding: '12px 24px', color: 'var(--text-secondary)', fontWeight: 600, borderBottom: '1px solid var(--border)' }}>Karyawan</th>
                  <th style={{ padding: '12px 24px', color: 'var(--text-secondary)', fontWeight: 600, borderBottom: '1px solid var(--border)' }}>Bagian & Team</th>
                  <th style={{ padding: '12px 24px', color: 'var(--text-secondary)', fontWeight: 600, borderBottom: '1px solid var(--border)' }}>Status Kosong</th>
                </tr>
              </thead>
              <tbody>
                {localData.map((k, i) => (
                <tr key={k.EMP_CD} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'var(--bg-subtle)' }}>
                  <td style={{ padding: '16px 24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--accent-glow)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                        {k.EMP_NM.charAt(0)}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600 }}>{k.EMP_NM}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{k.EMP_CD}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '16px 24px', color: 'var(--text-secondary)' }}>
                    <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{k.BAGIAN || '-'}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{k.TEAM || '-'}</div>
                  </td>
                  <td style={{ padding: '16px 24px' }}>
                    <span style={{
                      display: 'inline-block', padding: '4px 10px', borderRadius: '100px', fontSize: 11, fontWeight: 600,
                      background: k.keterangan_kosong === 'Belum Ada Rekaman Absen' ? 'var(--danger-bg)' : 'var(--warning-bg)',
                      color: k.keterangan_kosong === 'Belum Ada Rekaman Absen' ? 'var(--danger)' : 'var(--warning)'
                    }}>
                      {k.keterangan_kosong}
                    </span>
                  </td>
                </tr>
              ))}
              </tbody>
            </table>
          ) : (
            <div style={{ padding: '60px 40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Tidak ada data jam kosong untuk tanggal ini.
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
