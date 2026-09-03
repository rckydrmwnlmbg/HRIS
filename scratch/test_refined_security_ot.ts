import { SECURITY_SHIFTS, getSecurityShiftByCode } from '../lib/securitySchedule';

function calculateSecurityOtHoursRefined(workIn: Date, workOut: Date, shiftCode: string | null): number {
  const shift = getSecurityShiftByCode(shiftCode);
  if (!shift) return 0;

  // Tentukan jam selesai shift standar
  const shiftEndMinutes = shift.endMinutes; // e.g. 2S = 20*60 + 30 = 1230 (20:30)
  
  // Hitung menit workOut relatif terhadap hari masuk
  let outMinutes = workOut.getHours() * 60 + workOut.getMinutes() + (workOut.getSeconds() / 60);
  
  // Jika lintas hari (workOut tanggal berikutnya atau outMinutes < inMinutes)
  const inMinutes = workIn.getHours() * 60 + workIn.getMinutes();
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

console.log('--- TEST REFINED SECURITY OT ---');

// Case 1: 03-Aug (Masuk 11:21:43, Pulang 20:32:55, Shift 2S)
const d1In = new Date('2026-08-03T11:21:43');
const d1Out = new Date('2026-08-03T20:32:55');
console.log('Case 1 (20:32:55 - Shift 2S):', calculateSecurityOtHoursRefined(d1In, d1Out, '2S'), 'jam (Expected: 0)');

// Case 2: Pulang 21:02 (lewat 32 menit dari 20:30)
const d2Out = new Date('2026-08-03T21:02:00');
console.log('Case 2 (21:02:00 - Shift 2S):', calculateSecurityOtHoursRefined(d1In, d2Out, '2S'), 'jam (Expected: 0.5)');

// Case 3: Pulang 21:35 (lewat 65 menit dari 20:30)
const d3Out = new Date('2026-08-03T21:35:00');
console.log('Case 3 (21:35:00 - Shift 2S):', calculateSecurityOtHoursRefined(d1In, d3Out, '2S'), 'jam (Expected: 1.0)');

// Case 4: Shift 4S (Masuk 22:45, Pulang 08:02 - jadwal selesai 08:00)
const d4In = new Date('2026-08-03T22:45:00');
const d4Out = new Date('2026-08-04T08:02:00');
console.log('Case 4 (08:02:00 - Shift 4S):', calculateSecurityOtHoursRefined(d4In, d4Out, '4S'), 'jam (Expected: 0)');

// Case 5: Shift 4S (Masuk 22:45, Pulang 09:35 - jadwal selesai 08:00)
const d5Out = new Date('2026-08-04T09:35:00');
console.log('Case 5 (09:35:00 - Shift 4S):', calculateSecurityOtHoursRefined(d4In, d5Out, '4S'), 'jam (Expected: 1.5)');
