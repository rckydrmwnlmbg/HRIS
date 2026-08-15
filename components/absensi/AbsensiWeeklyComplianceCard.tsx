'use client';
import React, { useMemo } from 'react';
import type { AbsensiRecord, Language } from '@/types';
import { AlertTriangle, CheckCircle2, Clock, ShieldAlert, Zap } from 'lucide-react';

interface AbsensiWeeklyComplianceCardProps {
  records: AbsensiRecord[];
  lang: Language;
}

interface WeekGroup {
  weekNum: number;
  label: string;
  startDate: string;
  endDate: string;
  regularHours: number;
  otHours: number;
  totalHours: number;
  isOverLimit: boolean;
  excessHours: number;
  daysCount: number;
}

export function AbsensiWeeklyComplianceCard({ records, lang }: AbsensiWeeklyComplianceCardProps) {
  const weeklyData = useMemo(() => {
    if (!records || records.length === 0) return [];

    // Urutkan records berdasarkan tanggal
    const sorted = [...records].sort((a, b) => {
      const tA = new Date(a.DATE_TRANS).getTime();
      const tB = new Date(b.DATE_TRANS).getTime();
      return tA - tB;
    });

    // Temukan tanggal hari Senin pertama di bulan ini
    // Hari sebelum Senin pertama (misal tgl 1-2 Agustus) otomatis masuk ke Minggu 1 bersama Senin pertama (3-9 Agustus)
    let firstMondayDate = 1;
    for (const r of sorted) {
      const d = new Date(r.DATE_TRANS);
      if (d.getDay() === 1) { // Monday
        firstMondayDate = d.getDate();
        break;
      }
    }

    const weekGroups: AbsensiRecord[][] = [];
    let currentWeek: AbsensiRecord[] = [];

    sorted.forEach(r => {
      const d = new Date(r.DATE_TRANS);
      const dayOfWeek = d.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
      const dateNum = d.getDate();

      // Jika hari Senin (dan bukan Senin pertama), buat grup minggu baru
      if (dayOfWeek === 1 && dateNum > firstMondayDate && currentWeek.length > 0) {
        weekGroups.push(currentWeek);
        currentWeek = [];
      }

      currentWeek.push(r);
    });

    if (currentWeek.length > 0) {
      weekGroups.push(currentWeek);
    }

    const result: WeekGroup[] = [];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

    weekGroups.forEach((recordsInWeek, idx) => {
      let regH = 0;
      let otH = 0;

      recordsInWeek.forEach(r => {
        const isHoliday = r.STATUS_HARI === 'LIBUR' || r.STATUS_HARI === 'L';
        const hasReason = Boolean(r.REASON && r.REASON.trim() !== '' && r.REASON.trim() !== '-');
        const isPresent = Boolean(r.WORK_IN || r.WORK_OUT || (typeof r.JAM_KERJA === 'number' && r.JAM_KERJA > 0));
        
        // Hitung jam kerja reguler
        if (typeof r.JAM_KERJA === 'number' && r.JAM_KERJA > 0) {
          regH += r.JAM_KERJA;
        } else if (isPresent && !isHoliday && !hasReason) {
          regH += 8;
        }

        // Hitung total lembur
        const ot1 = Number(r.OT1 || 0);
        const ot2 = Number(r.OT2 || 0);
        const ot3 = Number(r.OT3 || 0);
        const ot4 = Number(r.OT4 || 0);
        otH += (ot1 + ot2 + ot3 + ot4);
      });

      const firstRec = recordsInWeek[0];
      const lastRec = recordsInWeek[recordsInWeek.length - 1];

      const dStart = new Date(firstRec.DATE_TRANS);
      const dEnd = new Date(lastRec.DATE_TRANS);

      const startStr = `${dStart.getDate()} ${monthNames[dStart.getMonth()]}`;
      const endStr = `${dEnd.getDate()} ${monthNames[dEnd.getMonth()]}`;

      const totalH = Math.round((regH + otH) * 10) / 10;
      const isOver = totalH > 50;
      const weekNumber = idx + 1;

      result.push({
        weekNum: weekNumber,
        label: lang === 'id' ? `Minggu ${weekNumber}` : `Week ${weekNumber}`,
        startDate: startStr,
        endDate: endStr,
        regularHours: Math.round(regH * 10) / 10,
        otHours: Math.round(otH * 10) / 10,
        totalHours: totalH,
        isOverLimit: isOver,
        excessHours: isOver ? Math.round((totalH - 50) * 10) / 10 : 0,
        daysCount: recordsInWeek.length
      });
    });

    return result;
  }, [records, lang]);

  if (weeklyData.length === 0) return null;

  const overLimitWeeks = weeklyData.filter(w => w.isOverLimit);
  const maxWeeklyHours = Math.max(...weeklyData.map(w => w.totalHours), 0);

  return (
    <div style={{ marginBottom: '20px' }}>
      {/* ⚠️ Alert Banner jika ada minggu yang melebihi 50 Jam */}
      {overLimitWeeks.length > 0 && (
        <div
          style={{
            padding: '14px 18px',
            borderRadius: '16px',
            marginBottom: '16px',
            background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(220, 38, 38, 0.08) 100%)',
            border: '1px solid rgba(239, 68, 68, 0.45)',
            boxShadow: '0 8px 24px rgba(239, 68, 68, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
          }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              backgroundColor: 'rgba(239, 68, 68, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ef4444',
              flexShrink: 0,
              boxShadow: '0 0 16px rgba(239, 68, 68, 0.35)'
            }}
          >
            <ShieldAlert size={22} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '13.5px', fontWeight: 800, color: '#ef4444', letterSpacing: '-0.01em', marginBottom: '2px' }}>
              {lang === 'id'
                ? `PERHATIAN HR: Karyawan Melebihi Batas 50 Jam Kerja/Minggu (${overLimitWeeks.length} Minggu Melebihi Batas)`
                : `HR COMPLIANCE ALERT: Employee Exceeded 50 Hours/Week Limit (${overLimitWeeks.length} Over-limit Weeks)`}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              {lang === 'id' ? (
                <>
                  Terdeteksi total jam kerja reguler + lembur mencapai{' '}
                  <b style={{ color: '#ef4444' }}>{maxWeeklyHours} Jam/Minggu</b>. Sesuai aturan internal, karyawan ini
                  berada dalam status <b>peringatan / evaluasi skorsing beban kerja lembur berlebih</b>.
                </>
              ) : (
                <>
                  Weekly work + overtime hours reached <b style={{ color: '#ef4444' }}>{maxWeeklyHours} Hours/Week</b>.
                  This employee is eligible for workload warning / overtime suspension review.
                </>
              )}
            </div>
          </div>
          <div
            style={{
              padding: '6px 12px',
              borderRadius: '999px',
              backgroundColor: 'rgba(239, 68, 68, 0.2)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              color: '#ef4444',
              fontSize: '11.5px',
              fontWeight: 700,
              whiteSpace: 'nowrap'
            }}
          >
            Maks. {maxWeeklyHours} Jam / 50 Jam
          </div>
        </div>
      )}

      {/* Grid Kartu Per Minggu */}
      <div className="glass-card" style={{ padding: '18px 20px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '14px',
            flexWrap: 'wrap',
            gap: '8px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clock size={16} color="var(--accent)" />
            <span style={{ fontSize: '13px', fontWeight: 750, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
              {lang === 'id'
                ? 'Monitoring Beban Jam Kerja & Lembur Mingguan (Batas Maks. 50 Jam/Minggu)'
                : 'Weekly Workload & Overtime Compliance Monitor (Max Limit 50 Hours/Week)'}
            </span>
          </div>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 550 }}>
            {lang === 'id' ? 'Standar: 40 Jam Reguler + Maks. 10 Jam OT' : 'Standard: 40h Regular + Max 10h OT'}
          </span>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(auto-fit, minmax(190px, 1fr))`,
            gap: '12px'
          }}
        >
          {weeklyData.map(w => {
            const pct = Math.min(100, Math.round((w.totalHours / 50) * 100));
            const isDanger = w.isOverLimit;
            const isWarning = !isDanger && w.totalHours >= 45;

            const accentColor = isDanger ? '#ef4444' : isWarning ? '#f59e0b' : '#0ea5e9';
            const bgBadge = isDanger
              ? 'rgba(239, 68, 68, 0.12)'
              : isWarning
              ? 'rgba(245, 158, 11, 0.12)'
              : 'rgba(14, 165, 233, 0.1)';
            const borderBadge = isDanger
              ? 'rgba(239, 68, 68, 0.35)'
              : isWarning
              ? 'rgba(245, 158, 11, 0.35)'
              : 'rgba(14, 165, 233, 0.25)';

            return (
              <div
                key={w.weekNum}
                style={{
                  padding: '12px 14px',
                  borderRadius: '14px',
                  background: isDanger
                    ? 'linear-gradient(180deg, rgba(239, 68, 68, 0.08) 0%, rgba(239, 68, 68, 0.02) 100%)'
                    : 'var(--glass-bg)',
                  border: `1px solid ${isDanger ? 'rgba(239, 68, 68, 0.4)' : 'var(--glass-border)'}`,
                  boxShadow: isDanger ? '0 4px 16px rgba(239, 68, 68, 0.12)' : 'var(--glass-shadow)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                {/* Header Minggu */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 750, color: 'var(--text-primary)' }}>
                      {w.label}
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '1px' }}>
                      {w.startDate} - {w.endDate}
                    </div>
                  </div>

                  <span
                    style={{
                      fontSize: '10px',
                      fontWeight: 750,
                      padding: '2px 7px',
                      borderRadius: '999px',
                      backgroundColor: bgBadge,
                      color: accentColor,
                      border: `1px solid ${borderBadge}`
                    }}
                  >
                    {isDanger ? `+${w.excessHours} Jam` : `${w.totalHours}/50 Jam`}
                  </span>
                </div>

                {/* Total Jam Besar */}
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                  <span
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: '1.45rem',
                      fontWeight: 800,
                      color: accentColor,
                      lineHeight: 1
                    }}
                  >
                    {w.totalHours}
                  </span>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)' }}>
                    Jam Total
                  </span>
                </div>

                {/* Visual Progress Bar */}
                <div
                  style={{
                    height: '5px',
                    width: '100%',
                    backgroundColor: 'rgba(0, 0, 0, 0.06)',
                    borderRadius: '999px',
                    overflow: 'hidden'
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${pct}%`,
                      backgroundColor: accentColor,
                      boxShadow: isDanger ? '0 0 10px rgba(239, 68, 68, 0.6)' : undefined,
                      borderRadius: '999px',
                      transition: 'width 0.4s ease'
                    }}
                  />
                </div>

                {/* Breakdown Reguler + Overtime */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '10.5px',
                    color: 'var(--text-secondary)',
                    paddingTop: '2px'
                  }}
                >
                  <span>Kerja: <b>{w.regularHours}h</b></span>
                  <span>Lembur: <b style={{ color: w.otHours > 0 ? 'var(--warning)' : 'inherit' }}>+{w.otHours}h</b></span>
                </div>

                {/* Status Footer */}
                {isDanger ? (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '9.5px',
                      fontWeight: 700,
                      color: '#ef4444',
                      marginTop: '2px'
                    }}
                  >
                    <AlertTriangle size={11} /> Melebihi Batas 50 Jam
                  </div>
                ) : (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '9.5px',
                      fontWeight: 650,
                      color: '#059669',
                      marginTop: '2px'
                    }}
                  >
                    <CheckCircle2 size={11} /> Sesuai Aturan (Aman)
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
