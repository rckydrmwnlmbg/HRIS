export type SecurityShiftCode = '1' | '2S' | '3S' | '4S';

export type SecurityShift = {
  code: SecurityShiftCode;
  startMinutes: number;
  endMinutes: number;
  standardHours: number;
};

export const SECURITY_SHIFTS: SecurityShift[] = [
  { code: '1', startMinutes: 7 * 60, endMinutes: 16 * 60, standardHours: 8 },
  { code: '2S', startMinutes: 11 * 60 + 30, endMinutes: 20 * 60 + 30, standardHours: 8 },
  { code: '3S', startMinutes: 15 * 60, endMinutes: 24 * 60, standardHours: 8 },
  { code: '4S', startMinutes: 23 * 60, endMinutes: 32 * 60, standardHours: 8 },
];

const minutesSinceMidnight = (value: string | Date | null | undefined): number | null => {
  if (!value) return null;
  const match = String(value instanceof Date ? value.toTimeString() : value).match(/(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour >= 0 && hour < 24 && minute >= 0 && minute < 60 ? hour * 60 + minute : null;
};

export function detectSecurityShift(workIn: string | Date | null | undefined, workOut?: string | Date | null): SecurityShift | null {
  const inMinutes = minutesSinceMidnight(workIn);
  if (inMinutes === null) return null;
  const outMinutesRaw = minutesSinceMidnight(workOut);
  let best: { shift: SecurityShift; score: number } | null = null;

  for (const shift of SECURITY_SHIFTS) {
    const startDistance = Math.abs(inMinutes - shift.startMinutes);
    const normalizedOut = outMinutesRaw === null ? null : outMinutesRaw < shift.startMinutes ? outMinutesRaw + 1440 : outMinutesRaw;
    const outDistance = normalizedOut === null ? 0 : Math.abs(normalizedOut - shift.endMinutes);
    const score = startDistance + outDistance * 0.25;
    if (startDistance <= 60 && (!best || score < best.score)) best = { shift, score };
  }

  return best?.shift || null;
}

export function getSecurityShiftByCode(code: string | null | undefined): SecurityShift | null {
  return SECURITY_SHIFTS.find((shift) => shift.code === String(code || '').trim().toUpperCase()) || null;
}

export function getDurationMinutes(workIn: Date, workOut: Date): number {
  let end = workOut.getTime();
  while (end <= workIn.getTime()) end += 24 * 60 * 60 * 1000;
  return Math.max(0, (end - workIn.getTime()) / 60000);
}

export function isValidAttendancePair(
  dateTrans: string,
  workIn: Date | null,
  workOut: Date | null,
  securityShift: SecurityShift | null = null,
): boolean {
  if (!workIn || !workOut || Number.isNaN(workIn.getTime()) || Number.isNaN(workOut.getTime())) return false;
  const transactionDate = new Date(`${dateTrans}T00:00:00`);
  if (Number.isNaN(transactionDate.getTime())) return false;
  if (workIn.getFullYear() !== transactionDate.getFullYear() || workIn.getMonth() !== transactionDate.getMonth() || workIn.getDate() !== transactionDate.getDate()) return false;

  const sameDate = workOut.getFullYear() === workIn.getFullYear() && workOut.getMonth() === workIn.getMonth() && workOut.getDate() === workIn.getDate();
  const nextDate = workOut.getTime() >= workIn.getTime() && getDurationMinutes(workIn, workOut) <= 16 * 60;
  if (sameDate && workOut.getTime() >= workIn.getTime()) return true;
  if (!sameDate && nextDate && getDurationMinutes(workIn, workOut) <= 16 * 60) return true;

  const inMinutes = minutesSinceMidnight(workIn) ?? -1;
  const outMinutes = minutesSinceMidnight(workOut) ?? -1;
  const inferredOvernightMinutes = outMinutes >= 0 && inMinutes >= 0 ? outMinutes + 1440 - inMinutes : 0;
  // If sameDate but workOut < workIn, assume they worked past midnight. Tolerate up to 22 hours.
  return sameDate && workOut.getTime() < workIn.getTime() && inferredOvernightMinutes > 0 && inferredOvernightMinutes <= 22 * 60;
}

/**
 * Menghitung jam lembur Security secara akurat berdasarkan jadwal selesai shift.
 * Datang lebih awal sebelum jam shift dimulai TIDAK dihitung sebagai lembur.
 * Lembur hanya dihitung jika jam pulang aktual melebihi jam selesai shift (dengan toleransi minimal 30 menit).
 */
export function calculateSecurityOtHours(workIn: Date, workOut: Date, shift: SecurityShift | null): number {
  if (!shift) {
    const durationMinutes = getDurationMinutes(workIn, workOut);
    const paidMinutes = Math.max(0, durationMinutes - 60);
    return Math.max(0, Math.floor((paidMinutes / 60) * 2) / 2);
  }

  // Tentukan jam selesai shift standar (misal: 2S = 20:30 -> 1230 menit, 3S = 24:00 -> 1440 menit, 4S = 08:00 -> 1920 menit)
  const shiftEndMinutes = shift.endMinutes;
  
  // Hitung menit workOut relatif terhadap hari masuk
  let outMinutes = workOut.getHours() * 60 + workOut.getMinutes() + (workOut.getSeconds() / 60);
  const inMinutes = workIn.getHours() * 60 + workIn.getMinutes();

  // Jika lintas hari (workOut tanggal berikutnya atau outMinutes < inMinutes)
  if (workOut.getDate() !== workIn.getDate() || outMinutes < inMinutes) {
    outMinutes += 1440;
  }

  // Lembur dihitung HANYA jika pulang melebihi jam selesai shift
  if (outMinutes > shiftEndMinutes) {
    const otMinutes = outMinutes - shiftEndMinutes;
    // Minimal 30 menit untuk dihitung 0.5 jam lembur
    if (otMinutes >= 30) {
      return Math.floor((otMinutes / 60) * 2) / 2;
    }
  }

  return 0;
}

export function isSecurityJob(jobDesc?: string | null, sectionDesc?: string | null, shift?: string | null): boolean {
  const shiftStr = String(shift || '').trim().toUpperCase();
  if (['2S', '3S', '4S', '1S'].includes(shiftStr) || shiftStr.endsWith('S')) {
    return true;
  }
  const value = `${jobDesc || ''} ${sectionDesc || ''}`.toUpperCase();
  return value.includes('SECURITY') || value.includes('SATPAM') || value.includes('SEC');
}
