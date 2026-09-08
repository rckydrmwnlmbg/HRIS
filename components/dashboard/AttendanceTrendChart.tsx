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
  TrendingDown, 
  Download, 
  Calendar, 
  FileSpreadsheet
} from 'lucide-react';
import { useApp } from '@/lib/context';
import { useToast } from '@/components/ui/ToastProvider';
import { Modal } from '@/components/ui/Modal';
import { Skeleton } from '@/components/ui/Skeleton';
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

  // Series visibility toggles (Clickable cards)
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

  // Compute Stage Metrics (Totals & Trend Percentage)
  const stats = useMemo(() => {
    const compute = (key: 'alpha' | 'izin' | 'sakit' | 'cuti') => {
      if (!trendData || trendData.length === 0) {
        return { total: 0, change: 0 };
      }
      const total = trendData.reduce((acc, curr) => acc + (Number(curr[key]) || 0), 0);
      if (trendData.length < 2) {
        return { total, change: 0 };
      }
      const mid = Math.floor(trendData.length / 2);
      const firstHalf = trendData.slice(0, mid).reduce((sum, d) => sum + (Number(d[key]) || 0), 0);
      const secondHalf = trendData.slice(mid).reduce((sum, d) => sum + (Number(d[key]) || 0), 0);
      let change = 0;
      if (firstHalf > 0) {
        change = Math.round(((secondHalf - firstHalf) / firstHalf) * 100);
      } else if (secondHalf > 0) {
        change = 100;
      }
      return { total, change };
    };

    return {
      alpha: compute('alpha'),
      izin: compute('izin'),
      sakit: compute('sakit'),
      cuti: compute('cuti'),
    };
  }, [trendData]);

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

  const isDark = settings.darkMode;

  const colors = useMemo(() => {
    if (isDark) {
      return {
        alpha: { stroke: '#FB7185', top: '#F43F5E', topOpacity: 0.38, midOpacity: 0.12, fill: 'url(#gradientAlpha)' },
        izin: { stroke: '#38BDF8', top: '#0EA5E9', topOpacity: 0.35, midOpacity: 0.10, fill: 'url(#gradientIzin)' },
        sakit: { stroke: '#FBBF24', top: '#F59E0B', topOpacity: 0.35, midOpacity: 0.10, fill: 'url(#gradientSakit)' },
        cuti: { stroke: '#A78BFA', top: '#8B5CF6', topOpacity: 0.35, midOpacity: 0.10, fill: 'url(#gradientCuti)' },
      };
    }
    // Rich Silky Light Mode Palette
    return {
      alpha: { stroke: '#E11D48', top: '#FB7185', topOpacity: 0.28, midOpacity: 0.08, fill: 'url(#gradientAlpha)' },
      izin: { stroke: '#0284C7', top: '#38BDF8', topOpacity: 0.25, midOpacity: 0.07, fill: 'url(#gradientIzin)' },
      sakit: { stroke: '#D97706', top: '#FBBF24', topOpacity: 0.25, midOpacity: 0.07, fill: 'url(#gradientSakit)' },
      cuti: { stroke: '#7C3AED', top: '#A78BFA', topOpacity: 0.25, midOpacity: 0.07, fill: 'url(#gradientCuti)' },
    };
  }, [isDark]);

  // Stage Metrics Definition (area-charts-2 style)
  const stageMetrics = [
    {
      key: 'alpha',
      label: 'Alpha',
      color: colors.alpha.stroke,
      active: showAlpha,
      onToggle: () => setShowAlpha(!showAlpha),
      total: stats.alpha.total,
      change: stats.alpha.change,
      trendClass: stats.alpha.change > 0 ? styles.trendBad : stats.alpha.change < 0 ? styles.trendGood : styles.trendNeutral,
    },
    {
      key: 'izin',
      label: 'Izin',
      color: colors.izin.stroke,
      active: showIzin,
      onToggle: () => setShowIzin(!showIzin),
      total: stats.izin.total,
      change: stats.izin.change,
      trendClass: stats.izin.change > 0 ? styles.trendWarning : stats.izin.change < 0 ? styles.trendGood : styles.trendNeutral,
    },
    {
      key: 'sakit',
      label: 'Sakit',
      color: colors.sakit.stroke,
      active: showSakit,
      onToggle: () => setShowSakit(!showSakit),
      total: stats.sakit.total,
      change: stats.sakit.change,
      trendClass: stats.sakit.change > 0 ? styles.trendBad : stats.sakit.change < 0 ? styles.trendGood : styles.trendNeutral,
    },
    {
      key: 'cuti',
      label: 'Cuti',
      color: colors.cuti.stroke,
      active: showCuti,
      onToggle: () => setShowCuti(!showCuti),
      total: stats.cuti.total,
      change: stats.cuti.change,
      trendClass: stats.cuti.change > 0 ? styles.trendGood : stats.cuti.change < 0 ? styles.trendNeutral : styles.trendNeutral,
    },
  ];

  // Custom Glassmorphic Tooltip (area-charts-2 style)
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      // Filter out pattern areas which have transparent stroke
      const validEntries = payload.filter((p: any) => p.stroke !== 'transparent');
      const total = validEntries.reduce((sum: number, entry: any) => sum + (Number(entry.value) || 0), 0);
      const sortedEntries = [...validEntries].sort((a: any, b: any) => (Number(b.value) || 0) - (Number(a.value) || 0));

      return (
        <div className={styles.tooltipCard}>
          <div className={styles.tooltipTitle}>
            <span>📅</span>
            <span>{label}</span>
          </div>
          {sortedEntries.map((entry: any, index: number) => (
            <div key={`item-${index}`} className={styles.tooltipRow}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div 
                  className={styles.tooltipIndicator} 
                  style={{ backgroundColor: entry.stroke || entry.color }} 
                />
                <span style={{ color: 'var(--text-secondary)' }}>{entry.name}:</span>
              </div>
              <strong style={{ color: 'var(--text-primary)' }}>{entry.value} org</strong>
            </div>
          ))}
          <div className={styles.tooltipTotalRow}>
            <span style={{ color: 'var(--text-secondary)' }}>Total Absen:</span>
            <span style={{ color: 'var(--accent)' }}>{total} org</span>
          </div>
        </div>
      );
    }
    return null;
  };

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
              type="button"
              className={`${styles.rangeBtn} ${timeRange === '30d' ? styles.rangeBtnActive : ''}`}
              onClick={() => setTimeRange('30d')}
            >
              30 Hari
            </button>
            <button
              type="button"
              className={`${styles.rangeBtn} ${timeRange === '3m' ? styles.rangeBtnActive : ''}`}
              onClick={() => setTimeRange('3m')}
            >
              3 Bulan
            </button>
            <button
              type="button"
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

      {/* Stage Metrics Grid (area-charts-2 KPI Blocks) */}
      <div className={styles.metricsGrid}>
        {stageMetrics.map((stage) => (
          <div
            key={stage.key}
            className={`${styles.metricCard} ${stage.active ? styles.metricCardActive : styles.metricCardInactive}`}
            onClick={stage.onToggle}
            role="button"
            tabIndex={0}
            title={lang === 'id' 
              ? `Klik untuk ${stage.active ? 'menyembunyikan' : 'menampilkan'} ${stage.label}`
              : `Click to ${stage.active ? 'hide' : 'show'} ${stage.label}`}
          >
            <div 
              className={styles.metricBar} 
              style={{ backgroundColor: stage.color }} 
            />
            <div className={styles.metricContent}>
              <div className={styles.metricLabelRow}>
                <span className={styles.metricLabel}>{stage.label}</span>
                {!stage.active && (
                  <span className={styles.inactiveTag}>
                    {lang === 'id' ? 'Nonaktif' : 'Hidden'}
                  </span>
                )}
              </div>
              <div className={styles.metricValueRow}>
                <span className={styles.metricValue}>
                  {loading ? '...' : stage.total.toLocaleString('id-ID')}
                </span>
                {!loading && (
                  <span className={`${styles.trendPill} ${stage.trendClass}`}>
                    {stage.change >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                    <span>{stage.change >= 0 ? `+${stage.change}%` : `${stage.change}%`}</span>
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className={styles.helperRow}>
        <span className={styles.helperText}>
          {lang === 'id' ? '*Klik kartu kategori untuk menyaring grafik' : '*Click metric card to toggle series'}
        </span>
      </div>

      {/* Area Chart Container */}
      <div className={styles.chartWrapper}>
        {loading ? (
          <div style={{ height: '100%', minHeight: '230px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <Skeleton width="100%" height="100%" style={{ borderRadius: 'var(--radius-md)', minHeight: '230px' }} />
          </div>
        ) : trendData.length === 0 ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', width: '100%', color: 'var(--text-secondary)', fontSize: '12px' }}>
            {lang === 'id' ? 'Belum ada data tren presensi' : 'No attendance trend data available'}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trendData} margin={{ top: 12, right: 8, left: -22, bottom: 2 }}>
              <defs>
                {/* Modern Abstract Geometric Background Pattern (area-charts-2) */}
                <pattern id="modernPattern" x="0" y="0" width="32" height="32" patternUnits="userSpaceOnUse">
                  <path
                    d="M0,16 L32,16 M16,0 L16,32"
                    stroke="var(--text-muted)"
                    strokeWidth="0.5"
                    strokeOpacity={isDark ? 0.08 : 0.05}
                  />
                  <path
                    d="M0,0 L32,32 M0,32 L32,0"
                    stroke="var(--text-muted)"
                    strokeWidth="0.3"
                    strokeOpacity={isDark ? 0.06 : 0.03}
                  />
                  <circle cx="8" cy="8" r="1.5" fill="var(--text-muted)" fillOpacity={isDark ? 0.08 : 0.05} />
                  <circle cx="24" cy="24" r="1.5" fill="var(--text-muted)" fillOpacity={isDark ? 0.08 : 0.05} />
                  <rect x="12" y="4" width="8" height="2" rx="1" fill="var(--text-muted)" fillOpacity={isDark ? 0.07 : 0.04} />
                  <rect x="4" y="26" width="8" height="2" rx="1" fill="var(--text-muted)" fillOpacity={isDark ? 0.07 : 0.04} />
                  <rect x="20" y="12" width="2" height="8" rx="1" fill="var(--text-muted)" fillOpacity={isDark ? 0.07 : 0.04} />
                  <circle cx="6" cy="20" r="0.5" fill="var(--text-muted)" fillOpacity={isDark ? 0.12 : 0.08} />
                  <circle cx="26" cy="10" r="0.5" fill="var(--text-muted)" fillOpacity={isDark ? 0.12 : 0.08} />
                  <circle cx="14" cy="28" r="0.5" fill="var(--text-muted)" fillOpacity={isDark ? 0.12 : 0.08} />
                </pattern>

                <linearGradient id="gradientAlpha" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={colors.alpha.top} stopOpacity={colors.alpha.topOpacity} />
                  <stop offset="55%" stopColor={colors.alpha.top} stopOpacity={colors.alpha.midOpacity} />
                  <stop offset="100%" stopColor={colors.alpha.top} stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="gradientIzin" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={colors.izin.top} stopOpacity={colors.izin.topOpacity} />
                  <stop offset="55%" stopColor={colors.izin.top} stopOpacity={colors.izin.midOpacity} />
                  <stop offset="100%" stopColor={colors.izin.top} stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="gradientSakit" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={colors.sakit.top} stopOpacity={colors.sakit.topOpacity} />
                  <stop offset="55%" stopColor={colors.sakit.top} stopOpacity={colors.sakit.midOpacity} />
                  <stop offset="100%" stopColor={colors.sakit.top} stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="gradientCuti" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={colors.cuti.top} stopOpacity={colors.cuti.topOpacity} />
                  <stop offset="55%" stopColor={colors.cuti.top} stopOpacity={colors.cuti.midOpacity} />
                  <stop offset="100%" stopColor={colors.cuti.top} stopOpacity={0.0} />
                </linearGradient>
              </defs>

              <CartesianGrid 
                vertical={false} 
                stroke="var(--border)" 
                strokeDasharray="3 3" 
                opacity={isDark ? 0.35 : 0.25} 
              />
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 10.5, fill: 'var(--text-muted)' }} 
                tickMargin={6}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 10.5, fill: 'var(--text-muted)' }} 
                allowDecimals={false} 
              />
              <Tooltip 
                cursor={{
                  strokeDasharray: '4 4',
                  stroke: isDark ? 'rgba(255, 255, 255, 0.25)' : 'rgba(0, 0, 0, 0.25)',
                  strokeWidth: 1.2,
                }}
                content={<CustomTooltip />} 
              />

              {/* Background Pattern Areas (Underlay pattern fill) */}
              {showCuti && (
                <Area 
                  type="monotone" 
                  dataKey="cuti" 
                  fill="url(#modernPattern)" 
                  fillOpacity={1} 
                  stroke="transparent" 
                  dot={false} 
                  activeDot={false} 
                  isAnimationActive={false} 
                />
              )}
              {showAlpha && (
                <Area 
                  type="monotone" 
                  dataKey="alpha" 
                  fill="url(#modernPattern)" 
                  fillOpacity={1} 
                  stroke="transparent" 
                  dot={false} 
                  activeDot={false} 
                  isAnimationActive={false} 
                />
              )}
              {showSakit && (
                <Area 
                  type="monotone" 
                  dataKey="sakit" 
                  fill="url(#modernPattern)" 
                  fillOpacity={1} 
                  stroke="transparent" 
                  dot={false} 
                  activeDot={false} 
                  isAnimationActive={false} 
                />
              )}
              {showIzin && (
                <Area 
                  type="monotone" 
                  dataKey="izin" 
                  fill="url(#modernPattern)" 
                  fillOpacity={1} 
                  stroke="transparent" 
                  dot={false} 
                  activeDot={false} 
                  isAnimationActive={false} 
                />
              )}

              {/* Colored Gradient Areas with Active Glow Dots */}
              {showCuti && (
                <Area 
                  type="monotone" 
                  dataKey="cuti" 
                  stroke={colors.cuti.stroke} 
                  strokeWidth={2}
                  fillOpacity={0.35}
                  fill={colors.cuti.fill} 
                  name="Cuti" 
                  dot={false}
                  activeDot={{
                    r: 4.5,
                    fill: colors.cuti.stroke,
                    stroke: '#fff',
                    strokeWidth: 1.5,
                  }}
                />
              )}
              {showAlpha && (
                <Area 
                  type="monotone" 
                  dataKey="alpha" 
                  stroke={colors.alpha.stroke} 
                  strokeWidth={2}
                  fillOpacity={0.35}
                  fill={colors.alpha.fill} 
                  name="Alpha" 
                  dot={false}
                  activeDot={{
                    r: 4.5,
                    fill: colors.alpha.stroke,
                    stroke: '#fff',
                    strokeWidth: 1.5,
                  }}
                />
              )}
              {showSakit && (
                <Area 
                  type="monotone" 
                  dataKey="sakit" 
                  stroke={colors.sakit.stroke} 
                  strokeWidth={2}
                  fillOpacity={0.35}
                  fill={colors.sakit.fill} 
                  name="Sakit" 
                  dot={false}
                  activeDot={{
                    r: 4.5,
                    fill: colors.sakit.stroke,
                    stroke: '#fff',
                    strokeWidth: 1.5,
                  }}
                />
              )}
              {showIzin && (
                <Area 
                  type="monotone" 
                  dataKey="izin" 
                  stroke={colors.izin.stroke} 
                  strokeWidth={2}
                  fillOpacity={0.35}
                  fill={colors.izin.fill} 
                  name="Izin" 
                  dot={false}
                  activeDot={{
                    r: 4.5,
                    fill: colors.izin.stroke,
                    stroke: '#fff',
                    strokeWidth: 1.5,
                  }}
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
