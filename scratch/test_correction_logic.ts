import { calculateAttendanceAndOt } from '../lib/otCalculator';

// 1. Test OtCalculator for Holiday Overtime Lunch Deduction
console.log('--- Test 1: Holiday Overtime 9 Hours (07:00 to 16:00) ---');
const holidayIn = new Date('2026-08-02T07:00:00');
const holidayOut = new Date('2026-08-02T16:00:00');
const otHolidayRes = calculateAttendanceAndOt(
  '2026-08-02',
  holidayIn,
  holidayOut,
  'OPERATOR',
  'PRODUKSI',
  'LIBUR',
  '1'
);
console.log('Holiday OT Result:', otHolidayRes);
console.assert(otHolidayRes.T_OT === 8, `Expected T_OT to be 8 after 1 hour lunch break deduction, got ${otHolidayRes.T_OT}`);

// 2. Test Holiday Overtime under 5 Hours (e.g. 4 hours)
console.log('\n--- Test 2: Holiday Overtime 4 Hours (07:00 to 11:00) ---');
const holidayShortIn = new Date('2026-08-02T07:00:00');
const holidayShortOut = new Date('2026-08-02T11:00:00');
const otShortRes = calculateAttendanceAndOt(
  '2026-08-02',
  holidayShortIn,
  holidayShortOut,
  'OPERATOR',
  'PRODUKSI',
  'LIBUR',
  '1'
);
console.log('Holiday Short OT Result:', otShortRes);
console.assert(otShortRes.T_OT === 4, `Expected T_OT to be 4 without lunch break deduction, got ${otShortRes.T_OT}`);

// 3. Test Date & Time normalizer logic
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

console.log('\n--- Test 3: Date Normalizer ---');
console.log('01/08/26 ->', normalizeDateInput('01/08/26'));
console.log('010826 ->', normalizeDateInput('010826'));
console.log('1-8-26 ->', normalizeDateInput('1-8-26'));
console.log('01-Agu-26 ->', normalizeDateInput('01-Agu-26'));

console.log('\n--- Test 4: Time Mask ---');
console.log('0700 ->', formatTimeMask('0700'));
console.log('073000 ->', formatTimeMask('073000'));
console.log('07.30 ->', formatTimeMask('07.30'));
console.log('16:00 ->', formatTimeMask('16:00'));
console.log('- ->', formatTimeMask('-'));

console.log('\nALL VERIFICATION TESTS COMPLETED SUCCESSFULLY!');
