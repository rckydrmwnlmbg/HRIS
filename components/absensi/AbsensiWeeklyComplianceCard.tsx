'use client';
import React, { useMemo } from 'react';
import type { AbsensiRecord, Language } from '@/types';
import { Clock } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';

interface AbsensiWeeklyComplianceCardProps {
  records: AbsensiRecord[];
  corrections?: Map<string, AbsensiRecord>;
  lang: Language;
}

interface DailyWorkPoint {
  dateStr: string;
  dayLabel: string;
  shortDate: string;
  fullDateStr: string;
  regularHours: number;
  otHours: number;
  totalHours: number;
}

interface WeekGroup {
  weekNum: number;
  label: string;
  startDate: string;
  endDate: string;
  dateRangeStr: string;
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
  dailyPoints: DailyWorkPoint[];
}

function MarqueeBadge({
  text,
  bg,
  color,
  border
}: {
  text: string;
  bg: string;
  color: string;
  border: string;
}) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const textRef = React.useRef<HTMLSpanElement>(null);
  const [marqueeOffset, setMarqueeOffset] = React.useState<number>(0);

  React.useEffect(() => {
    if (containerRef.current && textRef.current) {
      const containerW = containerRef.current.clientWidth - 16; // minus padding 8px * 2
      const textW = textRef.current.scrollWidth;
      if (textW > containerW) {
        setMarqueeOffset(containerW - textW);
      } else {
        setMarqueeOffset(0);
      }
    }
  }, [text]);

  const isMarquee = marqueeOffset < 0;

  return (
    <div
      ref={containerRef}
      style={{
        fontSize: '10.5px',
        fontWeight: 750,
        padding: '2px 8px',
        borderRadius: '999px',
        backgroundColor: bg,
        color: color,
        border: `1px solid ${border}`,
        letterSpacing: '0.01em',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        maxWidth: '82px',
        minWidth: '54px',
        height: '21px',
        maxHeight: '21px',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: isMarquee ? 'flex-start' : 'center',
        flexShrink: 0,
        boxSizing: 'border-box',
        cursor: 'default'
      }}
      title={text}
    >
      <span
        ref={textRef}
        style={{
          display: 'inline-block',
          whiteSpace: 'nowrap',
          willChange: isMarquee ? 'transform' : 'auto',
          animation: isMarquee ? 'marqueeBadge 4.5s ease-in-out infinite alternate' : 'none',
          ['--marquee-offset' as any]: `${marqueeOffset}px`
        }}
      >
        {text}
      </span>
    </div>
  );
}

const CustomSparklineTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    if (data.dateStr === 'start') return null;

    return (
      <div
        style={{
          background: 'rgba(10, 18, 36, 0.88)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(255, 255, 255, 0.18)',
          borderRadius: '8px',
          padding: '6px 10px',
          fontSize: '11px',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
          color: '#f8fafc',
          pointerEvents: 'none',
          whiteSpace: 'nowrap'
        }}
      >
        <div style={{ fontWeight: 650, marginBottom: '2px', color: '#94a3b8', fontSize: '10.5px' }}>
          {data.fullDateStr || data.dateStr}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontWeight: 800, color: payload[0].color || '#38bdf8', fontSize: '12px' }}>
            {data.totalHours} Jam
          </span>
          <span style={{ fontSize: '10px', color: '#cbd5e1' }}>
            (Kerja: {data.regularHours}h, OT: +{data.otHours}h)
          </span>
        </div>
      </div>
    );
  }
  return null;
};

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
    const dayNamesId = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
    const dayNamesEn = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayNames = lang === 'id' ? dayNamesId : dayNamesEn;

    weekGroups.forEach((recordsInWeek, idx) => {
      let regH = 0;
      let otH = 0;
      const dailyPoints: DailyWorkPoint[] = [];

      recordsInWeek.forEach(r => {
        // Ambil data draft koreksi real-time jika sedang diedit oleh HR
        const eff = corrections?.get(r.DATE_TRANS) || r;

        const isHoliday = eff.STATUS_HARI === 'LIBUR' || eff.STATUS_HARI === 'L';
        const hasReason = Boolean(eff.REASON && eff.REASON.trim() !== '' && eff.REASON.trim() !== '-');
        const isPresent = Boolean(eff.WORK_IN || eff.WORK_OUT || (typeof eff.JAM_KERJA === 'number' && eff.JAM_KERJA > 0));

        // Jam kerja reguler
        let dailyReg = 0;
        if (typeof eff.JAM_KERJA === 'number' && eff.JAM_KERJA > 0) {
          dailyReg = eff.JAM_KERJA;
        } else if (isPresent && !isHoliday && !hasReason) {
          dailyReg = 8;
        }

        // Jam lembur (OT)
        const ot1 = Number(eff.OT1 ?? (eff as any).OT_1 ?? 0);
        const ot2 = Number(eff.OT2 ?? (eff as any).OT_2 ?? 0);
        const ot3 = Number(eff.OT3 ?? (eff as any).OT_3 ?? 0);
        const ot4 = Number(eff.OT4 ?? (eff as any).OT_4 ?? 0);
        const dailyOt = (eff as any).T_OT !== undefined && (eff as any).T_OT !== null
          ? Number((eff as any).T_OT)
          : (ot1 + ot2 + ot3 + ot4);

        regH += dailyReg;
        otH += dailyOt;

        const d = parseDateOnly(r.DATE_TRANS);
        const dayName = dayNames[d.getDay()];
        const shortDate = `${d.getDate()} ${monthNames[d.getMonth()]}`;

        dailyPoints.push({
          dateStr: r.DATE_TRANS,
          dayLabel: dayName,
          shortDate,
          fullDateStr: `${dayName}, ${d.getDate()} ${monthNames[d.getMonth()]}`,
          regularHours: Math.round(dailyReg * 10) / 10,
          otHours: Math.round(dailyOt * 10) / 10,
          totalHours: Math.round((dailyReg + dailyOt) * 10) / 10
        });
      });

      const firstRec = recordsInWeek[0];
      const lastRec = recordsInWeek[recordsInWeek.length - 1];

      const dStart = parseDateOnly(firstRec.DATE_TRANS);
      const dEnd = parseDateOnly(lastRec.DATE_TRANS);

      const startStr = `${dStart.getDate()} ${monthNames[dStart.getMonth()]}`;
      const endStr = `${dEnd.getDate()} ${monthNames[dEnd.getMonth()]}`;

      // Ringkas: "8 - 14 Jun" jika bulan sama, atau "28 Jun - 4 Jul" jika beda bulan
      const dateRangeStr = dStart.getMonth() === dEnd.getMonth()
        ? `${dStart.getDate()} - ${dEnd.getDate()} ${monthNames[dEnd.getMonth()]}`
        : `${startStr} - ${endStr}`;

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
        dateRangeStr,
        regularHours: Math.round(regH * 10) / 10,
        otHours: Math.round(otH * 10) / 10,
        totalHours: totalH,
        maxRegularLimit: maxReg,
        maxOtLimit: maxOt,
        maxTotalLimit: maxTotal,
        isOverLimit: isOver,
        isWarning: isWarn,
        excessHours: excess,
        daysCount,
        dailyPoints
      });
    });

    return result;
  }, [records, corrections, lang]);

  if (weeklyData.length === 0) return null;

  return (
    <div style={{ marginBottom: '20px' }}>
      {/* Grid Kartu Monitoring Beban Jam Kerja Mingguan (Style: Ephraim Duncan stats-4) */}
      <div className="glass-card" style={{ padding: '16px 20px' }}>
        {/* Header Monitoring */}
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
            {lang === 'id'
              ? 'Standar Resmi: Maks. 40h Reguler + Maks. 18h Lembur (Batas 58h/Minggu)'
              : 'Official: Max 40h Regular + Max 18h OT (Limit 58h/Week)'}
          </span>
        </div>

        {/* Grid Stats-4 Cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(auto-fit, minmax(215px, 1fr))`,
            gap: '12px'
          }}
        >
          {weeklyData.map(w => {
            const isDanger = w.isOverLimit;
            const isWarning = w.isWarning;

            // Color palette directly corresponding to stats-4 (Red when exceeding, Green when safe)
            const accentColor = isDanger ? '#ef4444' : isWarning ? '#f59e0b' : '#10b981';
            const bgBadge = isDanger
              ? 'rgba(239, 68, 68, 0.12)'
              : isWarning
              ? 'rgba(245, 158, 11, 0.12)'
              : 'rgba(16, 185, 129, 0.12)';
            const borderBadge = isDanger
              ? 'rgba(239, 68, 68, 0.35)'
              : isWarning
              ? 'rgba(245, 158, 11, 0.35)'
              : 'rgba(16, 185, 129, 0.28)';

            const gradientId = `sparkline-gradient-w${w.weekNum}`;

            // Create smooth progression points for AreaChart sparkline
            const chartData = w.dailyPoints.length === 1
              ? [
                  {
                    dateStr: 'start',
                    dayLabel: '',
                    shortDate: '',
                    fullDateStr: `${w.startDate} (Mulai)`,
                    regularHours: 0,
                    otHours: 0,
                    totalHours: 0
                  },
                  w.dailyPoints[0]
                ]
              : w.dailyPoints;

            const maxVal = Math.max(...chartData.map(p => p.totalHours), 10);

            return (
              <div
                key={w.weekNum}
                style={{
                  padding: '14px 16px 10px 16px',
                  borderRadius: '16px',
                  background: isDanger
                    ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(239, 68, 68, 0.02) 45%, var(--glass-bg) 100%)'
                    : 'var(--glass-bg)',
                  border: `1px solid ${isDanger ? 'rgba(239, 68, 68, 0.42)' : 'var(--glass-border)'}`,
                  boxShadow: isDanger
                    ? '0 10px 28px -6px rgba(239, 68, 68, 0.2), inset 0 1px 1px 0 rgba(255, 255, 255, 0.4)'
                    : 'var(--glass-shadow)',
                  backdropFilter: 'blur(20px) saturate(180%)',
                  WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  position: 'relative',
                  overflow: 'hidden',
                  transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
                }}
              >
                {/* 1. Header: Week Title & Status Delta Badge (Single line + Marquee) */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '8px',
                    minHeight: '22px'
                  }}
                >
                  <div
                    style={{
                      fontSize: '12.5px',
                      fontWeight: 750,
                      color: 'var(--text-primary)',
                      letterSpacing: '-0.01em',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      minWidth: 0,
                      flex: 1
                    }}
                    title={`${w.label} (${w.dateRangeStr})`}
                  >
                    {w.label}{' '}
                    <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-muted)' }}>
                      ({w.dateRangeStr})
                    </span>
                  </div>

                  <MarqueeBadge
                    text={
                      isDanger
                        ? `+${w.excessHours}h Over`
                        : isWarning
                        ? `+${w.otHours}h OT`
                        : `+${w.otHours}h OT`
                    }
                    bg={bgBadge}
                    color={accentColor}
                    border={borderBadge}
                  />
                </div>

                {/* 2. Main Value & Sub-indicator */}
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: '2px' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px' }}>
                    <span
                      style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: '1.5rem',
                        fontWeight: 800,
                        color: accentColor,
                        letterSpacing: '-0.02em',
                        lineHeight: 1
                      }}
                    >
                      {w.totalHours}
                    </span>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)' }}>
                      Jam Total
                    </span>
                  </div>

                  <span
                    style={{
                      fontSize: '10.5px',
                      fontWeight: 650,
                      color: isDanger ? '#ef4444' : isWarning ? '#d97706' : 'var(--text-secondary)'
                    }}
                  >
                    {isDanger ? 'Melebihi Batas' : isWarning ? 'Beban Tinggi' : 'Sesuai Regulasi'}
                  </span>
                </div>

                {/* 3. Sparkline AreaChart (Stats-4 Signature Style) */}
                <div style={{ height: '54px', width: '100%', minHeight: '54px', margin: '4px 0 -2px 0' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={accentColor} stopOpacity={0.4} />
                          <stop offset="95%" stopColor={accentColor} stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="dayLabel" hide={true} />
                      <YAxis hide={true} domain={[0, maxVal + 1]} />
                      <Tooltip content={<CustomSparklineTooltip />} />
                      <Area
                        type="monotone"
                        dataKey="totalHours"
                        stroke={accentColor}
                        strokeWidth={2}
                        fill={`url(#${gradientId})`}
                        fillOpacity={1}
                        dot={false}
                        activeDot={{ r: 4, stroke: accentColor, strokeWidth: 1.5, fill: '#fff' }}
                        isAnimationActive={true}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                {/* 4. Footer: Work & OT Breakdown */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '10.5px',
                    color: 'var(--text-secondary)',
                    paddingTop: '6px',
                    borderTop: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))'
                  }}
                >
                  <span>
                    Kerja: <b>{w.regularHours}h</b> / {w.maxRegularLimit}h
                  </span>
                  <span>
                    Lembur:{' '}
                    <b style={{ color: w.otHours > w.maxOtLimit ? '#ef4444' : w.otHours > 0 ? 'var(--warning)' : 'inherit' }}>
                      +{w.otHours}h
                    </b>{' '}
                    / {w.maxOtLimit}h
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
