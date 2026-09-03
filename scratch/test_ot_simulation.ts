import { calculateAttendanceAndOt } from '../lib/otCalculator';
import { getSecurityShiftByCode, detectSecurityShift, calculateSecurityOtHours, isSecurityJob } from '../lib/securitySchedule';

const dateTrans = '2026-08-03';
const workIn = new Date('2026-08-03T11:21:43+07:00');
const workOut = new Date('2026-08-03T20:32:55+07:00');

console.log('--- TEST 1: isSecurity = true (Job: SECURITY) ---');
const res1 = calculateAttendanceAndOt(
  dateTrans,
  workIn,
  workOut,
  'SECURITY',
  'SECURITY',
  'KERJA',
  '2S'
);
console.log('Result 1 (Security with 2S):', res1);

console.log('\n--- TEST 2: isSecurity = false (Job: STAFF) with Shift 2S ---');
const res2 = calculateAttendanceAndOt(
  dateTrans,
  workIn,
  workOut,
  'STAFF',
  'UMUM',
  'KERJA',
  '2S'
);
console.log('Result 2 (Staff with 2S):', res2);

console.log('\n--- TEST 3: Direct calculateSecurityOtHours ---');
const shift2S = getSecurityShiftByCode('2S');
console.log('shift2S:', shift2S);
const otDirect = calculateSecurityOtHours(workIn, workOut, shift2S);
console.log('otDirect:', otDirect);
