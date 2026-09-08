'use client';
import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useRouter } from 'next/navigation';
import { useApp } from '@/lib/context';
import { useToast } from '@/components/ui/ToastProvider';
import { t } from '@/lib/i18n';
import {
  Users, UserCheck, UserX, Clock, TrendingUp,
  AlertTriangle, ClipboardList, BarChart3, Plus, Settings,
  X, CheckCircle, AlertCircle, Calendar
} from 'lucide-react';
import type { DashboardStats, TrendAbsensi, JamKosongRecord, PerluPerhatianRecord } from '@/types';
import styles from './dashboard.module.css';
import JamKosongModal from '@/components/dashboard/JamKosongModal';
import PerluPerhatianModal from '@/components/dashboard/PerluPerhatianModal';
import { Skeleton, SkeletonDashboard } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import WelcomeBriefing from '@/components/dashboard/WelcomeBriefing';
import DashboardCalendar from '@/components/dashboard/DashboardCalendar';
import AttendanceTrendChart from '@/components/dashboard/AttendanceTrendChart';
import { MarqueeBadge } from '@/components/ui/Badge';

export default function DashboardPage() {
  const { user, settings, setTheme } = useApp();
  const { showToast } = useToast();
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



  const loadDashboard = async () => {
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
    } finally {
      setLoading(false);
    }
  };

  const loadTrend = async () => {
    try {
      const res = await fetch('/api/dashboard/trend');
      if (res.ok) {
        const data = await res.json();
        setTrend(data || []);
      }
    } catch (err) {
      console.error('Failed to load dashboard trend', err);
      setTrend([]);
    } finally {
      setTrendLoading(false);
    }
  };

  useEffect(() => {
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
    return <SkeletonDashboard />;
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
      {/* ========== VIDITII PROACTIVE BRIEFING ========== */}
      <WelcomeBriefing />

      {/* ========== DASHBOARD STATS ========== */}
      <div className={`${styles.statsGrid} stagger-1`}>
        <StatCard
          icon={<Users size={18} />}
          label={t(lang, 'totalKaryawan')}
          value={stats?.karyawanAktif || 0}
          sub={lang === 'id' ? 'Karyawan Aktif' : 'Active Employees'}
          color="blue"
          onClick={() => router.push('/karyawan')}
          lang={lang}
        />
        <StatCard
          icon={<UserCheck size={18} />}
          label={t(lang, 'hadirHariIni')}
          value={stats?.hadirHariIni || 0}
          sub={`${stats?.karyawanAktif ? Math.round(((stats?.hadirHariIni || 0) / stats.karyawanAktif) * 100) : 0}% ${lang === 'id' ? 'kehadiran' : 'rate'}`}
          color="green"
          onClick={() => router.push('/absensi')}
          integrated={stats?.isFingerprintIntegrated ?? false}
          lang={lang}
        />
        <StatCard
          icon={<UserX size={18} />}
          label={lang === 'id' ? 'Ketidakhadiran' : 'Absences'}
          value={stats?.alphaHariIni || 0}
          sub={`${stats?.izinHariIni || 0} ${lang === 'id' ? 'izin & sakit' : 'leave & sick'}`}
          color="red"
          onClick={() => router.push('/absensi')}
          integrated={stats?.isFingerprintIntegrated ?? false}
          lang={lang}
        />
        <StatCard
          icon={<Clock size={18} />}
          label={t(lang, 'jamKosong')}
          value={stats?.jamKosongHariIni || 0}
          sub={lang === 'id' ? 'Perlu konfirmasi' : 'Needs review'}
          color="orange"
          onClick={() => setShowJamKosongModal(true)}
          highlight={(stats?.isFingerprintIntegrated ?? false) && (stats?.jamKosongHariIni || 0) > 0}
          integrated={stats?.isFingerprintIntegrated ?? false}
          lang={lang}
        />
      </div>

      {/* ========== ROW 2: Chart + Status ========== */}
      <div className={styles.chartCalendarGrid}>
        {/* Trend Chart (Smooth Area Spline + Clickable Series + Export Excel) */}
        <AttendanceTrendChart />

        {/* Kalender Operasional HR */}
        <DashboardCalendar />
      </div>

      {/* ========== ROW 3: Alerts + Quick Access ========== */}
      <div className={styles.bottomGrid}>
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
                  <MarqueeBadge
                    variant={
                      k.jenis_anomali === 'PULANG_CEPAT'
                        ? 'warning'
                        : k.jenis_anomali === 'TERLAMBAT'
                          ? 'danger'
                          : 'info'
                    }
                    width={140}
                    height={22}
                    size="sm"
                  >
                    {k.keterangan || (k.jenis_anomali === 'PULANG_CEPAT' ? 'Pulang Lebih Awal' : k.jenis_anomali === 'TERLAMBAT' ? 'Terlambat Hadir' : 'Durasi Singkat')}
                  </MarqueeBadge>
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
          <div className={styles.quickGrid}>
            {[
              { icon: Users, label: lang === 'id' ? 'Data Karyawan' : 'Employees', href: '/karyawan', color: '#3b82f6' },
              { icon: ClipboardList, label: lang === 'id' ? 'Absensi' : 'Attendance', href: '/absensi', color: '#10b981' },
              { icon: Calendar, label: lang === 'id' ? 'Form Cuti' : 'Leave Form', href: '/cuti', color: '#f59e0b' },
              { icon: BarChart3, label: lang === 'id' ? 'Laporan Excel' : 'Excel Reports', href: '/laporan', color: '#8b5cf6' },
              { icon: TrendingUp, label: lang === 'id' ? 'Analisis Lembur' : 'OT Analysis', href: '/laporan?tab=ot', color: '#f97316' },
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
  icon, label, value, sub, color, onClick, highlight, integrated = true, lang = 'id'
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  sub: string;
  color: 'blue' | 'green' | 'red' | 'yellow' | 'orange' | 'purple';
  onClick?: () => void;
  highlight?: boolean;
  integrated?: boolean;
  lang?: string;
}) {
  const colors = {
    blue: { accent: '#2563eb', bg: 'rgba(37, 99, 235, 0.1)', border: 'rgba(37, 99, 235, 0.22)' },
    green: { accent: '#059669', bg: 'rgba(5, 150, 105, 0.1)', border: 'rgba(5, 150, 105, 0.22)' },
    red: { accent: '#dc2626', bg: 'rgba(220, 38, 38, 0.1)', border: 'rgba(220, 38, 38, 0.22)' },
    yellow: { accent: '#d97706', bg: 'rgba(217, 119, 6, 0.1)', border: 'rgba(217, 119, 6, 0.22)' },
    orange: { accent: '#ea580c', bg: 'rgba(234, 88, 12, 0.1)', border: 'rgba(234, 88, 12, 0.22)' },
    purple: { accent: '#7c3aed', bg: 'rgba(124, 58, 237, 0.1)', border: 'rgba(124, 58, 237, 0.22)' },
  };
  const c = colors[color];

  return (
    <div
      className={`glass-card ${styles.statCardModern} ${highlight ? styles.highlighted : ''}`}
      style={{
        cursor: onClick ? 'pointer' : 'default',
        borderColor: highlight ? `${c.accent}66` : undefined,
      }}
      onClick={onClick}
    >
      <div className={styles.statTopRow}>
        <span className={styles.statLabelModern}>{label}</span>
        <div
          className={styles.statIconBox}
          style={{
            background: c.bg,
            color: c.accent,
            border: `1px solid ${c.border}`
          }}
        >
          {icon}
        </div>
      </div>

      {integrated ? (
        <>
          <div className={styles.statValueModern} style={{ color: c.accent }}>
            {value.toLocaleString()}
          </div>
          <div className={styles.statSubModern}>
            {sub}
          </div>
        </>
      ) : (
        <>
          <div className={styles.statValueModern} style={{ color: 'var(--text-muted)' }}>–</div>
          <div className={styles.statSubModern} style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>
            {lang === 'id' ? 'Data belum tersinkron' : 'Data not synchronized'}
          </div>
        </>
      )}
    </div>
  );
}
