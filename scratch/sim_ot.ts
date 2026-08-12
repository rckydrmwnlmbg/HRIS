import { calculateAttendanceAndOt } from '../lib/otCalculator';

console.log(calculateAttendanceAndOt(
  '2026-08-10',
  new Date('2026-08-10T06:48:07'), // Masuk 06:48:07
  new Date('2026-08-10T06:48:07'), // Pulang 06:48:07
  'CAD PATTERN',
  '',
  'KERJA',
  null
));

console.log(calculateAttendanceAndOt(
  '2026-08-10',
  new Date('2026-08-10T16:30:00'),
  new Date('2026-08-10T16:30:00'),
  'CAD PATTERN',
  '',
  'KERJA',
  null
));

console.log(calculateAttendanceAndOt(
  '2026-08-10',
  new Date('2026-08-10T07:00:00'),
  new Date('2026-08-10T07:00:00'),
  'CAD PATTERN',
  '',
  'KERJA',
  null
));
