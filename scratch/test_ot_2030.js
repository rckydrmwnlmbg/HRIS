function distributeOtTiers(otHours, isHoliday) {
  let OT_1 = 0, OT_2 = 0, OT_3 = 0, OT_4 = 0;
  if (otHours <= 0) return { OT_1, OT_2, OT_3, OT_4 };
  if (!isHoliday) {
    if (otHours > 0) {
      OT_1 = Math.min(1, otHours); 
      if (otHours > 1) OT_2 = otHours - 1; 
    }
  } else {
    if (otHours <= 8) OT_2 = otHours; 
    else if (otHours > 8) {
      OT_2 = 8;
      const sisa = otHours - 8;
      if (sisa <= 1) OT_3 = sisa; 
      else { OT_3 = 1; OT_4 = sisa - 1; }
    }
  }
  return { OT_1, OT_2, OT_3, OT_4 };
}

function calculateAttendanceAndOt(workIn, workOut, isHoliday) {
  let JAM_KERJA = null;
  let totalOtHours = 0;
  const workedMinutes = (workOut.getTime() - workIn.getTime()) / 60000;
  
  if (isHoliday) {
    JAM_KERJA = 0;
    totalOtHours = Math.max(0, Math.floor((workedMinutes / 60) * 2) / 2);
  } else {
    JAM_KERJA = 8; 
    let effectiveOut = workOut;
    if (workOut.getTime() < workIn.getTime()) {
      effectiveOut = new Date(workOut.getTime() + 24 * 60 * 60 * 1000);
    }
    const scheduleOut = new Date(workIn);
    scheduleOut.setHours(16, 0, 0, 0);
    
    if (effectiveOut.getTime() > scheduleOut.getTime()) {
      const diffMinutes = (effectiveOut.getTime() - scheduleOut.getTime()) / 60000;
      const breakMinutes = diffMinutes >= 210 ? 30 : 0; 
      totalOtHours = Math.max(0, Math.floor(((diffMinutes - breakMinutes) / 60) * 2) / 2);
    }
  }
  const { OT_1, OT_2, OT_3, OT_4 } = distributeOtTiers(totalOtHours, isHoliday);
  return { JAM_KERJA, OT_1, OT_2, OT_3, OT_4, T_OT: OT_1+OT_2+OT_3+OT_4 };
}

const workIn = new Date('2026-07-06T06:55:00.000Z');
const workOut = new Date('2026-07-06T20:30:00.000Z');
console.log('Test 1 (Z):', calculateAttendanceAndOt(workIn, workOut, false));

const workInLocal = new Date('2026-07-05T23:55:00.000Z'); // 06:55 local
const workOutLocal = new Date('2026-07-06T20:30:00'); // 20:30 local
console.log('Test 2 (Mixed):', calculateAttendanceAndOt(workInLocal, workOutLocal, false));
