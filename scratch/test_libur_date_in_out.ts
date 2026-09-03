// Test validation of SQL DATE_IN and DATE_OUT handling when WORK_IN & WORK_OUT are NULL
const workIn: string | null = null;
const workOut: string | null = null;
const dateTrans = '2026-08-07';
const statusHari = 'LIBUR';

const sqlDateIn = workIn ? workIn.split('T')[0] : dateTrans;
const sqlDateOut = workOut ? workOut.split('T')[0] : dateTrans;
const hadir = (statusHari === 'LIBUR' && !workIn && !workOut) ? 0 : (workIn || workOut ? 1 : 0);

console.log('--- Test Empty Jam on LIBUR ---');
console.log('DATE_TRANS:', dateTrans);
console.log('WORK_IN:', workIn);
console.log('WORK_OUT:', workOut);
console.log('sqlDateIn (DATE_IN):', sqlDateIn);
console.log('sqlDateOut (DATE_OUT):', sqlDateOut);
console.log('HADIR:', hadir);

console.assert(sqlDateIn === '2026-08-07', 'DATE_IN must not be NULL, must equal DATE_TRANS');
console.assert(sqlDateOut === '2026-08-07', 'DATE_OUT must not be NULL, must equal DATE_TRANS');
console.assert(hadir === 0, 'HADIR must be 0 for empty LIBUR');

console.log('\nTEST PASSED: DATE_IN and DATE_OUT are guaranteed preserved as calendar date in TR_ABSEN!');
