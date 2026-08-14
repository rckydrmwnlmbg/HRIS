'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { 
  TrendingUp, 
  Download, 
  Calendar, 
  Check, 
  FileSpreadsheet, 
  Layers
} from 'lucide-react';
import { useApp } from '@/lib/context';
import { useToast } from '@/components/ui/ToastProvider';
import { Modal } from '@/components/ui/Modal';
import styles from './AttendanceTrendChart.module.css';

const MONTH_OPTIONS = [
  { value: 1, label: 'Januari' },
  { value: 2, label: 'Februari' },
  { value: 3, label: 'Maret' },
  { value: 4, label: 'April' },
  { value: 5, label: 'Mei' },
  { value: 6, label: 'Juni' },
  { value: 7, label: 'Juli' },
  { value: 8, label: 'Agustus' },
  { value: 9, label: 'September' },
  { value: 10, label: 'Oktober' },
  { value: 11, label: 'November' },
  { value: 12, label: 'Desember' },
];

export default function AttendanceTrendChart() {
  const { settings } = useApp();
  const { showToast } = useToast();
  const lang = settings.language || 'id';

  const [trendData, setTrendData] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [timeRange, setTimeRange] = useState<'30d' | '3m' | '6m'>('6m');

  // Series visibility toggles (Clickable legend)
  const [showAlpha, setShowAlpha] = useState<boolean>(true);
  const [showIzin, setShowIzin] = useState<boolean>(true);
  const [showSakit, setShowSakit] = useState<boolean>(true);
  const [showCuti, setShowCuti] = useState<boolean>(true);

  // Export Modal states
  const [showExportModal, setShowExportModal] = useState<boolean>(false);
  const [exportMode, setExportMode] = useState<'monthly' | 'custom'>('monthly');
  const [isMultiMonth, setIsMultiMonth] = useState<boolean>(false);
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [startMonth, setStartMonth] = useState<number>(1);
  const [endMonth, setEndMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);

  // Fetch trend data whenever timeRange changes
  const fetchTrend = async (range: '30d' | '3m' | '6m') => {
    setLoading(true);
    try {
      const res = await fetch(`/api/dashboard/trend?range=${range}`);
      if (res.ok) {
        const data = await res.json();
        setTrendData(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Failed to load trend data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrend(timeRange);
  }, [timeRange]);

  // Execute Excel Export Download
  const handleDownloadExcel = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsDownloading(true);

    try {
      let downloadUrl = '/api/laporan/export?type=ketidakhadiran';

      if (exportMode === 'monthly') {
        if (isMultiMonth) {
          downloadUrl += `&startMonth=${startMonth}&endMonth=${endMonth}&tahun=${selectedYear}`;
        } else {
          downloadUrl += `&bulan=${selectedMonth}&tahun=${selectedYear}`;
        }
      } else {
        downloadUrl += `&start=${startDate}&end=${endDate}`;
      }

      showToast(lang === 'id' ? 'Menyiapkan file Excel...' : 'Preparing Excel file...', 'info');

      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', '');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setTimeout(() => {
        setIsDownloading(false);
        setShowExportModal(false);
        showToast(lang === 'id' ? 'Laporan berhasil diunduh' : 'Report downloaded successfully', 'success');
      }, 1000);
    } catch (err) {
      showToast(lang === 'id' ? 'Gagal mengunduh laporan' : 'Failed to download report', 'error');
      setIsDownloading(false);
    }
  };

  // Custom Glassmorphic Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const total = payload.reduce((sum: number, entry: any) => sum + (Number(entry.value) || 0), 0);
      return (
        <div className={styles.tooltipCard}>
          <div className={styles.tooltipTitle}>
            📅 {label}
          </div>
          {payload.map((entry: any, index: number) => (
            <div key={`item-${index}`} className={styles.tooltipRow}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: entry.color }} />
                <span style={{ color: 'var(--text-secondary)' }}>{entry.name}:</span>
              </div>
              <strong style={{ color: 'var(--text-primary)' }}>{entry.value} org</strong>
            </div>
          ))}
          <div style={{ borderTop: '1px dashed var(--border)', marginTop: '4px', paddingTop: '4px', display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
            <span>Total Absen:</span>
            <span style={{ color: 'var(--accent)' }}>{total} org</span>
          </div>
        </div>
      );
    }
    return null;
  };

  const isDark = settings.darkMode;

  const colors = useMemo(() => {
    if (isDark) {
      return {
        alpha: { stroke: '#FB7185', top: '#F43F5E', topOpacity: 0.35, midOpacity: 0.12, fill: 'url(#gradientAlpha)' },
        izin: { stroke: '#38BDF8', top: '#0EA5E9', topOpacity: 0.32, midOpacity: 0.10, fill: 'url(#gradientIzin)' },
        sakit: { stroke: '#FBBF24', top: '#F59E0B', topOpacity: 0.32, midOpacity: 0.10, fill: 'url(#gradientSakit)' },
        cuti: { stroke: '#A78BFA', top: '#8B5CF6', topOpacity: 0.32, midOpacity: 0.10, fill: 'url(#gradientCuti)' },
      };
    }
    // Silky Smooth Light Mode Palette
    return {
      alpha: { stroke: '#E11D48', top: '#FB7185', topOpacity: 0.22, midOpacity: 0.06, fill: 'url(#gradientAlpha)' },
      izin: { stroke: '#0284C7', top: '#38BDF8', topOpacity: 0.20, midOpacity: 0.05, fill: 'url(#gradientIzin)' },
      sakit: { stroke: '#D97706', top: '#FBBF24', topOpacity: 0.20, midOpacity: 0.05, fill: 'url(#gradientSakit)' },
      cuti: { stroke: '#7C3AED', top: '#A78BFA', topOpacity: 0.20, midOpacity: 0.05, fill: 'url(#gradientCuti)' },
    };
  }, [isDark]);

  return (
    <div className={`glass-card stagger-2 ${styles.trendCard}`}>
      {/* Top Header Row */}
      <div className={styles.header}>
        <div className={styles.titleArea}>
          <div style={{
            width: '24px',
            height: '24px',
            borderRadius: 'var(--radius-sm)',
            background: isDark 
              ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(245, 158, 11, 0.15))'
              : 'linear-gradient(135deg, rgba(244, 63, 94, 0.12), rgba(245, 158, 11, 0.1))',
            border: `1px solid ${isDark ? 'rgba(239, 68, 68, 0.3)' : 'rgba(244, 63, 94, 0.25)'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: colors.alpha.stroke
          }}>
            <TrendingUp size={13} />
          </div>
          <h3 className={styles.title}>
            {lang === 'id' ? 'Tren Ketidakhadiran' : 'Absence Trend'}
          </h3>
        </div>

        <div className={styles.controlsArea}>
          {/* Range Selector */}
          <div className={styles.rangePills}>
            <button
              className={`${styles.rangeBtn} ${timeRange === '30d' ? styles.rangeBtnActive : ''}`}
              onClick={() => setTimeRange('30d')}
            >
              30 Hari
            </button>
            <button
              className={`${styles.rangeBtn} ${timeRange === '3m' ? styles.rangeBtnActive : ''}`}
              onClick={() => setTimeRange('3m')}
            >
              3 Bulan
            </button>
            <button
              className={`${styles.rangeBtn} ${timeRange === '6m' ? styles.rangeBtnActive : ''}`}
              onClick={() => setTimeRange('6m')}
            >
              6 Bulan
            </button>
          </div>

          {/* Export Excel Button */}
          <button className={styles.exportBtn} onClick={() => setShowExportModal(true)}>
            <Download size={12} />
            <span>Ekspor Excel</span>
          </button>
        </div>
      </div>

      {/* Series Filter Row (Interactive Click-to-Toggle) */}
      <div className={styles.legendFilterRow}>
        <div className={styles.filterChips}>
          <button
            className={`${styles.filterChip} ${showAlpha ? styles.filterChipActive : styles.filterChipInactive}`}
            onClick={() => setShowAlpha(!showAlpha)}
            title="Klik untuk sembunyikan/tampilkan Alpha"
          >
            <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: colors.alpha.stroke }} />
            <span>Alpha</span>
          </button>

          <button
            className={`${styles.filterChip} ${showIzin ? styles.filterChipActive : styles.filterChipInactive}`}
            onClick={() => setShowIzin(!showIzin)}
            title="Klik untuk sembunyikan/tampilkan Izin"
          >
            <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: colors.izin.stroke }} />
            <span>Izin</span>
          </button>

          <button
            className={`${styles.filterChip} ${showSakit ? styles.filterChipActive : styles.filterChipInactive}`}
            onClick={() => setShowSakit(!showSakit)}
            title="Klik untuk sembunyikan/tampilkan Sakit"
          >
            <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: colors.sakit.stroke }} />
            <span>Sakit</span>
          </button>

          <button
            className={`${styles.filterChip} ${showCuti ? styles.filterChipActive : styles.filterChipInactive}`}
            onClick={() => setShowCuti(!showCuti)}
            title="Klik untuk sembunyikan/tampilkan Cuti"
          >
            <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: colors.cuti.stroke }} />
            <span>Cuti</span>
          </button>
        </div>

        <span className={styles.statBadge}>
          *Klik kategori untuk memfilter grafik
        </span>
      </div>

      {/* Area Chart Container */}
      <div style={{ flex: 1, minHeight: 220, marginTop: 4 }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', width: '100%' }}>
            <div className="spinner" style={{ width: 26, height: 26, borderWidth: 2.5 }} />
          </div>
        ) : trendData.length === 0 ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', width: '100%', color: 'var(--text-secondary)', fontSize: '12px' }}>
            {lang === 'id' ? 'Belum ada data tren presensi' : 'No attendance trend data available'}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trendData} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
              <defs>
                <linearGradient id="gradientAlpha" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={colors.alpha.top} stopOpacity={colors.alpha.topOpacity} />
                  <stop offset="60%" stopColor={colors.alpha.top} stopOpacity={colors.alpha.midOpacity} />
                  <stop offset="100%" stopColor={colors.alpha.top} stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="gradientIzin" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={colors.izin.top} stopOpacity={colors.izin.topOpacity} />
                  <stop offset="60%" stopColor={colors.izin.top} stopOpacity={colors.izin.midOpacity} />
                  <stop offset="100%" stopColor={colors.izin.top} stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="gradientSakit" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={colors.sakit.top} stopOpacity={colors.sakit.topOpacity} />
                  <stop offset="60%" stopColor={colors.sakit.top} stopOpacity={colors.sakit.midOpacity} />
                  <stop offset="100%" stopColor={colors.sakit.top} stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="gradientCuti" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={colors.cuti.top} stopOpacity={colors.cuti.topOpacity} />
                  <stop offset="60%" stopColor={colors.cuti.top} stopOpacity={colors.cuti.midOpacity} />
                  <stop offset="100%" stopColor={colors.cuti.top} stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" opacity={isDark ? 0.35 : 0.25} />
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 10.5, fill: 'var(--text-muted)' }} 
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 10.5, fill: 'var(--text-muted)' }} 
                allowDecimals={false} 
              />
              <Tooltip content={<CustomTooltip />} />

              {showIzin && (
                <Area 
                  type="monotone" 
                  dataKey="izin" 
                  stackId="1"
                  stroke={colors.izin.stroke} 
                  strokeWidth={2}
                  fillOpacity={1}
                  fill={colors.izin.fill} 
                  name="Izin" 
                />
              )}
              {showSakit && (
                <Area 
                  type="monotone" 
                  dataKey="sakit" 
                  stackId="1"
                  stroke={colors.sakit.stroke} 
                  strokeWidth={2}
                  fillOpacity={1}
                  fill={colors.sakit.fill} 
                  name="Sakit" 
                />
              )}
              {showCuti && (
                <Area 
                  type="monotone" 
                  dataKey="cuti" 
                  stackId="1"
                  stroke={colors.cuti.stroke} 
                  strokeWidth={2}
                  fillOpacity={1}
                  fill={colors.cuti.fill} 
                  name="Cuti" 
                />
              )}
              {showAlpha && (
                <Area 
                  type="monotone" 
                  dataKey="alpha" 
                  stackId="1"
                  stroke={colors.alpha.stroke} 
                  strokeWidth={2}
                  fillOpacity={1}
                  fill={colors.alpha.fill} 
                  name="Alpha" 
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Export Excel Modal */}
      <Modal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        title="Unduh Laporan Alpha & Izin (Excel)"
      >
        <form onSubmit={handleDownloadExcel} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Mode Tabs */}
          <div className={styles.modeTabs}>
            <button
              type="button"
              className={`${styles.modeTab} ${exportMode === 'monthly' ? styles.modeTabActive : ''}`}
              onClick={() => setExportMode('monthly')}
            >
              <Calendar size={13} style={{ display: 'inline', marginRight: '5px' }} />
              Pilihan Bulan (Bulanan)
            </button>
            <button
              type="button"
              className={`${styles.modeTab} ${exportMode === 'custom' ? styles.modeTabActive : ''}`}
              onClick={() => setExportMode('custom')}
            >
              <FileSpreadsheet size={13} style={{ display: 'inline', marginRight: '5px' }} />
              Rentang Tanggal Kustom
            </button>
          </div>

          {exportMode === 'monthly' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                <input
                  type="checkbox"
                  id="multiMonthToggle"
                  checked={isMultiMonth}
                  onChange={e => setIsMultiMonth(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                <label htmlFor="multiMonthToggle" style={{ cursor: 'pointer', color: 'var(--text-primary)', fontWeight: 550 }}>
                  Pilih Rentang Lebih Dari 1 Bulan (Multi-Bulan)
                </label>
              </div>

              {!isMultiMonth ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div className="form-group">
                    <label className="form-label">Pilih Bulan</label>
                    <select
                      className="form-select"
                      value={selectedMonth}
                      onChange={e => setSelectedMonth(Number(e.target.value))}
                    >
                      {MONTH_OPTIONS.map(m => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Tahun</label>
                    <input
                      type="number"
                      className="form-input"
                      value={selectedYear}
                      onChange={e => setSelectedYear(Number(e.target.value))}
                    />
                  </div>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                  <div className="form-group">
                    <label className="form-label">Dari Bulan</label>
                    <select
                      className="form-select"
                      value={startMonth}
                      onChange={e => setStartMonth(Number(e.target.value))}
                    >
                      {MONTH_OPTIONS.map(m => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Sampai Bulan</label>
                    <select
                      className="form-select"
                      value={endMonth}
                      onChange={e => setEndMonth(Number(e.target.value))}
                    >
                      {MONTH_OPTIONS.map(m => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Tahun</label>
                    <input
                      type="number"
                      className="form-input"
                      value={selectedYear}
                      onChange={e => setSelectedYear(Number(e.target.value))}
                    />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div className="form-group">
                <label className="form-label">Tanggal Mulai (Start Date)</label>
                <input
                  type="date"
                  className="form-input"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Tanggal Selesai (End Date)</label>
                <input
                  type="date"
                  className="form-input"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  required
                />
              </div>
            </div>
          )}

          <div style={{ background: 'var(--bg-subtle)', padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: '11px', color: 'var(--text-secondary)' }}>
            <strong>💡 Format File Excel:</strong> Berisi 2 Sheet resmi (Sheet 1: <em>Rekapitulasi Harian & Total Bulanan</em>, Sheet 2: <em>Rincian Data Karyawan Alpha, Izin, Sakit, & Cuti</em>).
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setShowExportModal(false)}
            >
              Batal
            </button>
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              disabled={isDownloading}
            >
              <Download size={13} />
              <span>{isDownloading ? 'Mengunduh...' : 'Unduh File Excel'}</span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
