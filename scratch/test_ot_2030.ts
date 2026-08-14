import { calculateAttendanceAndOt } from '../lib/otCalculator';
const res = calculateAttendanceAndOt('2026-07-06', new Date('2026-07-06T06:55:38'), new Date('2026-07-06T20:30:00'), 'UMUM', '', 'KERJA', null);
console.log(res);
