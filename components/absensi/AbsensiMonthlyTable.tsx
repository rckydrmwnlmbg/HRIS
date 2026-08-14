'use client';
import React from 'react';
import type { AbsensiRecord, Reason, Shift, Language } from '@/types';
import { DataTable } from '@/components/ui/DataTable';
import { CheckSquare, X } from 'lucide-react';

interface AbsensiMonthlyTableProps {
  records: AbsensiRecord[];
  corrections: Map<string, AbsensiRecord>;
  setCorrections: React.Dispatch<React.SetStateAction<Map<string, AbsensiRecord>>>;
  masterReasons: Reason[];
  masterShifts: Shift[];
  onApply: (dateTrans: string) => void;
  onApplyAll: () => void;
  lang: Language;
  user: any;
}

export function AbsensiMonthlyTable({
  records,
  corrections,
  setCorrections,
  masterReasons,
  masterShifts,
  onApply,
  onApplyAll,
  lang,
  user,
}: AbsensiMonthlyTableProps) {
  const getDisplayRecord = (r: AbsensiRecord): AbsensiRecord => {
    return corrections.get(r.DATE_TRANS) || r;
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
              ? `Terdapat ${draftCorrections.length} koreksi dalam status Draft (Belum Disimpan)`
              : `There are ${draftCorrections.length} unapplied corrections (Draft)`}
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-sm btn-secondary" onClick={() => setCorrections(new Map())}>
              <X size={14} /> {lang === 'id' ? 'Batalkan Semua' : 'Cancel All'}
            </button>
            <button className="btn btn-sm btn-success" onClick={onApplyAll}>
              <CheckSquare size={14} /> {lang === 'id' ? 'Terapkan Semua' : 'Apply All'} ({draftCorrections.length})
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
            {records.map(r => {
              const disp = getDisplayRecord(r);
              const hasCorrection = corrections.has(r.DATE_TRANS);
              const corrStatus = disp.correction_status;
              const isDraft = hasCorrection && corrStatus === 'draft';

              const currentShift = (disp.corrected_shift || r.SHIFT || '').trim();
              let defaultStatus = 'KERJA';
              if (r.STATUS_HARI === 'L' || r.STATUS_HARI === 'LIBUR') defaultStatus = 'LIBUR';
              if (r.STATUS_HARI === 'O') defaultStatus = 'O';

              const currentInDate = (corrections.get(r.DATE_TRANS) as any)?.in_date_str ?? (disp.WORK_IN ? getFormattedDateStr(disp.WORK_IN) : getFormattedDateStr(r.DATE_TRANS));
              const currentInTime = (corrections.get(r.DATE_TRANS) as any)?.in_time_str ?? (disp.WORK_IN ? getFormattedTimeStr(disp.WORK_IN) : '-');
              const currentOutDate = (corrections.get(r.DATE_TRANS) as any)?.out_date_str ?? (disp.WORK_OUT ? getFormattedDateStr(disp.WORK_OUT) : getFormattedDateStr(r.DATE_TRANS));
              const currentOutTime = (corrections.get(r.DATE_TRANS) as any)?.out_time_str ?? (disp.WORK_OUT ? getFormattedTimeStr(disp.WORK_OUT) : '-');

              const currentReason = (disp.corrected_reason || r.REASON || '').trim();
              const currentStatus = disp.corrected_status || defaultStatus;

              const handleInlineChange = (field: string, val: string) => {
                let updated = corrections.get(r.DATE_TRANS) || {
                  ...r,
                  correction_status: 'draft',
                  correction_by: user?.nama || 'Admin',
                  correction_at: new Date().toISOString()
                };

                if (updated.correction_status === 'applied') {
                  updated = { ...updated, correction_status: 'draft', correction_at: new Date().toISOString() };
                }

                if (field === 'shift') updated.corrected_shift = val;
                if (field === 'reason') updated.corrected_reason = val;
                if (field === 'status') updated.corrected_status = val;

                const buildDateTime = (dateStr: string, timeStr: string) => {
                  if (!dateStr || dateStr === '-') return null;
                  const parts = dateStr.split('-');
                  if (parts.length !== 3) return null;
                  const [d, mStr, y] = parts;

                  let m = mStr;
                  if (isNaN(Number(mStr))) {
                    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                    const mIdx = monthNames.findIndex(x => x.toLowerCase() === mStr.toLowerCase());
                    if (mIdx !== -1) m = String(mIdx + 1).padStart(2, '0');
                    else return null;
                  }

                  const fullY = y.length === 2 ? '20' + y : y;
                  const ts = (timeStr && timeStr !== '-') ? timeStr.replace(/\./g, ':') : '00:00:00';
                  return `${fullY}-${m}-${d}T${ts}.000`;
                };

                if (field === 'in_date' || field === 'in_time') {
                  const dVal = field === 'in_date' ? val : currentInDate;
                  const tVal = field === 'in_time' ? val : currentInTime;
                  (updated as any).in_date_str = dVal;
                  (updated as any).in_time_str = tVal;
                  const newDt = buildDateTime(dVal, tVal);
                  if (newDt) updated.WORK_IN = newDt as any;
                }
                if (field === 'out_date' || field === 'out_time') {
                  const dVal = field === 'out_date' ? val : currentOutDate;
                  const tVal = field === 'out_time' ? val : currentOutTime;
                  (updated as any).out_date_str = dVal;
                  (updated as any).out_time_str = tVal;
                  const newDt = buildDateTime(dVal, tVal);
                  if (newDt) updated.WORK_OUT = newDt as any;
                }

                delete (updated as any).WORK_IN_STR;
                delete (updated as any).WORK_OUT_STR;

                setCorrections(prev => new Map(prev).set(r.DATE_TRANS, updated as AbsensiRecord));
              };

              const safeShifts = Array.isArray(masterShifts) ? masterShifts : [];
              const safeReasons = Array.isArray(masterReasons) ? masterReasons : [];

              return (
                <tr
                  key={r.DATE_TRANS}
                  className={isDraft ? 'row-warning' : (hasCorrection && corrStatus === 'applied' ? 'row-success' : '')}
                >
                  <td>
                    <select
                      className="form-select form-select-sm"
                      value={currentShift}
                      onChange={e => handleInlineChange('shift', e.target.value)}
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
                      type="text"
                      className="form-input form-input-sm"
                      value={currentInDate}
                      onChange={e => handleInlineChange('in_date', e.target.value)}
                      placeholder="dd-MMM-yy"
                      maxLength={11}
                      style={{ width: '85px', fontSize: '11px', textAlign: 'center', padding: '4px' }}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      className="form-input form-input-sm"
                      value={currentInTime}
                      onChange={e => handleInlineChange('in_time', e.target.value)}
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
                      type="text"
                      className="form-input form-input-sm"
                      value={currentOutDate}
                      onChange={e => handleInlineChange('out_date', e.target.value)}
                      placeholder="dd-MMM-yy"
                      maxLength={11}
                      style={{ width: '85px', fontSize: '11px', textAlign: 'center', padding: '4px' }}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      className="form-input form-input-sm"
                      value={currentOutTime}
                      onChange={e => handleInlineChange('out_time', e.target.value)}
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
                      className="form-select form-select-sm"
                      value={currentReason}
                      onChange={e => handleInlineChange('reason', e.target.value)}
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
                      className="form-select form-select-sm"
                      value={currentStatus}
                      onChange={e => handleInlineChange('status', e.target.value)}
                      style={{ width: '100%', fontSize: '11px', padding: '3px 6px' }}
                    >
                      <option value="KERJA">KERJA</option>
                      <option value="LIBUR">LIBUR</option>
                      <option value="O">OFF (O)</option>
                    </select>
                  </td>
                  <td style={{ textAlign: 'center', fontSize: '12px', fontWeight: 600, color: (r.OT1 || 0) > 0 ? 'var(--warning)' : 'var(--text-muted)' }}>
                    {(r.OT1 || 0) > 0 ? r.OT1 : '-'}
                  </td>
                  <td style={{ textAlign: 'center', fontSize: '12px', fontWeight: 600, color: (r.OT2 || 0) > 0 ? 'var(--warning)' : 'var(--text-muted)' }}>
                    {(r.OT2 || 0) > 0 ? r.OT2 : '-'}
                  </td>
                  <td style={{ textAlign: 'center', fontSize: '12px', fontWeight: 600, color: (r.OT3 || 0) > 0 ? 'var(--warning)' : 'var(--text-muted)' }}>
                    {(r.OT3 || 0) > 0 ? r.OT3 : '-'}
                  </td>
                  <td style={{ textAlign: 'center', fontSize: '12px', fontWeight: 600, color: (r.OT4 || 0) > 0 ? 'var(--warning)' : 'var(--text-muted)' }}>
                    {(r.OT4 || 0) > 0 ? r.OT4 : '-'}
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
