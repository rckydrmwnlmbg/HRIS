const { calculateAttendanceAndOt } = require('../lib/otCalculator.ts');

const workInDate = '2026-07-06T06:56:00.000+07:00';
const workIn = new Date(workInDate);
const dateTrans = '2026-07-06';
const empJobDesc = 'UMUM';
const empSecDesc = '';
const statusHari = 'KERJA';
const shift = null;

const outTimes = ['17:00', '18:00', '19:00', '20:30', '21:00', '21:05', '22:00', '23:00', '24:00', '01:00'];

console.log("Simulasi OTCalculator Karyawan UMUM, JAM MASUK: 06:56 WIB");
console.log("Asumsi JAM PULANG STANDAR: 16:00 WIB\n");
console.log("Pulang | T_OT | OT_1 | OT_2 | OT_3 | OT_4");
console.log("-----------------------------------------");

outTimes.forEach(t => {
  let h = parseInt(t.split(':')[0]);
  let outStr = "2026-07-06T" + (h === 24 ? '00:00:00' : t + (t.length > 5 ? '' : ':00')) + ".000+07:00";
  if (t === '21:05') outStr = "2026-07-06T21:05:00.000+07:00";
  let workOut = new Date(outStr);
  if (h === 24 || h === 1) {
    workOut = new Date(workOut.getTime() + 24 * 60 * 60 * 1000);
  }
  
  const res = calculateAttendanceAndOt(dateTrans, workIn, workOut, empJobDesc, empSecDesc, statusHari, shift);
  
  console.log(t.padEnd(6, ' ') + " | " + String(res.T_OT).padEnd(4, ' ') + " | " + String(res.OT_1).padEnd(4, ' ') + " | " + String(res.OT_2).padEnd(4, ' ') + " | " + String(res.OT_3).padEnd(4, ' ') + " | " + String(res.OT_4).padEnd(4, ' '));
});
