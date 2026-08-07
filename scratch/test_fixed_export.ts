function calculateDayOT(row: any) {
  const status = row.STATUS_HARI;
  const rg = row.REASON_GROUP;
  
  const dObj = new Date(row.dateStr + 'T00:00:00');
  const dayOfWeek = dObj.getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const isHoliday = status === 'LIBUR' || status === 'OFF' || status === 'H';

  let isKerjaNormal = !isWeekend && !isHoliday && (status === 'KERJA' || status === 'O' || rg === 'O');
  let isCuti = status === 'CUTI' || status === 'C' || status === 'H' || status === 'HAID' || rg === 'C' || rg === 'H';

  let kerjaHours = 0;
  let otHours = 0;

  const dbOt = Number(row.dailyOt || 0);

  let computedOt = 0;
  if (row.WORK_OUT) {
    let schOutHour = 16;
    let schOutMin = 0;
    if (row.JAM_PULANG) {
      const pDate = new Date(row.JAM_PULANG);
      if (!isNaN(pDate.getTime())) {
        schOutHour = pDate.getHours();
        schOutMin = pDate.getMinutes();
      }
    }
    const outDate = new Date(row.WORK_OUT);
    if (!isNaN(outDate.getTime())) {
      const outMinutesOfDay = outDate.getHours() * 60 + outDate.getMinutes();
      const schMinutesOfDay = schOutHour * 60 + schOutMin;
      const diffMin = outMinutesOfDay - schMinutesOfDay;
      if (diffMin >= 50) {
        computedOt = Math.floor((diffMin + 10) / 60);
      }
    }
  }

  if (isWeekend || isHoliday) {
    kerjaHours = 0;
    if (dbOt > 0) {
      otHours = dbOt;
    } else if (row.WORK_IN && row.WORK_OUT && new Date(row.WORK_OUT) > new Date(row.WORK_IN)) {
      const diffMinutes = (new Date(row.WORK_OUT).getTime() - new Date(row.WORK_IN).getTime()) / 60000;
      const floorH = Math.floor(diffMinutes / 60);
      const remMin = diffMinutes % 60;
      otHours = remMin < 30 ? floorH : (floorH + 0.5);
    } else if (row.JAM_KERJA && !isNaN(Number(row.JAM_KERJA))) {
      otHours = Number(row.JAM_KERJA);
    }
  } else {
    if (isCuti) {
      kerjaHours = 8;
      otHours = 0;
    } else if (isKerjaNormal || (row.WORK_IN && row.WORK_OUT)) {
      kerjaHours = 8;
      otHours = dbOt > 0 ? dbOt : computedOt;
    } else {
      kerjaHours = 0;
      otHours = 0;
    }
  }

  return { kerjaHours, otHours };
}

console.log('=== TEST PERHITUNGAN BARU OT ANALYSIS ===');

// Kasus 1: Syamsiah tanggal 03-08-2026 (Pulang 17:05, lembur 1 jam)
const case1 = calculateDayOT({
  dateStr: '2026-08-03',
  STATUS_HARI: 'KERJA',
  WORK_IN: '2026-08-03T06:58:00',
  WORK_OUT: '2026-08-03T17:05:00',
  JAM_PULANG: '1900-01-01T16:00:00',
  dailyOt: 0
});
console.log('Kasus 1 (03-08-2026, Pulang 17:05):', case1);

// Kasus 2: Syamsiah tanggal 04-08-2026 (Pulang 20:06, lembur 4 jam)
const case2 = calculateDayOT({
  dateStr: '2026-08-04',
  STATUS_HARI: 'KERJA',
  WORK_IN: '2026-08-04T06:58:00',
  WORK_OUT: '2026-08-04T20:06:00',
  JAM_PULANG: '1900-01-01T16:00:00',
  dailyOt: 0
});
console.log('Kasus 2 (04-08-2026, Pulang 20:06):', case2);

// Kasus 3: Karyawan Lembur sampai 20:30 (Pulang 20:30, lembur 4 jam)
const case3 = calculateDayOT({
  dateStr: '2026-08-04',
  STATUS_HARI: 'KERJA',
  WORK_IN: '2026-08-04T06:50:00',
  WORK_OUT: '2026-08-04T20:30:00',
  JAM_PULANG: '1900-01-01T16:00:00',
  dailyOt: 0
});
console.log('Kasus 3 (Pulang 20:30):', case3);

// Kasus 4: Hari Libur Minggu (07:00 - 15:00, lembur 8 jam)
const case4 = calculateDayOT({
  dateStr: '2026-08-02', // Minggu
  STATUS_HARI: 'LIBUR',
  WORK_IN: '2026-08-02T07:00:00',
  WORK_OUT: '2026-08-02T15:00:00',
  dailyOt: 0
});
console.log('Kasus 4 (Minggu Libur 8 Jam):', case4);
