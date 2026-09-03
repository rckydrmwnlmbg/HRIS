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

// Test User Scenario:
console.log('--- Test User Scenario: Security In 07-Aug-26 14:53:33, Out 08:00:00 ---');
const inDate = '07-Aug-26';
const inTime = '14:53:33';
const outTime = '08:00:00';

const inM = timeToMinutes(inTime);
const outM = timeToMinutes(outTime);
const { isoDate: inIso } = normalizeDateInput(inDate);

console.log('inM:', inM, 'outM:', outM, 'inIso:', inIso);
if (inM !== null && outM !== null && inIso && outM < inM) {
  const nextIso = addDaysToIso(inIso, 1);
  const nextDisplay = formatIsoToDisplay(nextIso);
  const workOut = `${nextIso}T${formatTimeMask(outTime)}.000`;
  console.log('Auto-calculated Out Date Display:', nextDisplay);
  console.log('Auto-calculated WORK_OUT:', workOut);
  console.assert(nextDisplay === '08-Aug-26', `Expected 08-Aug-26, got ${nextDisplay}`);
  console.assert(workOut === '2026-08-08T08:00:00.000', `Expected 2026-08-08T08:00:00.000, got ${workOut}`);
}

console.log('\nOVERNIGHT AUTO DATE TEST PASSED!');
