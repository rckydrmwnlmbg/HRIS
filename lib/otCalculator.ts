import { isSecurityJob, getDurationMinutes, detectSecurityShift, getSecurityShiftByCode, calculateSecurityOtHours } from './securitySchedule';

/**
 * OtCalculationResult
 */
export interface OtCalculationResult {
  JAM_KERJA: number | null;
  OT_1: number;
  OT_2: number;
  OT_3: number;
  OT_4: number;
  T_OT: number;
  STATUS_HARI: string;
}

/**
 * Split overtime hours into OT_1, OT_2, OT_3, OT_4 based on standard rules (Depnaker-like).
 * @param otHours Total overtime hours
 * @param isHoliday Boolean indicating if it's a holiday / weekend
 */
function distributeOtTiers(otHours: number, isHoliday: boolean) {
  let OT_1 = 0, OT_2 = 0, OT_3 = 0, OT_4 = 0;

  if (otHours <= 0) {
    return { OT_1, OT_2, OT_3, OT_4 };
  }

  // Jika hari kerja biasa
  if (!isHoliday) {
    if (otHours > 0) {
      OT_1 = Math.min(1, otHours); // 1 jam pertama (tier 1)
      if (otHours > 1) {
        OT_2 = otHours - 1; // Sisanya (tier 2)
      }
    }
  } 
  // Jika hari libur / akhir pekan
  else {
    if (otHours <= 8) {
      OT_2 = otHours; // 8 jam pertama masuk tier 2
    } else if (otHours > 8) {
      OT_2 = 8;
      const sisa = otHours - 8;
      if (sisa <= 1) {
        OT_3 = sisa; // Jam ke-9 masuk tier 3
      } else {
        OT_3 = 1;
        OT_4 = sisa - 1; // Jam ke-10 ke atas masuk tier 4
      }
    }
  }

  return { OT_1, OT_2, OT_3, OT_4 };
}

/**
 * Menghitung Total OT Value berdasarkan tier (pengali)
 */
function calculateTotOt(o1: number, o2: number, o3: number, o4: number) {
  return (o1 * 1.5) + (o2 * 2.0) + (o3 * 3.0) + (o4 * 4.0);
}

/**
 * Fungsi utama untuk menghitung ulang jam kerja, OT, dan status hari pada saat koreksi.
 * 
 * @param dateTrans Tanggal transaksi (YYYY-MM-DD)
 * @param workIn Timestamp jam masuk
 * @param workOut Timestamp jam keluar
 * @param empJobDesc Job description karyawan
 * @param empSecDesc Security description
 * @param inputStatusHari Status hari dari input atau DB
 * @param inputShift Shift (jika ada, prioritas untuk Security)
 */
export function calculateAttendanceAndOt(
  dateTrans: string,
  workIn: Date | null,
  workOut: Date | null,
  empJobDesc: string,
  empSecDesc: string,
  inputStatusHari: string,
  inputShift: string | null
): OtCalculationResult {

  const isSecurity = isSecurityJob(empJobDesc, empSecDesc);
  const transactionDate = new Date(`${dateTrans}T00:00:00`);
  const dayOfWeek = transactionDate.getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

  let finalStatusHari = (inputStatusHari || '').trim().toUpperCase();
  let JAM_KERJA: number | null = null;
  let totalOtHours = 0;

  // 1. Perbaiki Bug Weekend Security (Override STATUS_HARI)
  if (isSecurity && isWeekend && (finalStatusHari === 'LIBUR' || finalStatusHari === 'OFF' || finalStatusHari === 'L' || finalStatusHari === '')) {
    finalStatusHari = 'KERJA';
  }

  const isHoliday = finalStatusHari === 'LIBUR' || finalStatusHari === 'OFF' || finalStatusHari === 'L' || finalStatusHari === 'H';
  const isSecurityHoliday = isSecurity && isHoliday; // Hanya berlaku jika benar-benar libur nasional / cuti

  // 2. Jika Fingerprint Kosong (TIDAK ADA DATA)
  if (!workIn || !workOut) {
    return {
      JAM_KERJA: isHoliday ? 0 : null,
      OT_1: 0, OT_2: 0, OT_3: 0, OT_4: 0, T_OT: 0,
      STATUS_HARI: finalStatusHari
    };
  }

  // 3. Kalkulasi Durasi
  const workedMinutes = getDurationMinutes(workIn, workOut);

  // 4. Kalkulasi Jam Kerja & Lembur berdasarkan Tipe Karyawan
  if (isSecurity) {
    // --- SECURITY ---
    const secShift = inputShift ? getSecurityShiftByCode(inputShift) : detectSecurityShift(workIn, workOut);
    
    if (isSecurityHoliday) {
      JAM_KERJA = 0;
      totalOtHours = Math.max(0, Math.floor(((workedMinutes - 60) / 60) * 2) / 2); // Pengurangan 1 jam istirahat
    } else {
      JAM_KERJA = secShift ? secShift.standardHours : Math.max(0, (workedMinutes / 60) - 1); // 1 jam istirahat
      
      // Hitung Lembur (OT)
      if (secShift) {
        totalOtHours = calculateSecurityOtHours(workIn, workOut, secShift);
      } else {
        totalOtHours = Math.max(0, Math.floor(((workedMinutes - 60) / 60) * 2) / 2 - JAM_KERJA);
      }
    }
  } else {
    // --- KARYAWAN UMUM (HARIAN & ALL-IN) ---
    if (isHoliday) {
      JAM_KERJA = 0;
      totalOtHours = Math.max(0, Math.floor((workedMinutes / 60) * 2) / 2);
    } else {
      JAM_KERJA = 8; // Default jam kerja kantoran
      
      // Asumsi pulang standar jam 16:00
      const scheduleOut = new Date(workOut);
      scheduleOut.setHours(16, 0, 0, 0);
      
      if (workOut.getTime() > scheduleOut.getTime()) {
        const diffMinutes = (workOut.getTime() - scheduleOut.getTime()) / 60000;
        const breakMinutes = diffMinutes >= 210 ? 30 : 0; // Break 30 menit jika lembur > 3.5 jam
        totalOtHours = Math.max(0, Math.floor(((diffMinutes - breakMinutes) / 60) * 2) / 2);
      }
    }
  }

  // 5. Distribusi Total Jam Lembur ke Tier OT1..OT4
  const { OT_1, OT_2, OT_3, OT_4 } = distributeOtTiers(totalOtHours, isHoliday);
  const T_OT = calculateTotOt(OT_1, OT_2, OT_3, OT_4);

  return {
    JAM_KERJA,
    OT_1,
    OT_2,
    OT_3,
    OT_4,
    T_OT,
    STATUS_HARI: finalStatusHari
  };
}
