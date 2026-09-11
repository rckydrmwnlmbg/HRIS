const parseCorrectEpoch = (val) => {
  if (!val) return null;
  if (val instanceof Date) {
    return Number.isNaN(val.getTime()) ? null : val;
  }
  if (typeof val !== 'string') return null;
  const trimmed = val.trim();
  if (!trimmed || trimmed === '-' || trimmed === 'null' || trimmed === 'undefined') return null;

  let date;
  if (trimmed.endsWith('Z') || /[+-]\d{2}(:\d{2})?$/.test(trimmed)) {
    date = new Date(trimmed);
  } else {
    const isoStr = trimmed.includes(' ') ? trimmed.replace(' ', 'T') : trimmed;
    date = new Date(isoStr + '+07:00');
  }

  return Number.isNaN(date.getTime()) ? null : date;
};

const toWibString = (dateObj) => {
  if (!dateObj || Number.isNaN(dateObj.getTime())) return null;
  const wibTime = new Date(dateObj.getTime() + 7 * 60 * 60 * 1000);
  if (Number.isNaN(wibTime.getTime())) return null;
  return wibTime.toISOString().replace(/Z$/, ''); 
};

function distributeOtTiers(otHours, isHoliday) {
  let OT_1 = 0, OT_2 = 0, OT_3 = 0, OT_4 = 0;
  if (otHours <= 0) return { OT_1, OT_2, OT_3, OT_4 };
  if (!isHoliday) {
    if (otHours > 0) {
      OT_1 = Math.min(1, otHours);
      if (otHours > 1) {
        OT_2 = otHours - 1;
      }
    }
  } else {
    if (otHours <= 8) {
      OT_2 = otHours;
    } else if (otHours > 8) {
      OT_2 = 8;
      const sisa = otHours - 8;
      if (sisa <= 1) {
        OT_3 = sisa;
      } else {
        OT_3 = 1;
        OT_4 = sisa - 1;
      }
    }
  }
  return { OT_1, OT_2, OT_3, OT_4 };
}

function calculateAttendanceAndOt(
  dateTrans,
  workIn,
  workOut,
  empJobDesc,
  empSecDesc,
  inputStatusHari,
  inputShift,
  isHolidayOverride
) {
  const transactionDate = new Date(`${dateTrans}T00:00:00`);
  let isHoliday = isHolidayOverride !== undefined ? isHolidayOverride : false;
  let finalStatusHari = isHoliday ? 'LIBUR' : 'KERJA';

  if (!workIn || !workOut) {
    return { JAM_KERJA: 0, OT_1: 0, OT_2: 0, OT_3: 0, OT_4: 0, T_OT: 0, STATUS_HARI: finalStatusHari };
  }

  let JAM_KERJA = 8;
  let totalOtHours = 0;

  let effectiveOut = workOut;
  if (workOut.getTime() < workIn.getTime()) {
    effectiveOut = new Date(workOut.getTime() + 24 * 60 * 60 * 1000);
  }

  const scheduleOut = new Date(
    workIn.getFullYear(),
    workIn.getMonth(),
    workIn.getDate(),
    16, 0, 0
  );

  console.log('workIn:', workIn.toISOString(), 'local:', workIn.toString());
  console.log('effectiveOut:', effectiveOut.toISOString(), 'local:', effectiveOut.toString());
  console.log('scheduleOut:', scheduleOut.toISOString(), 'local:', scheduleOut.toString());
  console.log('effectiveOut > scheduleOut?', effectiveOut.getTime() > scheduleOut.getTime());

  if (effectiveOut.getTime() > scheduleOut.getTime()) {
    const diffMinutes = (effectiveOut.getTime() - scheduleOut.getTime()) / 60000;
    const breakMinutes = diffMinutes >= 210 ? 30 : 0;
    console.log('diffMinutes:', diffMinutes, 'breakMinutes:', breakMinutes);
    totalOtHours = Math.max(0, Math.floor(((diffMinutes - breakMinutes) / 60) * 2) / 2);
  }

  const { OT_1, OT_2, OT_3, OT_4 } = distributeOtTiers(totalOtHours, isHoliday);
  const T_OT = OT_1 + OT_2 + OT_3 + OT_4;

  return { JAM_KERJA, OT_1, OT_2, OT_3, OT_4, T_OT, STATUS_HARI: finalStatusHari };
}

// Case A: Frontend sends local ISO without Z
console.log('--- CASE A: Frontend sends 2026-09-09T06:56:20.000 ---');
const winA = parseCorrectEpoch("2026-09-09T06:56:20.000");
const woutA = parseCorrectEpoch("2026-09-09T22:08:46.000");
console.log('Result A:', calculateAttendanceAndOt('2026-09-09', winA, woutA, '', '', 'KERJA', '1', false));

// Case B: Frontend sends UTC string with Z (e.g. from API directly)
console.log('\n--- CASE B: Frontend sends with Z 2026-09-09T06:56:20.000Z ---');
const winB = parseCorrectEpoch("2026-09-09T06:56:20.000Z");
const woutB = parseCorrectEpoch("2026-09-09T22:08:46.000Z");
console.log('Result B:', calculateAttendanceAndOt('2026-09-09', winB, woutB, '', '', 'KERJA', '1', false));
