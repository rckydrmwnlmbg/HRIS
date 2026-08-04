'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useRouter } from 'next/navigation';
import { useApp } from '@/lib/context';
import { t } from '@/lib/i18n';
import {
  Users, UserCheck, UserX, Clock, TrendingUp,
  AlertTriangle, ClipboardList, BarChart3, Plus, FileText, Settings, Sun, Moon, Zap
} from 'lucide-react';
import type { DashboardStats, TrendAbsensi, Karyawan, JamKosongRecord, PerluPerhatianRecord } from '@/types';
import styles from './dashboard.module.css';
import JamKosongModal from '@/components/dashboard/JamKosongModal';
import PerluPerhatianModal from '@/components/dashboard/PerluPerhatianModal';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';

export default function DashboardPage() {
  const { user, settings, setTheme } = useApp();
  const lang = settings.language;

  const router = useRouter();

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [trend, setTrend] = useState<TrendAbsensi[]>([]);
  const [jamKosong, setJamKosong] = useState<JamKosongRecord[]>([]);
  const [perluPerhatian, setPerluPerhatian] = useState<PerluPerhatianRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showJamKosongModal, setShowJamKosongModal] = useState(false);
  const [showPerluPerhatianModal, setShowPerluPerhatianModal] = useState(false);

  const [trendLoading, setTrendLoading] = useState(true);

  const [currentHeroIndex, setCurrentHeroIndex] = useState(0);
  const heroImages = ['/hero-hr.png', '/hero-hr1.png', '/hero-hr2.png', '/hero-hr3.png'];

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentHeroIndex((prev) => (prev + 1) % heroImages.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [heroImages.length]);

  useEffect(() => {
    async function loadDashboard() {
      try {
        const res = await fetch('/api/dashboard');
        if (res.ok) {
          const data = await res.json();
          if (data.error) throw new Error(data.error);
          setStats(data);
          setJamKosong(data.jamKosongList || []);
          setPerluPerhatian(data.perluPerhatianList || []);
        } else {
          throw new Error('Response not ok');
        }
      } catch (err) {
        console.error('Failed to load dashboard stats', err);
        setStats({ 
          totalKaryawan: 0, 
          karyawanAktif: 0, 
          hadirHariIni: 0, 
          alphaHariIni: 0, 
          izinHariIni: 0, 
          cutiHariIni: 0, 
          sakitHariIni: 0, 
          jamKosongHariIni: 0, 
          perluPerhatianHariIni: 0,
          lemburBulanIni: 0, 
          jamKosongList: [],
          perluPerhatianList: []
        });
        setJamKosong([]);
        setPerluPerhatian([]);
      }
      setLoading(false);
    }

    async function loadTrend() {
      try {
        const res = await fetch('/api/dashboard/trend');
        if (res.ok) {
          const data = await res.json();
          setTrend(data || []);
        }
      } catch (err) {
        console.error('Failed to load dashboard trend', err);
        setTrend([]);
      }
      setTrendLoading(false);
    }

    loadDashboard();
    loadTrend();
  }, []);

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12
    ? (lang === 'id' ? 'Selamat Pagi' : 'Good Morning')
    : hour < 17
      ? (lang === 'id' ? 'Selamat Siang' : 'Good Afternoon')
      : (lang === 'id' ? 'Selamat Sore' : 'Good Evening');

  const dateStr = now.toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-US', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });

  const userName = user?.nama?.split(' ')[0] || 'Administrator';

  if (loading) {
    return (
      <div className="animate-fadeIn" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Skeleton width={200} height={32} style={{ marginBottom: 8 }} />
            <Skeleton width={150} height={16} />
          </div>
          <Skeleton width={120} height={40} />
        </div>
        
        <Skeleton width="100%" height={240} style={{ borderRadius: 'var(--radius-xl)' }} />

        <div className={styles.statsGrid}>
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} width="100%" height={120} style={{ borderRadius: 'var(--radius-lg)' }} />
          ))}
        </div>

        <div className="glass-card" style={{ padding: '24px' }}>
          <Skeleton width={150} height={24} style={{ marginBottom: 24 }} />
          <Skeleton width="100%" height={300} />
        </div>
      </div>
    );
  }

  if (stats?.totalKaryawan === 0) {
    return (
      <EmptyState 
        icon="user"
        title={lang === 'id' ? 'Belum Ada Data Karyawan' : 'No Employee Data Yet'}
        description={lang === 'id' ? 'Data karyawan belum tersedia. Mulai tambahkan karyawan baru untuk menampilkan ringkasan dasbor.' : 'No employee data available. Add a new employee to see dashboard statistics.'}
        action={
          <button className="btn btn-primary" onClick={() => router.push('/karyawan/baru')}>
            <Plus size={16} /> {lang === 'id' ? 'Tambah Karyawan Pertama' : 'Add First Employee'}
          </button>
        }
      />
    );
  }

  return (
    <div className="animate-fadeIn">
      {/* ========== TOP BAR ========== */}
      <div className={styles.pageHeader}>
        <div>
          <h1 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, lineHeight: 1.2 }}>
            {dateStr}
          </h1>

        </div>


      </div>

      {/* ========== HERO BANNER (Staffora-style) ========== */}
      <div className={styles.heroBanner}>
        <div className={styles.heroBannerBg} />
        <div className={styles.heroContent}>
          <div className={styles.greeting}>
            {greeting}, <strong>{userName}</strong>! 👋
          </div>
          <div className={styles.greetingDesc}>
            {lang === 'id'
              ? (stats?.isFingerprintIntegrated 
                  ? `Terdapat ${stats?.jamKosongHariIni || 0} catatan presensi yang memerlukan peninjauan hari ini. Semoga aktivitas kerja Anda berjalan lancar dan produktif.`
                  : `Data kehadiran hari ini belum diperbarui. Silakan klik tombol 'Sinkronisasi Kehadiran' untuk memuat data terkini.`)
              : (stats?.isFingerprintIntegrated
                  ? `You have ${stats?.jamKosongHariIni || 0} attendance records requiring review today. Wishing you a productive and smooth workday.`
                  : `Today's attendance records have not been synchronized. Please click 'Sync Attendance' to load the latest data.`)}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className={`${styles.heroCta} ${styles.heroCtaPrimary}`} onClick={() => router.push('/absensi?sync=true')}>
              {lang === 'id' ? 'Sinkronisasi Kehadiran' : 'Sync Attendance'}
            </button>
            <button className={`${styles.heroCta} ${styles.heroCtaSecondary}`} onClick={() => router.push('/karyawan/baru')}>
              <Plus size={15} /> {lang === 'id' ? 'Tambah Karyawan' : 'Add Employee'}
            </button>
          </div>
        </div>
        <div className={styles.heroImageContainer}>
          {heroImages.map((src, idx) => (
            <img
              key={src}
              src={src}
              alt={`HR ${idx}`}
              className={`${styles.heroImage} ${idx === currentHeroIndex ? styles.heroImageActive : ''}`}
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          ))}
        </div>
      </div>

      {/* ========== STAT CARDS (4 KPI CARDS) ========== */}
      <div className={`${styles.statsGrid} stagger-1`}>
        <StatCard
          icon={<Users size={28} />}
          label={t(lang, 'totalKaryawan')}
          value={stats?.karyawanAktif || 0}
          sub={lang === 'id' ? 'Karyawan Aktif' : 'Active Employees'}
          color="blue"
          onClick={() => router.push('/karyawan')}
        />
        <StatCard
          icon={<UserCheck size={28} />}
          label={t(lang, 'hadirHariIni')}
          value={stats?.hadirHariIni || 0}
          sub={`${stats?.karyawanAktif ? Math.round(((stats?.hadirHariIni || 0) / stats.karyawanAktif) * 100) : 0}% ${lang === 'id' ? 'tingkat kehadiran' : 'attendance rate'}`}
          color="green"
          onClick={() => router.push('/absensi')}
          integrated={stats?.isFingerprintIntegrated ?? false}
        />
        <StatCard
          icon={<UserX size={28} />}
          label={lang === 'id' ? 'Ketidakhadiran (Alpha)' : 'Absences (Alpha)'}
          value={stats?.alphaHariIni || 0}
          sub={`${stats?.izinHariIni || 0} ${lang === 'id' ? 'izin, cuti & sakit' : 'excused leave'}`}
          color="red"
          onClick={() => router.push('/absensi')}
          integrated={stats?.isFingerprintIntegrated ?? false}
        />
        <StatCard
          icon={<Clock size={28} />}
          label={t(lang, 'jamKosong')}
          value={stats?.jamKosongHariIni || 0}
          sub={lang === 'id' ? 'Presensi belum lengkap' : 'Incomplete clock in/out'}
          color="orange"
          onClick={() => setShowJamKosongModal(true)}
          highlight={(stats?.isFingerprintIntegrated ?? false) && (stats?.jamKosongHariIni || 0) > 0}
          integrated={stats?.isFingerprintIntegrated ?? false}
        />
      </div>

      {/* ========== ROW 2: Chart + Status ========== */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, marginBottom: 24 }}>
        {/* Trend Chart */}
        <div className="glass-card stagger-2" style={{ padding: 24, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <h3>{lang === 'id' ? 'Tren Ketidakhadiran' : 'Absence Trend'}</h3>
            <div style={{ display: 'flex', gap: 12, fontSize: 11 }}>
              {[
                { label: lang === 'id' ? 'Alpha' : 'Absent', color: 'var(--status-alpha)' },
                { label: lang === 'id' ? 'Izin' : 'Permit', color: 'var(--status-izin)' },
                { label: lang === 'id' ? 'Sakit' : 'Sick', color: 'var(--status-sakit)' },
                { label: lang === 'id' ? 'Cuti' : 'Leave', color: 'var(--status-cuti)' },
              ].map(l => (
                <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div className="dot" style={{ background: l.color }} />
                  <span style={{ color: 'var(--text-secondary)' }}>{l.label}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ flex: 1, minHeight: 200, marginTop: 10 }}>
            {trendLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', width: '100%' }}>
                <div className="spinner" style={{ width: 30, height: 30, borderWidth: 3 }} />
              </div>
            ) : trend.length === 0 ? (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', width: '100%', color: 'var(--text-secondary)' }}>
                Belum ada data trend
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={trend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradAlpha" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="var(--status-alpha)" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="var(--status-alpha)" stopOpacity={1} />
                    </linearGradient>
                    <linearGradient id="gradSakit" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="var(--status-sakit)" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="var(--status-sakit)" stopOpacity={1} />
                    </linearGradient>
                    <linearGradient id="gradIzin" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="var(--status-izin)" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="var(--status-izin)" stopOpacity={1} />
                    </linearGradient>
                    <linearGradient id="gradCuti" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="var(--status-cuti)" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="var(--status-cuti)" stopOpacity={1} />
                    </linearGradient>

                    <linearGradient id="fillAlpha" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--status-alpha)" stopOpacity={0.15} />
                      <stop offset="100%" stopColor="var(--status-alpha)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="fillSakit" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--status-sakit)" stopOpacity={0.15} />
                      <stop offset="100%" stopColor="var(--status-sakit)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="fillIzin" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--status-izin)" stopOpacity={0.15} />
                      <stop offset="100%" stopColor="var(--status-izin)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="fillCuti" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--status-cuti)" stopOpacity={0.15} />
                      <stop offset="100%" stopColor="var(--status-cuti)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                  <CartesianGrid vertical={false} stroke="var(--border-color)" strokeDasharray="3 3" opacity={0.15} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)', borderRadius: 8, fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    itemStyle={{ fontSize: 13, fontWeight: 600 }}
                  />
                  
                  <Area type="monotone" dataKey="alpha" stroke="url(#gradAlpha)" strokeWidth={2} fill="url(#fillAlpha)" dot={false} activeDot={{ r: 6, strokeWidth: 2, fill: 'var(--bg-card)', stroke: 'var(--status-alpha)' }} name={lang === 'id' ? 'Alpha' : 'Absent'} />
                  <Area type="monotone" dataKey="sakit" stroke="url(#gradSakit)" strokeWidth={2} fill="url(#fillSakit)" dot={false} activeDot={{ r: 6, strokeWidth: 2, fill: 'var(--bg-card)', stroke: 'var(--status-sakit)' }} name={lang === 'id' ? 'Sakit' : 'Sick'} />
                  <Area type="monotone" dataKey="izin" stroke="url(#gradIzin)" strokeWidth={2} fill="url(#fillIzin)" dot={false} activeDot={{ r: 6, strokeWidth: 2, fill: 'var(--bg-card)', stroke: 'var(--status-izin)' }} name={lang === 'id' ? 'Izin' : 'Permit'} />
                  <Area type="monotone" dataKey="cuti" stroke="url(#gradCuti)" strokeWidth={2} fill="url(#fillCuti)" dot={false} activeDot={{ r: 6, strokeWidth: 2, fill: 'var(--bg-card)', stroke: 'var(--status-cuti)' }} name={lang === 'id' ? 'Cuti' : 'Leave'} />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Sorotan Karyawan */}
        <div className="glass-card stagger-3" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Demografi */}
          <div>
            <h3 style={{ marginBottom: 16 }}>{lang === 'id' ? 'Komposisi Karyawan' : "Employee Demographics"}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                { label: 'ALL IN vs HARIAN', v1: stats?.demografi?.allIn || 0, v2: stats?.demografi?.harian || 0, c1: '#3B82F6', c2: '#8B5CF6', l1: 'ALL IN', l2: 'HARIAN' }
              ].map(item => {
                const total = item.v1 + item.v2;
                const p1 = total > 0 ? (item.v1 / total) * 100 : 0;
                const p2 = total > 0 ? (item.v2 / total) * 100 : 0;
                return (
                  <div key={item.label}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{item.label}</span>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{total}</span>
                    </div>
                    <div style={{ display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden', marginBottom: 6 }}>
                      <div style={{ width: `${p1}%`, background: item.c1 }} title={`${item.l1}: ${item.v1}`} />
                      <div style={{ width: `${p2}%`, background: item.c2 }} title={`${item.l2}: ${item.v2}`} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)' }}>
                      <span style={{ color: item.c1, fontWeight: 500 }}>{item.l1}: {item.v1} ({p1.toFixed(0)}%)</span>
                      <span style={{ color: item.c2, fontWeight: 500 }}>{item.l2}: {item.v2} ({p2.toFixed(0)}%)</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '4px 0' }} />

          {/* Top Lembur */}
          <div>
            <h3 style={{ marginBottom: 16 }}>{lang === 'id' ? 'Sorotan Lembur (Top 5)' : "Overtime Highlights"}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {stats?.topLembur && stats.topLembur.length > 0 ? stats.topLembur.map((item, idx) => (
                <div key={item.bagian} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--bg-secondary)', borderRadius: 8, border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 15, fontWeight: 'bold', color: idx === 0 ? '#F59E0B' : idx === 1 ? '#9CA3AF' : idx === 2 ? '#D97706' : 'var(--text-muted)' }}>#{idx + 1}</span>
                    <span style={{ fontSize: 14, fontWeight: 500 }}>{item.bagian}</span>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
                    {item.total} {lang === 'id' ? 'kali' : 'times'}
                  </div>
                </div>
              )) : (
                <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0' }}>
                  {lang === 'id' ? 'Belum ada data lembur bulan ini' : 'No overtime data this month'}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ========== ROW 3: Alerts + Quick Access ========== */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Perlu Perhatian */}
        <div className="glass-card stagger-4" style={{ padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <AlertTriangle size={18} color="var(--warning)" />
            <h3>{t(lang, 'perhatian')}</h3>
            <span 
              className="badge badge-warning" 
              style={{ marginLeft: 'auto', cursor: perluPerhatian.length > 0 ? 'pointer' : 'default' }}
              onClick={() => perluPerhatian.length > 0 && setShowPerluPerhatianModal(true)}
            >
              {perluPerhatian.length}
            </span>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 14 }}>
            {lang === 'id' 
              ? 'Daftar karyawan dengan penyesuaian jam kerja (pulang lebih awal, keterlambatan, atau durasi singkat).' 
              : 'Employees with attendance anomalies (early departure, late arrival, or short duration).'}
          </p>
          {!(stats?.isFingerprintIntegrated ?? false) ? (
            <div className="empty-state" style={{ padding: '24px 16px', textAlign: 'center' }}>
              <Clock size={30} color="var(--text-muted)" style={{ opacity: 0.6, marginBottom: 8 }} />
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
                {lang === 'id' ? 'Data kehadiran hari ini belum disinkronkan' : "Today's attendance not synchronized"}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 14, maxWidth: 300, margin: '0 auto 14px' }}>
                {lang === 'id' ? 'Silakan lakukan sinkronisasi kehadiran terlebih dahulu untuk meninjau data kehadiran.' : 'Please synchronize attendance first to review attendance records.'}
              </div>
              <button 
                className="btn btn-primary btn-sm" 
                style={{ fontSize: 12, padding: '6px 16px', borderRadius: 'var(--radius-md)', cursor: 'pointer' }}
                onClick={() => router.push('/absensi?sync=true')}
              >
                {lang === 'id' ? 'Sinkronisasi Kehadiran Sekarang' : 'Sync Attendance Now'}
              </button>
            </div>
          ) : perluPerhatian.length === 0 ? (
            <div className="empty-state" style={{ padding: 30 }}>
              <UserCheck size={32} color="var(--success)" style={{ opacity: 0.6 }} />
              <span style={{ fontSize: 13 }}>{lang === 'id' ? 'Seluruh presensi kerja tercatat tertib & sesuai jadwal ✓' : 'All attendance records are complete and on schedule ✓'}</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {perluPerhatian.slice(0, 5).map((k, idx) => (
                <div
                  key={`${k.EMP_CD}-${idx}`}
                  className={styles.alertRow}
                  onClick={() => setShowPerluPerhatianModal(true)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className={styles.alertAvatar}>{k.EMP_NM.charAt(0)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{k.EMP_NM}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{k.EMP_CD} · {k.SEC_DESC || k.SEC_CD}</div>
                  </div>
                  <span 
                    className={
                      k.jenis_anomali === 'PULANG_CEPAT' 
                        ? 'badge badge-warning' 
                        : k.jenis_anomali === 'TERLAMBAT' 
                          ? 'badge badge-danger' 
                          : 'badge badge-info'
                    } 
                    style={{ fontSize: 10, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  >
                    {k.keterangan || (k.jenis_anomali === 'PULANG_CEPAT' ? 'Pulang Lebih Awal' : k.jenis_anomali === 'TERLAMBAT' ? 'Terlambat Hadir' : 'Durasi Singkat')}
                  </span>
                </div>
              ))}
              {perluPerhatian.length > 5 && (
                <button 
                  className="btn btn-secondary btn-sm" 
                  style={{ width: '100%', marginTop: 6, fontSize: 12, padding: '6px 12px', borderRadius: 'var(--radius-md)', cursor: 'pointer' }}
                  onClick={() => setShowPerluPerhatianModal(true)}
                >
                  {lang === 'id' ? `Lihat Semua (${perluPerhatian.length} Karyawan) →` : `View All (${perluPerhatian.length} Employees) →`}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Quick Access */}
        <div className="glass-card stagger-5" style={{ padding: 24 }}>
          <h3 style={{ marginBottom: 16 }}>{t(lang, 'aksesLanjut')}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              { icon: Users, label: lang === 'id' ? 'Data Karyawan' : 'Employees', href: '/karyawan', color: '#3b82f6' },
              { icon: ClipboardList, label: lang === 'id' ? 'Absensi' : 'Attendance', href: '/absensi', color: '#10b981' },
              { icon: Clock, label: lang === 'id' ? 'Input Lembur' : 'Overtime', href: '/lembur', color: '#f59e0b' },
              { icon: BarChart3, label: lang === 'id' ? 'Laporan Excel' : 'Excel Reports', href: '/laporan', color: '#8b5cf6' },
              { icon: TrendingUp, label: lang === 'id' ? 'OT Analysis' : 'OT Analysis', href: '/laporan?tab=ot', color: '#f97316' },
              { icon: Settings, label: lang === 'id' ? 'Pengaturan' : 'Settings', href: '/pengaturan', color: '#6b7280' },
            ].map(item => (
              <button
                key={item.href}
                className={styles.quickBtn}
                onClick={() => router.push(item.href)}
              >
                <item.icon size={20} color={item.color} />
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <JamKosongModal
        isOpen={showJamKosongModal}
        onClose={() => setShowJamKosongModal(false)}
        data={jamKosong}
        lang={lang}
      />

      <PerluPerhatianModal
        isOpen={showPerluPerhatianModal}
        onClose={() => setShowPerluPerhatianModal(false)}
        initialData={perluPerhatian}
        lang={lang}
      />
    </div>
  );
}

// ========== Stat Card Component ==========
function StatCard({
  icon, label, value, sub, color, onClick, highlight, integrated = true
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  sub: string;
  color: 'blue' | 'green' | 'red' | 'yellow' | 'orange' | 'purple';
  onClick?: () => void;
  highlight?: boolean;
  integrated?: boolean;
}) {
  const colors = {
    blue: { accent: '#3b82f6', glow: 'rgba(59,130,246,0.12)' },
    green: { accent: '#10b981', glow: 'rgba(16,185,129,0.12)' },
    red: { accent: '#ef4444', glow: 'rgba(239,68,68,0.12)' },
    yellow: { accent: '#ca8a04', glow: 'rgba(202,138,4,0.12)' },
    orange: { accent: '#f59e0b', glow: 'rgba(245,158,11,0.12)' },
    purple: { accent: '#8b5cf6', glow: 'rgba(139,92,246,0.12)' },
  };
  const c = colors[color];

  return (
    <div
      className={`glass-card stat-card ${highlight ? styles.highlighted : ''}`}
      style={{
        cursor: onClick ? 'pointer' : 'default',
        borderColor: highlight ? `${c.accent}4d` : undefined,
      }}
      onClick={onClick}
    >
      <div className="stat-label">{label}</div>
      {integrated ? (
        <>
          <div className="stat-value" style={{ color: c.accent }}>{value}</div>
          <div className="stat-sub">{sub}</div>
        </>
      ) : (
        <>
          <div className="stat-value" style={{ color: 'var(--text-muted)' }}>–</div>
          <div className="stat-sub" style={{ fontStyle: 'italic', color: 'var(--text-muted)', fontSize: 10 }}>Data belum tersinkron</div>
        </>
      )}
      <div className="stat-icon" style={{ color: c.accent }}>
        {icon}
      </div>
    </div>
  );
}
