'use client';
import React from 'react';
import type { AbsensiRecord, Reason, Shift, Language } from '@/types';
import { DataTable } from '@/components/ui/DataTable';
import { CheckSquare, X, Loader2 } from 'lucide-react';
import { calculateAttendanceAndOt } from '@/lib/otCalculator';

interface AbsensiMonthlyTableProps {
  records: AbsensiRecord[];
  corrections: Map<string, AbsensiRecord>;
  setCorrections: React.Dispatch<React.SetStateAction<Map<string, AbsensiRecord>>>;
  masterReasons: Reason[];
  masterShifts: Shift[];
  onApply: (dateTrans: string) => void;
  onApplyAll: () => void;
  applyingAll?: boolean;
  lang: Language;
  user: any;
}

const MONTH_MAP: Record<string, { num: string; name: string }> = {
  '1': { num: '01', name: 'Jan' }, '01': { num: '01', name: 'Jan' }, 'jan': { num: '01', name: 'Jan' },
  '2': { num: '02', name: 'Feb' }, '02': { num: '02', name: 'Feb' }, 'feb': { num: '02', name: 'Feb' },
  '3': { num: '03', name: 'Mar' }, '03': { num: '03', name: 'Mar' }, 'mar': { num: '03', name: 'Mar' },
  '4': { num: '04', name: 'Apr' }, '04': { num: '04', name: 'Apr' }, 'apr': { num: '04', name: 'Apr' },
  '5': { num: '05', name: 'May' }, '05': { num: '05', name: 'May' }, 'may': { num: '05', name: 'May' }, 'mei': { num: '05', name: 'May' },
  '6': { num: '06', name: 'Jun' }, '06': { num: '06', name: 'Jun' }, 'jun': { num: '06', name: 'Jun' },
  '7': { num: '07', name: 'Jul' }, '07': { num: '07', name: 'Jul' }, 'jul': { num: '07', name: 'Jul' },
  '8': { num: '08', name: 'Aug' }, '08': { num: '08', name: 'Aug' }, 'aug': { num: '08', name: 'Aug' }, 'agu': { num: '08', name: 'Aug' },
  '9': { num: '09', name: 'Sep' }, '09': { num: '09', name: 'Sep' }, 'sep': { num: '09', name: 'Sep' },
  '10': { num: '10', name: 'Oct' }, 'oct': { num: '10', name: 'Oct' }, 'okt': { num: '10', name: 'Oct' },
  '11': { num: '11', name: 'Nov' }, 'nov': { num: '11', name: 'Nov' },
  '12': { num: '12', name: 'Dec' }, 'dec': { num: '12', name: 'Dec' }, 'des': { num: '12', name: 'Dec' },
};

function normalizeDateInput(raw: string): { display: string; isoDate: string | null } {
  const trimmed = (raw || '').trim();
  if (!trimmed || trimmed === '-' || trimmed === 'null' || trimmed === 'undefined') {
    return { display: '-', isoDate: null };
  }

  // Cek jika angka murni (misal: 010826 -> 01-Aug-26, 01082026 -> 01-Aug-26)
  const cleanDigits = trimmed.replace(/\D/g, '');
  if (cleanDigits.length === 6 || cleanDigits.length === 8) {
    const d = cleanDigits.substring(0, 2);
    const m = cleanDigits.substring(2, 4);
    const y = cleanDigits.length === 6 ? '20' + cleanDigits.substring(4, 6) : cleanDigits.substring(4, 8);
    const mObj = MONTH_MAP[m] || { num: m.padStart(2, '0'), name: m };
    const fullDay = d.padStart(2, '0');
    const fullMonth = mObj.num.padStart(2, '0');
    return {
      display: `${fullDay}-${mObj.name}-${y.slice(-2)}`,
      isoDate: `${y}-${fullMonth}-${fullDay}`
    };
  }

  // Split dengan pemisah umum: -, /, ., spasi
  const parts = trimmed.split(/[-/.\s]+/);
  if (parts.length === 3) {
    const [p1, p2, p3] = parts;
    const d = p1.padStart(2, '0');
    const mKey = p2.toLowerCase();
    const mObj = MONTH_MAP[mKey] || { num: p2.padStart(2, '0'), name: p2 };
    const fullY = p3.length === 2 ? '20' + p3 : (p3.length === 4 ? p3 : '2026');
    const fullMonth = mObj.num.padStart(2, '0');
    return {
      display: `${d}-${mObj.name}-${fullY.slice(-2)}`,
      isoDate: `${fullY}-${fullMonth}-${d}`
    };
  }

  return { display: trimmed, isoDate: null };
}

function addDaysToIso(isoDateStr: string, days: number): string {
  const parts = isoDateStr.split('-');
  if (parts.length !== 3) return isoDateStr;
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatIsoToDisplay(isoDateStr: string): string {
  const parts = isoDateStr.split('-');
  if (parts.length !== 3) return isoDateStr;
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const day = String(d.getDate()).padStart(2, '0');
  const mName = monthNames[d.getMonth()];
  const y = String(d.getFullYear()).slice(-2);
  return `${day}-${mName}-${y}`;
}

function formatTimeMask(val: string): string {
  const trimmed = (val || '').trim();
  if (!trimmed || trimmed === '-' || trimmed === 'null' || trimmed === 'undefined') return '-';
  
  let clean = trimmed.replace(/\./g, ':');
  const digits = clean.replace(/\D/g, '');

  if (!clean.includes(':') && digits.length >= 2) {
    if (digits.length <= 4) {
      const hh = digits.substring(0, 2);
      const mm = digits.substring(2).padEnd(2, '0');
      return `${hh}:${mm}:00`;
    } else {
      const hh = digits.substring(0, 2);
      const mm = digits.substring(2, 4);
      const ss = digits.substring(4, 6).padEnd(2, '0');
      return `${hh}:${mm}:${ss}`;
    }
  }

  const timeParts = clean.split(':');
  if (timeParts.length === 2) {
    const hh = timeParts[0].padStart(2, '0');
    const mm = timeParts[1].padStart(2, '0');
    return `${hh}:${mm}:00`;
  }
  if (timeParts.length === 3) {
    const hh = timeParts[0].padStart(2, '0');
    const mm = timeParts[1].padStart(2, '0');
    const ss = timeParts[2].padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  }

  return clean;
}

function timeToMinutes(timeStr: string): number | null {
  if (!timeStr || timeStr === '-') return null;
  const clean = formatTimeMask(timeStr);
  const parts = clean.split(':');
  if (parts.length < 2) return null;
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}

function buildDateTime(dateStr: string, timeStr: string): string | null {
  if (!dateStr || dateStr === '-' || !timeStr || timeStr === '-') return null;
  const { isoDate } = normalizeDateInput(dateStr);
  if (!isoDate) return null;
  
  const formattedTime = formatTimeMask(timeStr);
  if (!formattedTime || formattedTime === '-') return null;
  
  return `${isoDate}T${formattedTime}.000`;
}

export function AbsensiMonthlyTable({
  records,
  corrections,
  setCorrections,
  masterReasons,
  masterShifts,
  onApply,
  onApplyAll,
  applyingAll = false,
  lang,
  user,
}: AbsensiMonthlyTableProps) {
  const getDisplayRecord = (r: AbsensiRecord): AbsensiRecord => {
    const corr = corrections.get(r.DATE_TRANS);
    return (corr && corr.correction_status === 'draft') ? corr : r;
  };

  const getFormattedDateStr = (dateVal: string | null) => {
    if (!dateVal) return '';
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return '';
    const y = String(d.getFullYear()).slice(-2);
    const day = String(d.getDate()).padStart(2, '0');
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const mName = monthNames[d.getMonth()];
    return `${day}-${mName}-${y}`;
  };

  const getFormattedTimeStr = (dateVal: string | null) => {
    if (!dateVal) return '';
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return '';
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  };

  const draftCorrections = Array.from(corrections.values()).filter(c => c.correction_status !== 'applied');
  const hasDrafts = draftCorrections.length > 0;

  // ⌨️ SHORTCUT GLOBAL CTRL + S: Terapkan Semua Draft Koreksi Langsung dari Keyboard
  React.useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (hasDrafts && !applyingAll) {
          onApplyAll();
        }
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [hasDrafts, applyingAll, onApplyAll]);

  // ⬇️⬆️ EXCEL-STYLE GRID NAVIGATION: Panah Bawah / Enter turun 1 baris, Panah Atas naik 1 baris
  const handleCellKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>,
    rowIndex: number,
    colKey: string
  ) => {
    if (e.key === 'ArrowDown' || e.key === 'Enter') {
      e.preventDefault();
      (e.target as HTMLElement).blur();
      const nextRow = rowIndex + 1;
      if (nextRow < records.length) {
        const nextEl = document.querySelector<HTMLElement>(`[data-grid-cell="${colKey}-${nextRow}"]`);
        if (nextEl) {
          nextEl.focus();
          if ('select' in nextEl && typeof (nextEl as any).select === 'function') {
            (nextEl as any).select();
          }
        }
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      (e.target as HTMLElement).blur();
      const prevRow = rowIndex - 1;
      if (prevRow >= 0) {
        const prevEl = document.querySelector<HTMLElement>(`[data-grid-cell="${colKey}-${prevRow}"]`);
        if (prevEl) {
          prevEl.focus();
          if ('select' in prevEl && typeof (prevEl as any).select === 'function') {
            (prevEl as any).select();
          }
        }
      }
    }
  };

  return (
    <div className="glass-card" style={{ overflow: 'hidden' }}>
      {hasDrafts && (
        <div
          style={{
            padding: '12px 18px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: 'rgba(5, 150, 105, 0.08)'
          }}
        >
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--success)' }}>
            {lang === 'id'
              ? `Terdapat ${draftCorrections.length} koreksi dalam status Draft (Tersimpan Sementara)`
              : `There are ${draftCorrections.length} unapplied corrections (Draft)`}
          </span>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button className="btn btn-sm btn-secondary" disabled={applyingAll} onClick={() => setCorrections(new Map())}>
              <X size={14} /> {lang === 'id' ? 'Batalkan Semua' : 'Cancel All'}
            </button>
            <button
              className="btn btn-sm btn-success"
              disabled={applyingAll}
              onClick={onApplyAll}
              style={{ minWidth: '145px' }}
              title="Shortcut: Tekan Ctrl + S"
            >
              {applyingAll ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> {lang === 'id' ? 'Menyimpan...' : 'Saving...'}
                </>
              ) : (
                <>
                  <CheckSquare size={14} /> {lang === 'id' ? 'Terapkan Semua' : 'Apply All'} ({draftCorrections.length})
                  <span style={{ fontSize: '10px', opacity: 0.8, marginLeft: '3px', fontWeight: 400 }}>(Ctrl+S)</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      <div className="table-responsive">
        <DataTable>
          <thead>
            <tr>
              <th style={{ textAlign: 'center', width: '140px' }}>SHIFT</th>
              <th style={{ width: '100px' }}>{lang === 'id' ? 'TGL MASUK' : 'DATE IN'}</th>
              <th style={{ width: '90px' }}>{lang === 'id' ? 'JAM MASUK' : 'TIME IN'}</th>
              <th style={{ width: '100px' }}>{lang === 'id' ? 'TGL KELUAR' : 'DATE OUT'}</th>
              <th style={{ width: '90px' }}>{lang === 'id' ? 'JAM KELUAR' : 'TIME OUT'}</th>
              <th style={{ width: '140px' }}>{lang === 'id' ? 'ALASAN' : 'REASON'}</th>
              <th style={{ width: '110px' }}>{lang === 'id' ? 'STATUS HARI' : 'DAY STATUS'}</th>
              <th style={{ width: '55px', textAlign: 'center' }}>OT 1</th>
              <th style={{ width: '55px', textAlign: 'center' }}>OT 2</th>
              <th style={{ width: '55px', textAlign: 'center' }}>OT 3</th>
              <th style={{ width: '55px', textAlign: 'center' }}>OT 4</th>
              {hasDrafts && <th style={{ width: '70px', textAlign: 'center' }}>AKSI</th>}
            </tr>
          </thead>
          <tbody>
            {records.map((r, idx) => {
              const disp = getDisplayRecord(r);
              const hasCorrection = corrections.has(r.DATE_TRANS);
              const corrStatus = disp.correction_status;
              const isDraft = hasCorrection && corrStatus === 'draft';

              const currentShift = (disp.corrected_shift || r.SHIFT || '').trim();
              
              let rawDbStatus = (r.STATUS_HARI || '').trim().toUpperCase();
              if (rawDbStatus === 'L') rawDbStatus = 'LIBUR';
              if (rawDbStatus === 'K') rawDbStatus = 'KERJA';

              const currentStatus = (disp?.corrected_status !== undefined && disp?.corrected_status !== null) ? disp.corrected_status : rawDbStatus;

              const currentInDate = (corrections.get(r.DATE_TRANS) as any)?.in_date_str ?? (disp?.WORK_IN ? getFormattedDateStr(disp.WORK_IN) : getFormattedDateStr(r.DATE_TRANS));
              const currentInTime = (corrections.get(r.DATE_TRANS) as any)?.in_time_str ?? (disp?.WORK_IN ? getFormattedTimeStr(disp.WORK_IN) : '-');
              const currentOutDate = (corrections.get(r.DATE_TRANS) as any)?.out_date_str ?? (disp?.WORK_OUT ? getFormattedDateStr(disp.WORK_OUT) : getFormattedDateStr(r.DATE_TRANS));
              const currentOutTime = (corrections.get(r.DATE_TRANS) as any)?.out_time_str ?? (disp?.WORK_OUT ? getFormattedTimeStr(disp.WORK_OUT) : '-');

              const currentReason = String(disp?.corrected_reason !== undefined ? (disp?.corrected_reason ?? '') : (r.REASON ?? '')).trim();

              const handleInlineChange = (field: string, val: string) => {
                let updated = corrections.get(r.DATE_TRANS) || {
                  ...r,
                  correction_status: 'draft',
                  correction_by: 'lusi',
                  correction_at: new Date().toISOString()
                };

                if (updated.correction_status === 'applied') {
                  updated = { ...updated, correction_status: 'draft', correction_at: new Date().toISOString() };
                }

                if (field === 'shift') updated.corrected_shift = val;
                if (field === 'status') {
                  updated.corrected_status = val === '' ? null : val;
                }

                if (field === 'reason') {
                  const safeReason = val === '' ? null : val;
                  updated.corrected_reason = safeReason as any;
                  // Jika memilih alasan Cuti/Izin/Sakit (bukan kerja/dinas), otomatis bersihkan jam masuk/pulang
                  if (safeReason && !['01', '03', '04', '20', '21'].includes(safeReason)) {
                    (updated as any).in_time_str = '-';
                    (updated as any).out_time_str = '-';
                    updated.WORK_IN = null as any;
                    updated.WORK_OUT = null as any;
                  }
                }

                let effectiveInDate = (updated as any).in_date_str || currentInDate;
                let effectiveInTime = (updated as any).in_time_str || currentInTime;
                let effectiveOutDate = (updated as any).out_date_str || currentOutDate;
                let effectiveOutTime = (updated as any).out_time_str || currentOutTime;

                if (field === 'in_date') effectiveInDate = val;
                if (field === 'in_time') effectiveInTime = val;
                if (field === 'out_date') effectiveOutDate = val;
                if (field === 'out_time') effectiveOutTime = val;

                (updated as any).in_date_str = effectiveInDate;
                (updated as any).in_time_str = effectiveInTime;
                (updated as any).out_date_str = effectiveOutDate;
                (updated as any).out_time_str = effectiveOutTime;

                // 🌙 DETEKSI OTOMATIS SHIFT LINTAS HARI (OVERNIGHT):
                // Jika jam pulang < jam masuk (misal masuk 14:53 pulang 08:00, atau masuk 23:00 pulang 07:00),
                // maka tanggal keluar otomatis bertambah +1 hari dari tanggal masuk!
                const inM = timeToMinutes(effectiveInTime);
                const outM = timeToMinutes(effectiveOutTime);
                const { isoDate: inIso } = normalizeDateInput(effectiveInDate);

                if (inM !== null && outM !== null && inIso) {
                  if (outM < inM) {
                    const nextIso = addDaysToIso(inIso, 1);
                    const nextDisplay = formatIsoToDisplay(nextIso);
                    
                    // Update tampilan tanggal keluar menjadi +1 hari jika user tidak mengedit tanggal keluar secara spesifik
                    if (field !== 'out_date') {
                      effectiveOutDate = nextDisplay;
                      (updated as any).out_date_str = nextDisplay;
                    }
                    updated.WORK_OUT = `${nextIso}T${formatTimeMask(effectiveOutTime)}.000` as any;
                  } else if (outM >= inM && (field === 'out_time' || field === 'in_time')) {
                    // Jika jam pulang >= jam masuk pada hari yang sama
                    effectiveOutDate = effectiveInDate;
                    (updated as any).out_date_str = effectiveInDate;
                    updated.WORK_OUT = `${inIso}T${formatTimeMask(effectiveOutTime)}.000` as any;
                  }
                }

                const newInDt = buildDateTime(effectiveInDate, effectiveInTime);
                updated.WORK_IN = newInDt as any;

                if (outM !== null && inM !== null && outM < inM && inIso) {
                  const nextIso = addDaysToIso(inIso, 1);
                  const formattedOutTime = formatTimeMask(effectiveOutTime);
                  if (formattedOutTime && formattedOutTime !== '-') {
                    updated.WORK_OUT = `${nextIso}T${formattedOutTime}.000` as any;
                  } else {
                    updated.WORK_OUT = null as any;
                  }
                } else {
                  const newOutDt = buildDateTime(effectiveOutDate, effectiveOutTime);
                  updated.WORK_OUT = newOutDt as any;
                }

                delete (updated as any).WORK_IN_STR;
                delete (updated as any).WORK_OUT_STR;

                // ⚡ LIVE OT PREVIEW: Hitung lembur langsung di browser saat pengetikan / koreksi
                const wInDate = updated.WORK_IN ? new Date(updated.WORK_IN) : null;
                const wOutDate = updated.WORK_OUT ? new Date(updated.WORK_OUT) : null;
                if (wInDate && wOutDate && !isNaN(wInDate.getTime()) && !isNaN(wOutDate.getTime())) {
                  const calc = calculateAttendanceAndOt(
                    r.DATE_TRANS,
                    wInDate,
                    wOutDate,
                    (user as any)?.JOB_DESC || '',
                    (user as any)?.SEC_DESC || '',
                    currentStatus || 'KERJA',
                    currentShift || '1'
                  );
                  (updated as any).OT_1 = calc.OT_1;
                  (updated as any).OT_2 = calc.OT_2;
                  (updated as any).OT_3 = calc.OT_3;
                  (updated as any).OT_4 = calc.OT_4;
                  (updated as any).OT1 = calc.OT_1;
                  (updated as any).OT2 = calc.OT_2;
                  (updated as any).OT3 = calc.OT_3;
                  (updated as any).OT4 = calc.OT_4;
                  (updated as any).T_OT = calc.T_OT;
                  updated.JAM_KERJA = calc.JAM_KERJA ?? 8;
                } else {
                  (updated as any).OT_1 = 0;
                  (updated as any).OT_2 = 0;
                  (updated as any).OT_3 = 0;
                  (updated as any).OT_4 = 0;
                  (updated as any).OT1 = 0;
                  (updated as any).OT2 = 0;
                  (updated as any).OT3 = 0;
                  (updated as any).OT4 = 0;
                  (updated as any).T_OT = 0;
                }

                setCorrections(prev => new Map(prev).set(r.DATE_TRANS, updated as AbsensiRecord));
              };

              const handleBlurFormatting = (field: string) => {
                const updated = corrections.get(r.DATE_TRANS);
                if (!updated) return;

                if (field === 'in_date' && (updated as any).in_date_str) {
                  const norm = normalizeDateInput((updated as any).in_date_str);
                  if (norm.display && norm.display !== (updated as any).in_date_str) {
                    handleInlineChange('in_date', norm.display);
                  }
                }
                if (field === 'out_date' && (updated as any).out_date_str) {
                  const norm = normalizeDateInput((updated as any).out_date_str);
                  if (norm.display && norm.display !== (updated as any).out_date_str) {
                    handleInlineChange('out_date', norm.display);
                  }
                }
                if (field === 'in_time' && (updated as any).in_time_str && (updated as any).in_time_str !== '-') {
                  const fmt = formatTimeMask((updated as any).in_time_str);
                  if (fmt !== (updated as any).in_time_str) {
                    handleInlineChange('in_time', fmt);
                  }
                }
                if (field === 'out_time' && (updated as any).out_time_str && (updated as any).out_time_str !== '-') {
                  const fmt = formatTimeMask((updated as any).out_time_str);
                  if (fmt !== (updated as any).out_time_str) {
                    handleInlineChange('out_time', fmt);
                  }
                }
              };

              const safeShifts = Array.isArray(masterShifts) ? masterShifts : [];
              const safeReasons = Array.isArray(masterReasons) ? masterReasons : [];

              const isHoliday = currentStatus === 'LIBUR';

              return (
                <tr
                  key={r.DATE_TRANS}
                  className={isDraft ? 'row-warning' : (hasCorrection && corrStatus === 'applied' ? 'row-success' : (isHoliday ? 'row-holiday' : ''))}
                  style={{
                    backgroundColor: isHoliday ? 'rgba(239, 68, 68, 0.05)' : undefined,
                    borderLeft: isHoliday ? '3.5px solid #ef4444' : undefined,
                    transition: 'background-color 0.15s ease'
                  }}
                >
                  <td>
                    <select
                      data-grid-cell={`shift-${idx}`}
                      className="form-select form-select-sm"
                      value={currentShift}
                      onChange={e => handleInlineChange('shift', e.target.value)}
                      onKeyDown={e => handleCellKeyDown(e, idx, 'shift')}
                      style={{ width: '100%', fontSize: '11px', padding: '3px 6px' }}
                    >
                      <option value="">-</option>
                      {currentShift && !safeShifts.some(s => s.shift_CODE === currentShift) && (
                        <option value={currentShift}>{currentShift}</option>
                      )}
                      {safeShifts.map(s => {
                        const inTime = s.WORK_IN ? String(s.WORK_IN).includes('T') ? String(s.WORK_IN).substring(11, 16) : String(s.WORK_IN).substring(0, 5) : '';
                        const outTime = s.WORK_OUT ? String(s.WORK_OUT).includes('T') ? String(s.WORK_OUT).substring(11, 16) : String(s.WORK_OUT).substring(0, 5) : '';
                        const shiftInfo = inTime && outTime ? ` (${inTime}-${outTime})` : '';
                        return (
                          <option key={s.shift_CODE} value={s.shift_CODE}>
                            {s.shift_CODE}{shiftInfo}
                          </option>
                        );
                      })}
                    </select>
                  </td>
                  <td>
                    <input
                      data-grid-cell={`in_date-${idx}`}
                      type="text"
                      className="form-input form-input-sm"
                      value={currentInDate}
                      onChange={e => handleInlineChange('in_date', e.target.value)}
                      onFocus={e => e.target.select()}
                      onBlur={() => handleBlurFormatting('in_date')}
                      onKeyDown={e => handleCellKeyDown(e, idx, 'in_date')}
                      placeholder="dd-MMM-yy"
                      maxLength={11}
                      style={{ width: '85px', fontSize: '11px', textAlign: 'center', padding: '4px' }}
                    />
                  </td>
                  <td>
                    <input
                      data-grid-cell={`in_time-${idx}`}
                      type="text"
                      className="form-input form-input-sm"
                      value={currentInTime}
                      onChange={e => handleInlineChange('in_time', e.target.value)}
                      onFocus={e => e.target.select()}
                      onBlur={() => handleBlurFormatting('in_time')}
                      onKeyDown={e => handleCellKeyDown(e, idx, 'in_time')}
                      placeholder="hh:mm:ss"
                      maxLength={8}
                      style={{
                        width: '75px',
                        fontSize: '11px',
                        textAlign: 'center',
                        color: currentInTime === '-' ? 'var(--text-muted)' : 'inherit',
                        padding: '4px'
                      }}
                    />
                  </td>
                  <td>
                    <input
                      data-grid-cell={`out_date-${idx}`}
                      type="text"
                      className="form-input form-input-sm"
                      value={currentOutDate}
                      onChange={e => handleInlineChange('out_date', e.target.value)}
                      onFocus={e => e.target.select()}
                      onBlur={() => handleBlurFormatting('out_date')}
                      onKeyDown={e => handleCellKeyDown(e, idx, 'out_date')}
                      placeholder="dd-MMM-yy"
                      maxLength={11}
                      style={{ width: '85px', fontSize: '11px', textAlign: 'center', padding: '4px' }}
                    />
                  </td>
                  <td>
                    <input
                      data-grid-cell={`out_time-${idx}`}
                      type="text"
                      className="form-input form-input-sm"
                      value={currentOutTime}
                      onChange={e => handleInlineChange('out_time', e.target.value)}
                      onFocus={e => e.target.select()}
                      onBlur={() => handleBlurFormatting('out_time')}
                      onKeyDown={e => handleCellKeyDown(e, idx, 'out_time')}
                      placeholder="hh:mm:ss"
                      maxLength={8}
                      style={{
                        width: '75px',
                        fontSize: '11px',
                        textAlign: 'center',
                        color: currentOutTime === '-' ? 'var(--text-muted)' : 'inherit',
                        padding: '4px'
                      }}
                    />
                  </td>
                  <td>
                    <select
                      data-grid-cell={`reason-${idx}`}
                      className="form-select form-select-sm"
                      value={currentReason}
                      onChange={e => handleInlineChange('reason', e.target.value)}
                      onKeyDown={e => handleCellKeyDown(e, idx, 'reason')}
                      style={{ width: '100%', fontSize: '11px', padding: '3px 6px' }}
                    >
                      <option value="">-</option>
                      {currentReason && !safeReasons.some(mr => mr.REASON_CODE === currentReason) && (
                        <option value={currentReason}>{currentReason}</option>
                      )}
                      {safeReasons.map(mr => (
                        <option key={mr.REASON_CODE} value={mr.REASON_CODE}>
                          {mr.REASON_DESC}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      data-grid-cell={`status-${idx}`}
                      className="form-select form-select-sm"
                      value={currentStatus}
                      onChange={e => handleInlineChange('status', e.target.value)}
                      onKeyDown={e => handleCellKeyDown(e, idx, 'status')}
                      style={{
                        width: '100%',
                        fontSize: '11px',
                        padding: '3px 6px',
                        backgroundColor: isHoliday ? 'rgba(239, 68, 68, 0.14)' : undefined,
                        color: isHoliday ? '#ef4444' : (currentStatus ? 'var(--text-primary)' : 'var(--text-muted)'),
                        borderColor: isHoliday ? 'rgba(239, 68, 68, 0.45)' : undefined,
                        fontWeight: isHoliday ? 750 : (currentStatus ? 600 : 400)
                      }}
                    >
                      <option value="" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--bg-secondary)' }}>-</option>
                      <option value="KERJA" style={{ color: 'var(--text-primary)', backgroundColor: 'var(--bg-secondary)' }}>KERJA</option>
                      <option value="LIBUR" style={{ color: '#ef4444', backgroundColor: 'var(--bg-secondary)', fontWeight: 700 }}>LIBUR</option>
                      <option value="O" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--bg-secondary)' }}>OFF (O)</option>
                    </select>
                  </td>
                  <td style={{ textAlign: 'center', fontSize: '12px', fontWeight: 600, color: ((disp as any).OT_1 || (disp as any).OT1 || r.OT1 || 0) > 0 ? 'var(--warning)' : 'var(--text-muted)' }}>
                    {((disp as any).OT_1 || (disp as any).OT1 || r.OT1 || 0) > 0 ? ((disp as any).OT_1 || (disp as any).OT1 || r.OT1) : '-'}
                  </td>
                  <td style={{ textAlign: 'center', fontSize: '12px', fontWeight: 600, color: ((disp as any).OT_2 || (disp as any).OT2 || r.OT2 || 0) > 0 ? 'var(--warning)' : 'var(--text-muted)' }}>
                    {((disp as any).OT_2 || (disp as any).OT2 || r.OT2 || 0) > 0 ? ((disp as any).OT_2 || (disp as any).OT2 || r.OT2) : '-'}
                  </td>
                  <td style={{ textAlign: 'center', fontSize: '12px', fontWeight: 600, color: ((disp as any).OT_3 || (disp as any).OT3 || r.OT3 || 0) > 0 ? 'var(--warning)' : 'var(--text-muted)' }}>
                    {((disp as any).OT_3 || (disp as any).OT3 || r.OT3 || 0) > 0 ? ((disp as any).OT_3 || (disp as any).OT3 || r.OT3) : '-'}
                  </td>
                  <td style={{ textAlign: 'center', fontSize: '12px', fontWeight: 600, color: ((disp as any).OT_4 || (disp as any).OT4 || r.OT4 || 0) > 0 ? 'var(--warning)' : 'var(--text-muted)' }}>
                    {((disp as any).OT_4 || (disp as any).OT4 || r.OT4 || 0) > 0 ? ((disp as any).OT_4 || (disp as any).OT4 || r.OT4) : '-'}
                  </td>
                  {hasDrafts && (
                    <td style={{ textAlign: 'center' }}>
                      {isDraft && (
                        <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                          <button
                            className="btn btn-sm btn-success btn-icon"
                            style={{ padding: '4px 6px' }}
                            onClick={() => onApply(r.DATE_TRANS)}
                            title="Terapkan Baris Ini"
                          >
                            <CheckSquare size={13} />
                          </button>
                          <button
                            className="btn btn-sm btn-secondary btn-icon"
                            style={{ padding: '4px 6px' }}
                            onClick={() => {
                              const newCorrs = new Map(corrections);
                              newCorrs.delete(r.DATE_TRANS);
                              setCorrections(newCorrs);
                            }}
                            title="Batalkan Koreksi Baris Ini"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </DataTable>
      </div>
    </div>
  );
}
