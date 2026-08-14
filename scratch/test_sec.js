const { calculateAttendanceAndOt } = require('../lib/otCalculator.ts');

const testCases = [
  { inTime: '2026-07-01T09:55:38.000+07:00', outTime: '2026-07-01T20:31:52.000+07:00' },
  { inTime: '2026-07-02T06:52:05.000+07:00', outTime: '2026-07-02T23:02:11.000+07:00' },
  { inTime: '2026-07-03T06:51:05.000+07:00', outTime: '2026-07-03T21:04:49.000+07:00' },
  { inTime: '2026-07-06T06:56:53.000+07:00', outTime: '2026-07-06T21:03:11.000+07:00' }
];

console.log("Simulasi SECURITY dengan Shift '1'");
testCases.forEach(tc => {
  const wIn = new Date(tc.inTime);
  const wOut = new Date(tc.outTime);
  const dateTrans = tc.inTime.substring(0, 10);
  const res = calculateAttendanceAndOt(dateTrans, wIn, wOut, 'ANGGOTA', 'SECURITY', 'KERJA', '1');
  console.log("In: " + tc.inTime + " | Out: " + tc.outTime + " | T_OT: " + res.T_OT + " | OT_1: " + res.OT_1 + " | OT_2: " + res.OT_2);
});

console.log("\\nSimulasi UMUM dengan Shift '1'");
testCases.forEach(tc => {
  const wIn = new Date(tc.inTime);
  const wOut = new Date(tc.outTime);
  const dateTrans = tc.inTime.substring(0, 10);
  const res = calculateAttendanceAndOt(dateTrans, wIn, wOut, 'UMUM', '', 'KERJA', '1');
  console.log("In: " + tc.inTime + " | Out: " + tc.outTime + " | T_OT: " + res.T_OT + " | OT_1: " + res.OT_1 + " | OT_2: " + res.OT_2);
});
