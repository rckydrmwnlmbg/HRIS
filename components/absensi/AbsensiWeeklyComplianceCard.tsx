'use client';
import React, { useMemo } from 'react';
import type { AbsensiRecord, Language } from '@/types';
import { AlertTriangle, CheckCircle2, Clock, ShieldAlert, Zap } from 'lucide-react';

interface AbsensiWeeklyComplianceCardProps {
  records: AbsensiRecord[];
  corrections?: Map<string, AbsensiRecord>;
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
  maxRegularLimit: number;
  maxOtLimit: number;
  maxTotalLimit: number;
  isOverLimit: boolean;
  isWarning: boolean;
  excessHours: number;
  daysCount: number;
}

export function AbsensiWeeklyComplianceCard({ records, corrections, lang }: AbsensiWeeklyComplianceCardProps) {
  const weeklyData = useMemo(() => {
    if (!records || records.length === 0) return [];

    // Helper aman untuk parse YYYY-MM-DD tanpa terkena timezone shift
    const parseDateOnly = (dStr: string) => {
      const parts = dStr.split('-');
      if (parts.length === 3) {
        return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      }
      return new Date(dStr);
    };

    // Urutkan records secara kronologis
    const sorted = [...records].sort((a, b) => {
      return parseDateOnly(a.DATE_TRANS).getTime() - parseDateOnly(b.DATE_TRANS).getTime();
    });

    // ── PENGELOMPOKAN MINGGU DINAMIS (SENIN s/d MINGGU, MAKSIMAL 7 HARI) ──
    const weekGroups: AbsensiRecord[][] = [];
    let currentWeek: AbsensiRecord[] = [];

    sorted.forEach(r => {
      const d = parseDateOnly(r.DATE_TRANS);
      const dayOfWeek = d.getDay(); // 0 = Minggu, 1 = Senin, ..., 6 = Sabtu

      // Setiap kali bertemu hari Senin dan minggu sebelumnya sudah berisi hari,
      // tutup minggu sebelumnya dan buat kelompok minggu baru!
      if (dayOfWeek === 1 && currentWeek.length > 0) {
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
        // Ambil data draft koreksi real-time jika sedang diedit oleh HR
        const eff = corrections?.get(r.DATE_TRANS) || r;

        const isHoliday = eff.STATUS_HARI === 'LIBUR' || eff.STATUS_HARI === 'L';
        const hasReason = Boolean(eff.REASON && eff.REASON.trim() !== '' && eff.REASON.trim() !== '-');
        const isPresent = Boolean(eff.WORK_IN || eff.WORK_OUT || (typeof eff.JAM_KERJA === 'number' && eff.JAM_KERJA > 0));

        // Jam kerja reguler
        if (typeof eff.JAM_KERJA === 'number' && eff.JAM_KERJA > 0) {
          regH += eff.JAM_KERJA;
        } else if (isPresent && !isHoliday && !hasReason) {
          regH += 8;
        }

        // Jam lembur (OT)
        const ot1 = Number(eff.OT1 ?? (eff as any).OT_1 ?? 0);
        const ot2 = Number(eff.OT2 ?? (eff as any).OT_2 ?? 0);
        const ot3 = Number(eff.OT3 ?? (eff as any).OT_3 ?? 0);
        const ot4 = Number(eff.OT4 ?? (eff as any).OT_4 ?? 0);
        const dailyOt = (eff as any).T_OT !== undefined && (eff as any).T_OT !== null
          ? Number((eff as any).T_OT)
          : (ot1 + ot2 + ot3 + ot4);

        otH += dailyOt;
      });

      const firstRec = recordsInWeek[0];
      const lastRec = recordsInWeek[recordsInWeek.length - 1];

      const dStart = parseDateOnly(firstRec.DATE_TRANS);
      const dEnd = parseDateOnly(lastRec.DATE_TRANS);

      const startStr = `${dStart.getDate()} ${monthNames[dStart.getMonth()]}`;
      const endStr = `${dEnd.getDate()} ${monthNames[dEnd.getMonth()]}`;

      const totalH = Math.round((regH + otH) * 10) / 10;
      const daysCount = recordsInWeek.length;

      // ── BATAS REGULASI RESMI (PP No. 35 Tahun 2021) ──
      // Standar 1 minggu penuh: Reguler 40 Jam, Lembur Maks. 18 Jam, Total Maks. 58 Jam.
      // Untuk minggu parsial (< 6 hari kerja): dihitung proporsional agar adil.
      let maxReg = 40;
      let maxOt = 18;
      if (daysCount < 6) {
        maxReg = Math.min(40, daysCount * 8);
        maxOt = Math.min(18, daysCount * 4); // Maksimal lembur 4 jam/hari (Pasal 26 PP 35/2021)
      }
      const maxTotal = maxReg + maxOt;

      const isOver = totalH > maxTotal || otH > maxOt;
      const isWarn = !isOver && (totalH >= maxTotal * 0.85 || otH >= maxOt * 0.8);
      const excess = isOver ? Math.max(Math.round((totalH - maxTotal) * 10) / 10, Math.round((otH - maxOt) * 10) / 10) : 0;
      const weekNumber = idx + 1;

      result.push({
        weekNum: weekNumber,
        label: lang === 'id' ? `Minggu ${weekNumber}` : `Week ${weekNumber}`,
        startDate: startStr,
        endDate: endStr,
        regularHours: Math.round(regH * 10) / 10,
        otHours: Math.round(otH * 10) / 10,
        totalHours: totalH,
        maxRegularLimit: maxReg,
        maxOtLimit: maxOt,
        maxTotalLimit: maxTotal,
        isOverLimit: isOver,
        isWarning: isWarn,
        excessHours: excess,
        daysCount
      });
    });

    return result;
  }, [records, corrections, lang]);

  if (weeklyData.length === 0) return null;

  const overLimitWeeks = weeklyData.filter(w => w.isOverLimit);
  const maxWeeklyHours = Math.max(...weeklyData.map(w => w.totalHours), 0);

  return (
    <div style={{ marginBottom: '20px' }}>
      {/* ⚠️ Alert Banner jika ada minggu yang melebihi batas regulasi */}
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
                ? `PERINGATAN HR: Karyawan Melebihi Batas Regulasi PP 35/2021 (${overLimitWeeks.length} Minggu Melebihi Batas)`
                : `HR COMPLIANCE ALERT: Employee Exceeded PP 35/2021 Legal Limit (${overLimitWeeks.length} Over-limit Weeks)`}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              {lang === 'id' ? (
                <>
                  Terdeteksi beban kerja/lembur melebihi ambang batas hukum (Maks. <b>18 Jam Lembur</b> atau <b>58 Jam Beban Total/Minggu</b>).
                  Karyawan ini berisiko mengalami kelelahan ekstrem dan <b>wajib dievaluasi beban kerjanya / memenuhi kriteria skorsing lembur</b>.
                </>
              ) : (
                <>
                  Weekly work/overtime hours exceeded legal limits (Max <b>18h Overtime</b> or <b>58h Total Workload/Week</b>).
                  This employee is subject to workload review and overtime suspension criteria.
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
            Maks. {maxWeeklyHours} Jam / Minggu
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
                ? 'Monitoring Beban Jam Kerja & Lembur Mingguan (Regulasi PP No. 35/2021)'
                : 'Weekly Workload & Overtime Compliance Monitor (PP No. 35/2021)'}
            </span>
          </div>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 550 }}>
            {lang === 'id' ? 'Standar Resmi: Maks. 40h Reguler + Maks. 18h Lembur (Batas 58h/Minggu)' : 'Official: Max 40h Regular + Max 18h OT (Limit 58h/Week)'}
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
            const pct = Math.min(100, Math.round((w.totalHours / w.maxTotalLimit) * 100));
            const isDanger = w.isOverLimit;
            const isWarning = w.isWarning;

            const accentColor = isDanger ? '#ef4444' : isWarning ? '#f59e0b' : '#059669';
            const bgBadge = isDanger
              ? 'rgba(239, 68, 68, 0.12)'
              : isWarning
              ? 'rgba(245, 158, 11, 0.12)'
              : 'rgba(16, 185, 129, 0.1)';
            const borderBadge = isDanger
              ? 'rgba(239, 68, 68, 0.35)'
              : isWarning
              ? 'rgba(245, 158, 11, 0.35)'
              : 'rgba(16, 185, 129, 0.25)';

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
                      {w.startDate} - {w.endDate} <span style={{ opacity: 0.7 }}>({w.daysCount}h)</span>
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
                    {isDanger ? `+${w.excessHours} Jam` : `${w.totalHours}/${w.maxTotalLimit} Jam`}
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
                  <span>Kerja: <b>{w.regularHours}h</b> / {w.maxRegularLimit}h</span>
                  <span>
                    Lembur:{' '}
                    <b style={{ color: w.otHours > w.maxOtLimit ? '#ef4444' : w.otHours > 0 ? 'var(--warning)' : 'inherit' }}>
                      +{w.otHours}h
                    </b>{' '}
                    / {w.maxOtLimit}h
                  </span>
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
                    <AlertTriangle size={11} /> Melebihi Batas (Risiko Skorsing)
                  </div>
                ) : isWarning ? (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '9.5px',
                      fontWeight: 650,
                      color: '#d97706',
                      marginTop: '2px'
                    }}
                  >
                    <AlertTriangle size={11} /> Waspada Beban Lembur Tinggi
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
                    <CheckCircle2 size={11} /> Sesuai Regulasi (Aman)
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
