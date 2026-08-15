import { calculateAttendanceAndOt } from '../lib/otCalculator';

function formatLocalSqlDatetime(d: Date | string | null | undefined): string {
  if (!d) return 'NULL';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(date.getTime())) return 'NULL';
  const pad = (n: number) => String(n).padStart(2, '0');
  const YYYY = date.getFullYear();
  const MM = pad(date.getMonth() + 1);
  const DD = pad(date.getDate());
  const hh = pad(date.getHours());
  const mm = pad(date.getMinutes());
  const ss = pad(date.getSeconds());
  return `'${YYYY}-${MM}-${DD} ${hh}:${mm}:${ss}'`;
}

// Test sample date from DataSolution: 2026-08-07 19:07:05
const sampleDate = new Date('2026-08-07T19:07:05');
console.log('Sample Raw Date:', sampleDate);
console.log('Old ISO string (BUGGY):', sampleDate.toISOString().replace('T', ' ').slice(0, 19));
console.log('New Local SQL string (CORRECT):', formatLocalSqlDatetime(sampleDate));

// Test OT calculation on 07-Aug
const wIn = new Date('2026-08-07T06:57:37');
const wOut = new Date('2026-08-07T19:07:05');
const ot = calculateAttendanceAndOt('2026-08-07', wIn, wOut, 'UMUM', '', 'KERJA', '1');
console.log('OT Calculation result for 07-Aug (out 19:07):', ot);

// Test OT calculation on 10-Aug (out 18:35:40)
const ot10 = calculateAttendanceAndOt('2026-08-10', new Date('2026-08-10T06:54:52'), new Date('2026-08-10T18:35:40'), 'UMUM', '', 'KERJA', '1');
console.log('OT Calculation result for 10-Aug (out 18:35):', ot10);
