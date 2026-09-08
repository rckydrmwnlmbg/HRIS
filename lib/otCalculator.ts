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
 * Diubah sesuai permintaan: T_OT mengikuti INUS, yaitu murni total jam lembur.
 */
function calculateTotOt(o1: number, o2: number, o3: number, o4: number) {
  return o1 + o2 + o3 + o4;
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
  inputShift: string | null,
  isHolidayOverride?: boolean
): OtCalculationResult {

  const isSecurity = isSecurityJob(empJobDesc, empSecDesc, inputShift);
  const transactionDate = new Date(`${dateTrans}T00:00:00`);
  const dayOfWeek = transactionDate.getDay();

  // STATUS_HARI hanya bernilai 'KERJA' dan 'LIBUR' (standar INUS)
  let rawStatus = (inputStatusHari || '').trim().toUpperCase();
  let finalStatusHari: 'KERJA' | 'LIBUR' = (rawStatus === 'LIBUR' || rawStatus === 'OFF' || rawStatus === 'L' || rawStatus === 'H' || rawStatus === 'O') ? 'LIBUR' : 'KERJA';

  // Penentuan isHoliday:
  // 1. Jika isHolidayOverride ditentukan, gunakan nilai tersebut (true/false) secara eksplisit.
  // 2. Jika tidak ditentukan:
  //    - Jika status eksplisit 'LIBUR', maka isHoliday = true.
  //    - Jika status eksplisit 'KERJA', maka isHoliday = false (menghormati shift normal Security / kerja normal).
  //    - Jika status kosong: untuk non-security Minggu adalah libur, untuk security Minggu adalah kerja.
  let isHoliday: boolean;
  if (isHolidayOverride !== undefined) {
    isHoliday = isHolidayOverride;
  } else if (rawStatus.length > 0) {
    isHoliday = finalStatusHari === 'LIBUR';
  } else {
    isHoliday = isSecurity ? false : (dayOfWeek === 0);
  }

  if (isHoliday) {
    finalStatusHari = 'LIBUR';
  } else {
    finalStatusHari = 'KERJA';
  }

  let JAM_KERJA: number | null = null;
  let totalOtHours = 0;

  // 2. Jika Fingerprint Kosong (TIDAK ADA DATA)
  if (!workIn || !workOut) {
    return {
      JAM_KERJA: 0,
      OT_1: 0, OT_2: 0, OT_3: 0, OT_4: 0, T_OT: 0,
      STATUS_HARI: finalStatusHari
    };
  }

  // 3. Kalkulasi Durasi
  const workedMinutes = getDurationMinutes(workIn, workOut);

  // 4. Kalkulasi Jam Kerja & Lembur berdasarkan Tipe Hari & Tipe Karyawan
  // JIKA HARI LIBUR: Jam kerja normal = 0, seluruh durasi kerja masuk ke OT (Berlaku untuk SEMUA KARYAWAN termasuk Security)
  if (isHoliday) {
    JAM_KERJA = 0;
    // Jika lembur hari libur >= 5 jam (300 menit), kurangi 60 menit (1 jam) untuk istirahat makan siang
    const netMinutes = workedMinutes >= 300 ? workedMinutes - 60 : workedMinutes;
    totalOtHours = Math.max(0, Math.floor((netMinutes / 60) * 2) / 2);
  } else if (isSecurity) {
    // --- SECURITY HARI BIASA ---
    const secShift = inputShift ? getSecurityShiftByCode(inputShift) : detectSecurityShift(workIn, workOut);
    JAM_KERJA = secShift ? secShift.standardHours : 8.0;
    
    // Hitung Lembur (OT) secara ketat berdasarkan jam selesai shift
    if (secShift) {
      totalOtHours = calculateSecurityOtHours(workIn, workOut, secShift);
    } else {
      totalOtHours = Math.max(0, Math.floor(((workedMinutes - 60) / 60) * 2) / 2 - 8.0);
    }
  } else {
    // --- KARYAWAN UMUM (HARIAN & ALL-IN) HARI BIASA ---
    JAM_KERJA = 8; // Default jam kerja kantoran
    
    // Normalize workOut for overnight (outDate < inDate means next day)
    let effectiveOut = workOut;
    if (workOut.getTime() < workIn.getTime()) {
      effectiveOut = new Date(workOut.getTime() + 24 * 60 * 60 * 1000);
    }

    // Jadwal pulang standar jam 16:00 WIB di hari yang sama dengan jam masuk
    const scheduleOut = new Date(
      workIn.getFullYear(),
      workIn.getMonth(),
      workIn.getDate(),
      16, 0, 0
    );
    
    if (effectiveOut.getTime() > scheduleOut.getTime()) {
      const diffMinutes = (effectiveOut.getTime() - scheduleOut.getTime()) / 60000;
      const breakMinutes = diffMinutes >= 210 ? 30 : 0; // Break 30 menit jika lembur > 3.5 jam
      totalOtHours = Math.max(0, Math.floor(((diffMinutes - breakMinutes) / 60) * 2) / 2);
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
