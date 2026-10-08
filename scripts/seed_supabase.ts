import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';

// -----------------------------------------------------------------------------
// KONFIGURASI GENERATOR
// -----------------------------------------------------------------------------
const TOTAL_EMPLOYEES = 500;
const START_DATE = '2026-05-01';
const END_DATE = '2026-10-07'; // Tanggal hari ini di sistem

// Nama-nama depan dan belakang realistis Indonesia
const FIRST_NAMES_MALE = [
  'Ahmad', 'Budi', 'Joko', 'Agus', 'Hendra', 'Eko', 'Wahyu', 'Rudi', 'Dedi', 'Arif',
  'Bambang', 'Danang', 'Fajar', 'Gunawan', 'Hadi', 'Irfan', 'Kurniawan', 'Lukman', 'Mulyadi', 'Nanang',
  'Prasetyo', 'Rizky', 'Surya', 'Teguh', 'Tri', 'Wawan', 'Yanto', 'Zainal', 'Bayu', 'Dimas'
];
const FIRST_NAMES_FEMALE = [
  'Siti', 'Dewi', 'Sri', 'Rina', 'Nur', 'Ratna', 'Fitri', 'Endang', 'Yuni', 'Lina',
  'Ani', 'Citra', 'Diah', 'Erna', 'Hesti', 'Indah', 'Kartika', 'Lestari', 'Maya', 'Ningsih',
  'Putri', 'Rahayu', 'Sari', 'Tuti', 'Utami', 'Wati', 'Wulandari', 'Yuliana', 'Zahra', 'Ayu'
];
const LAST_NAMES = [
  'Saputra', 'Hidayat', 'Kusuma', 'Pratama', 'Santoso', 'Wijaya', 'Setiawan', 'Nugroho', 'Wibowo', 'Firmansyah',
  'Purnama', 'Ramadhan', 'Utomo', 'Susanto', 'Permana', 'Hakim', 'Maulana', 'Fauzi', 'Suhendra', 'Gunawan',
  'Siregar', 'Pasaribu', 'Lubis', 'Harahap', 'Nasution', 'Simanjuntak', 'Hutapea', 'Sitorus', 'Tanjung', 'Chaniago'
];

const CITIES = ['Jakarta Barat', 'Jakarta Utara', 'Tangerang', 'Bekasi', 'Depok', 'Bogor', 'Serang', 'Karawang'];
const RELIGIONS = ['Islam', 'Kristen', 'Katolik', 'Hindu', 'Buddha'];

// -----------------------------------------------------------------------------
// STRUKTUR ORGANISASI PABRIK
// -----------------------------------------------------------------------------
const DEPARTMENTS = [
  { code: 'PROD', name: 'PRODUCTION' },
  { code: 'WH', name: 'WAREHOUSE' },
  { code: 'QA', name: 'QUALITY ASSURANCE' },
  { code: 'ENG', name: 'ENGINEERING & MAINTENANCE' },
  { code: 'GA', name: 'GENERAL AFFAIRS & SERVICE' },
  { code: 'HRC', name: 'HR & COMPLIANCE' },
  { code: 'ACC', name: 'ACCOUNTING & FINANCE' },
  { code: 'PPIC', name: 'PPIC & ORDER MANAGEMENT' },
  { code: 'EXIM', name: 'EXPORT & IMPORT' },
];

const SECTIONS = [
  { code: 'SEC01', desc: 'LINE 01', team: 'SEWING', dep: 'PROD' },
  { code: 'SEC02', desc: 'LINE 02', team: 'SEWING', dep: 'PROD' },
  { code: 'SEC03', desc: 'LINE 03', team: 'SEWING', dep: 'PROD' },
  { code: 'SEC04', desc: 'LINE 04', team: 'SEWING', dep: 'PROD' },
  { code: 'SEC05', desc: 'LINE 05', team: 'SEWING', dep: 'PROD' },
  { code: 'SEC06', desc: 'LINE 06', team: 'SEWING', dep: 'PROD' },
  { code: 'SEC07', desc: 'LINE 07', team: 'SEWING', dep: 'PROD' },
  { code: 'SEC08', desc: 'LINE 08', team: 'SEWING', dep: 'PROD' },
  { code: 'SEC09', desc: 'LINE 09', team: 'SEWING', dep: 'PROD' },
  { code: 'SEC10', desc: 'LINE 10', team: 'SEWING', dep: 'PROD' },
  { code: 'SEC11', desc: 'CUTTING', team: 'CUTTING', dep: 'PROD' },
  { code: 'SEC12', desc: 'FINISHING', team: 'FINISHING', dep: 'PROD' },
  { code: 'SEC13', desc: 'PACKING', team: 'PACKING', dep: 'PROD' },
  { code: 'SEC14', desc: 'QA ACCURACY', team: 'QA', dep: 'QA' },
  { code: 'SEC15', desc: 'MEKANIK', team: 'MECHANIC', dep: 'ENG' },
  { code: 'SEC16', desc: 'FABRIC', team: 'WAREHOUSE', dep: 'WH' },
  { code: 'SEC17', desc: 'ACCESSORIES', team: 'WAREHOUSE', dep: 'WH' },
  { code: 'SEC18', desc: 'SECURITY', team: 'GA SERVICE', dep: 'GA' },
  { code: 'SEC19', desc: 'DRIVER', team: 'GA SERVICE', dep: 'GA' },
  { code: 'SEC20', desc: 'CS', team: 'GA SERVICE', dep: 'GA' },
  { code: 'SEC21', desc: 'HR', team: 'HRC', dep: 'HRC' },
  { code: 'SEC22', desc: 'IT', team: 'GA', dep: 'GA' },
  { code: 'SEC23', desc: 'ORDER MGMT.', team: 'PPIC', dep: 'PPIC' },
  { code: 'SEC24', desc: 'ACCOUNTING', team: 'ACCOUNTING', dep: 'ACC' },
];

const JOBS = [
  { code: 'J01', desc: 'OPERATOR SEWING' },
  { code: 'J02', desc: 'HELPER SEWING' },
  { code: 'J03', desc: 'OPERATOR CUTTING' },
  { code: 'J04', desc: 'OPERATOR FINISHING' },
  { code: 'J05', desc: 'HELPER PACKING' },
  { code: 'J06', desc: 'QC INLINE' },
  { code: 'J07', desc: 'QC ENDLINE' },
  { code: 'J08', desc: 'MEKANIK' },
  { code: 'J09', desc: 'STAFF GUDANG' },
  { code: 'J10', desc: 'SECURITY' },
  { code: 'J11', desc: 'DRIVER' },
  { code: 'J12', desc: 'CLEANING SERVICE' },
  // All-in positions
  { code: 'J13', desc: 'SUPERVISOR LINE' },
  { code: 'J14', desc: 'SUPERVISOR CUTTING' },
  { code: 'J15', desc: 'SUPERVISOR FINISHING' },
  { code: 'J16', desc: 'SUPERVISOR WAREHOUSE' },
  { code: 'J17', desc: 'CHIEF QA' },
  { code: 'J18', desc: 'STAFF HRD' },
  { code: 'J19', desc: 'STAFF IT' },
  { code: 'J20', desc: 'STAFF ACCOUNTING' },
  { code: 'J21', desc: 'STAFF PPIC' },
  { code: 'J22', desc: 'FACTORY MANAGER' },
  { code: 'J23', desc: 'HR MANAGER' },
];

const HOLIDAYS_2026: Record<string, string> = {
  '2026-01-01': 'Tahun Baru 2026 Masehi',
  '2026-01-16': 'Isra Mi\'raj Nabi Muhammad SAW',
  '2026-02-17': 'Tahun Baru Imlek 2577 Kongzili',
  '2026-03-19': 'Hari Suci Nyepi (Tahun Baru Saka 1948)',
  '2026-03-21': 'Hari Raya Idul Fitri 1447 H',
  '2026-03-22': 'Hari Raya Idul Fitri 1447 H',
  '2026-04-03': 'Wafat Yesus Kristus (Jumat Agung)',
  '2026-05-01': 'Hari Buruh Internasional',
  '2026-05-14': 'Kenaikan Yesus Kristus',
  '2026-05-27': 'Hari Raya Idul Adha 1447 H',
  '2026-05-31': 'Hari Raya Waisak 2570 BE',
  '2026-06-01': 'Hari Lahir Pancasila',
  '2026-06-16': '1 Muharram / Tahun Baru Islam 1448 H',
  '2026-08-17': 'Hari Kemerdekaan Republik Indonesia ke-81',
  '2026-08-25': 'Maulid Nabi Muhammad SAW',
  '2026-12-25': 'Hari Raya Natal',
};

// -----------------------------------------------------------------------------
// HELPER FUNCTIONS
// -----------------------------------------------------------------------------
function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getDatesInRange(startStr: string, endStr: string): string[] {
  const dates: string[] = [];
  const curr = new Date(startStr + 'T00:00:00');
  const end = new Date(endStr + 'T00:00:00');
  while (curr <= end) {
    dates.push(formatDate(curr));
    curr.setDate(curr.getDate() + 1);
  }
  return dates;
}

// -----------------------------------------------------------------------------
// GENERATOR UTAMA
// -----------------------------------------------------------------------------
export async function generateAllData() {
  console.log(`\n=============================================================`);
  console.log(`MEMULAI GENERATOR DATA HRIS: ${TOTAL_EMPLOYEES} KARYAWAN & 6 BULAN PRESENSI`);
  console.log(`=============================================================\n`);

  // 1. DATA KARYAWAN (500 Orang)
  const employees: any[] = [];
  let empCounter = 26010001;

  for (let i = 1; i <= TOTAL_EMPLOYEES; i++) {
    const isFemale = i <= 280; // 56% wanita
    const firstName = isFemale ? randomChoice(FIRST_NAMES_FEMALE) : randomChoice(FIRST_NAMES_MALE);
    const lastName = randomChoice(LAST_NAMES);
    const name = `${firstName} ${lastName}`;
    const empCd = String(empCounter++);
    const sx = isFemale ? 'P' : 'L';

    // Status: 60 All-In, 430 Harian, 10 Resign
    const isResign = i > 490;
    const isAllIn = !isResign && i <= 60;

    let secCd = 'SEC01';
    let jobCd = 'J01';
    let depCd = 'PROD';

    if (isAllIn) {
      if (i <= 10) {
        secCd = `SEC${String(i).padStart(2, '0')}`;
        jobCd = 'J13'; // SPV Line
        depCd = 'PROD';
      } else if (i <= 15) {
        secCd = 'SEC11';
        jobCd = 'J14'; // SPV Cutting
        depCd = 'PROD';
      } else if (i <= 20) {
        secCd = 'SEC12';
        jobCd = 'J15'; // SPV Finishing
        depCd = 'PROD';
      } else if (i <= 25) {
        secCd = 'SEC16';
        jobCd = 'J16'; // SPV Warehouse
        depCd = 'WH';
      } else if (i <= 30) {
        secCd = 'SEC14';
        jobCd = 'J17'; // Chief QA
        depCd = 'QA';
      } else if (i <= 40) {
        secCd = 'SEC21';
        jobCd = 'J18'; // Staff HRD
        depCd = 'HRC';
      } else if (i <= 48) {
        secCd = 'SEC24';
        jobCd = 'J20'; // Staff Accounting
        depCd = 'ACC';
      } else if (i <= 54) {
        secCd = 'SEC23';
        jobCd = 'J21'; // Staff PPIC
        depCd = 'PPIC';
      } else if (i <= 58) {
        secCd = 'SEC22';
        jobCd = 'J19'; // Staff IT
        depCd = 'GA';
      } else if (i === 59) {
        secCd = 'SEC01';
        jobCd = 'J22'; // Factory Manager
        depCd = 'PROD';
      } else {
        secCd = 'SEC21';
        jobCd = 'J23'; // HR Manager
        depCd = 'HRC';
      }
    } else {
      // Harian / Operator
      if (i <= 320) {
        // Line 1 - 10 Sewing
        const lineNum = ((i - 61) % 10) + 1;
        secCd = `SEC${String(lineNum).padStart(2, '0')}`;
        jobCd = (i % 8 === 0) ? 'J02' : 'J01'; // Operator atau Helper
        depCd = 'PROD';
      } else if (i <= 365) {
        secCd = 'SEC11';
        jobCd = 'J03'; // Cutting
        depCd = 'PROD';
      } else if (i <= 405) {
        secCd = 'SEC12';
        jobCd = 'J04'; // Finishing
        depCd = 'PROD';
      } else if (i <= 440) {
        secCd = 'SEC13';
        jobCd = 'J05'; // Packing
        depCd = 'PROD';
      } else if (i <= 460) {
        secCd = 'SEC14';
        jobCd = (i % 3 === 0) ? 'J07' : 'J06'; // QC
        depCd = 'QA';
      } else if (i <= 472) {
        secCd = 'SEC15';
        jobCd = 'J08'; // Mekanik
        depCd = 'ENG';
      } else if (i <= 484) {
        secCd = (i % 2 === 0) ? 'SEC16' : 'SEC17';
        jobCd = 'J09'; // Staff Gudang
        depCd = 'WH';
      } else if (i <= 494) {
        secCd = 'SEC18';
        jobCd = 'J10'; // Security
        depCd = 'GA';
      } else if (i <= 497) {
        secCd = 'SEC19';
        jobCd = 'J11'; // Driver
        depCd = 'GA';
      } else {
        secCd = 'SEC20';
        jobCd = 'J12'; // CS
        depCd = 'GA';
      }
    }

    const dtEntry = `202${randomInt(1, 4)}-${String(randomInt(1, 12)).padStart(2, '0')}-${String(randomInt(1, 28)).padStart(2, '0')}`;
    let dtRsg = null;
    let actNonAct = true;
    if (isResign) {
      actNonAct = false;
      const rsgMonth = randomInt(6, 8);
      dtRsg = `2026-0${rsgMonth}-${String(randomInt(10, 25)).padStart(2, '0')}`;
    }

    const birthYear = randomInt(1985, 2004);
    const dtBrt = `${birthYear}-${String(randomInt(1, 12)).padStart(2, '0')}-${String(randomInt(1, 28)).padStart(2, '0')}`;
    const city = randomChoice(CITIES);
    const bsSlr = isAllIn ? randomInt(7500000, 15000000) : randomInt(5000000, 6500000);

    employees.push({
      EMP_CD: empCd,
      EMP_NM: name,
      DEP_CD: depCd,
      SEC_CD: secCd,
      JOB_CD: jobCd,
      DIV_CD: depCd === 'PROD' || depCd === 'WH' || depCd === 'QA' || depCd === 'ENG' ? 'OPR' : 'ADM',
      JNS_KRY: isAllIn ? '100' : (i % 3 === 0 ? '100' : '101'),
      Act_NonAct: actNonAct,
      DT_ENTRY: dtEntry,
      DT_RSG: dtRsg,
      DT_BRT: dtBrt,
      PLC_BRT: city,
      ADRR: `Jl. Raya ${city} No. ${randomInt(10, 150)} RT ${randomInt(1, 9)}/RW ${randomInt(1, 5)}`,
      CT: city,
      SX: sx,
      agama: randomChoice(RELIGIONS),
      telepon: `081${randomInt(10, 99)}${randomInt(100000, 999999)}`,
      noktp: `317${randomInt(1000000000000, 9999999999999)}`,
      NPWP: `0${randomInt(10, 99)}.${randomInt(100, 999)}.${randomInt(100, 999)}.${randomInt(1, 9)}-${randomInt(100, 999)}.000`,
      PTKP_ST: isFemale ? 'TK/0' : (i % 2 === 0 ? 'K/1' : 'TK/0'),
      ALL_IN: isAllIn ? '1' : '0',
      FLAG_OT: isAllIn ? '0' : '1',
      BS_SLR: bsSlr,
    });
  }

  console.log(`[1/4] Berhasil menyusun data ${employees.length} karyawan.`);

  // 2. DATA CUTI (tblCUTI & tbldetcuti)
  const cutiMasters: any[] = [];
  const cutiDetails: any[] = [];
  const dates = getDatesInRange(START_DATE, END_DATE);

  // Ambil sampel ~40 karyawan untuk pengajuan cuti resmi 1-3 hari
  const cutiSampleEmps = employees.filter(e => e.Act_NonAct).slice(20, 80);
  cutiSampleEmps.forEach((emp, idx) => {
    const randomDateIdx = randomInt(15, dates.length - 20);
    const startCuti = dates[randomDateIdx];
    const duration = randomInt(1, 3);
    const endCuti = dates[Math.min(randomDateIdx + duration - 1, dates.length - 1)];
    const reasonCode = (emp.SX === 'P' && idx % 7 === 0) ? '05' : (idx % 3 === 0 ? '02' : '18');
    const remark = reasonCode === '05' ? 'Cuti Melahirkan / Haid' : (reasonCode === '02' ? 'Sakit Demam / Surat Dokter' : 'Cuti Tahunan Keperluan Keluarga');

    cutiMasters.push({
      EMP_CD: emp.EMP_CD,
      EMP_NM: emp.EMP_NM,
      AWAL_CUTI: startCuti,
      AKHIR_CUTI: endCuti,
      REASON: reasonCode,
      REMARK: remark,
      LM_CUTI: duration,
    });

    const cDates = getDatesInRange(startCuti, endCuti);
    cDates.forEach(cd => {
      cutiDetails.push({
        EMP_CD: emp.EMP_CD,
        EMP_NM: emp.EMP_NM,
        TGL_CUTI: cd,
        REASON: reasonCode,
      });
    });
  });

  console.log(`[2/4] Berhasil menyusun ${cutiMasters.length} master cuti & ${cutiDetails.length} hari rincian cuti.`);

  // Cuti lookup map untuk injeksi presensi
  const cutiLookup = new Map<string, string>(); // `EMP_CD_DATE` -> REASON
  cutiDetails.forEach(cd => {
    cutiLookup.set(`${cd.EMP_CD}_${cd.TGL_CUTI}`, cd.REASON);
  });

  // 3. DATA TRANSAKSI PRESENSI (TR_ABSEN) ~80.000 Baris
  const attendanceRecords: any[] = [];
  const lemburAllInRecords: any[] = [];

  for (const dateStr of dates) {
    const dObj = new Date(dateStr + 'T00:00:00');
    const dow = dObj.getDay(); // 0 = Minggu, 6 = Sabtu
    const isWeekend = dow === 0 || dow === 6;
    const isHoliday = !!HOLIDAYS_2026[dateStr];

    for (const emp of employees) {
      // Lewati jika karyawan sudah resign sebelum tanggal ini
      if (!emp.Act_NonAct && emp.DT_RSG && dateStr > emp.DT_RSG) {
        continue;
      }
      // Lewati jika karyawan belum mulai bekerja pada tanggal ini
      if (emp.DT_ENTRY && dateStr < emp.DT_ENTRY) {
        continue;
      }

      const isSecurity = emp.SEC_CD === 'SEC18' || emp.JOB_CD === 'J10';
      const cutiReason = cutiLookup.get(`${emp.EMP_CD}_${dateStr}`);

      let shift = '1';
      let statusHari = 'KERJA';
      let workIn: string | null = null;
      let workOut: string | null = null;
      let workIn1: string | null = null;
      let workOut1: string | null = null;
      let jamMasuk: string | null = null;
      let jamPulang: string | null = null;
      let jamKerja = 0;
      let reason: string | null = null;
      let ot1 = 0;
      let ot2 = 0;
      let ot3 = 0;
      let ot4 = 0;
      let tOt = 0;
      let timeLate = 0;

      if (isSecurity) {
        // Security rotasi shift 3 grup (S1: 07:00-15:00, S2: 15:00-23:00, S3: 23:00-07:00)
        const secShiftIdx = (parseInt(emp.EMP_CD.slice(-2)) + dObj.getDate()) % 4;
        if (secShiftIdx === 0) {
          shift = 'S1';
          workIn = `${dateStr} 06:55:00`;
          workOut = `${dateStr} 15:05:00`;
          jamMasuk = '06:55';
          jamPulang = '15:05';
          jamKerja = 8.0;
        } else if (secShiftIdx === 1) {
          shift = 'S2';
          workIn = `${dateStr} 14:55:00`;
          workOut = `${dateStr} 23:05:00`;
          jamMasuk = '14:55';
          jamPulang = '23:05';
          jamKerja = 8.0;
        } else if (secShiftIdx === 2) {
          shift = 'S3';
          workIn = `${dateStr} 22:55:00`;
          // Pulang besok pagi
          const nextDay = new Date(dObj);
          nextDay.setDate(nextDay.getDate() + 1);
          workOut = `${formatDate(nextDay)} 07:05:00`;
          jamMasuk = '22:55';
          jamPulang = '07:05';
          jamKerja = 8.0;
        } else {
          // Off shift
          statusHari = 'LIBUR';
        }
      } else if (isHoliday || isWeekend) {
        statusHari = 'LIBUR';
        // Lembur weekend untuk operator sewing tertentu (proyek kejar tayang)
        if (dow === 6 && !isHoliday && emp.SEC_CD === 'SEC01' && parseInt(emp.EMP_CD.slice(-1)) % 3 === 0) {
          statusHari = 'KERJA';
          workIn = `${dateStr} 07:00:00`;
          workOut = `${dateStr} 15:30:00`;
          jamMasuk = '07:00';
          jamPulang = '15:30';
          jamKerja = 7.5;
          ot2 = 7.5; // Hari libur/weekend dihitung pengali OT2
          tOt = 7.5 * 35000;
        }
      } else if (cutiReason) {
        // Cuti / Izin / Sakit
        statusHari = 'KERJA';
        reason = cutiReason;
      } else {
        // HARI KERJA REGULER
        statusHari = 'KERJA';
        const randCase = Math.random() * 100;

        if (randCase < 78) {
          // 1. HADIR TEPAT WAKTU (78%)
          const inMin = randomInt(50, 68); // 06:50 - 07:08
          const outMin = randomInt(0, 15);  // 16:00 - 16:15
          workIn = `${dateStr} 06:${String(inMin).padStart(2, '0')}:12`;
          workOut = `${dateStr} 16:${String(outMin).padStart(2, '0')}:45`;
          jamMasuk = `06:${String(inMin).padStart(2, '0')}`;
          jamPulang = `16:${String(outMin).padStart(2, '0')}`;
          jamKerja = 8.0;
        } else if (randCase < 92) {
          // 2. LEMBUR KERJA (14%)
          const inMin = randomInt(50, 65);
          workIn = `${dateStr} 06:${String(inMin).padStart(2, '0')}:00`;
          jamMasuk = `06:${String(inMin).padStart(2, '0')}`;

          const otType = randomInt(1, 3);
          if (otType === 1) {
            // Lembur 1.5 jam (pulang 17:30)
            workOut = `${dateStr} 17:35:00`;
            jamPulang = '17:35';
            jamKerja = 8.0;
            if (emp.ALL_IN !== '1') {
              ot1 = 1.5;
              tOt = 1.5 * 30000;
            }
          } else if (otType === 2) {
            // Lembur 2.5 jam (pulang 18:30)
            workOut = `${dateStr} 18:32:00`;
            jamPulang = '18:32';
            jamKerja = 8.0;
            if (emp.ALL_IN !== '1') {
              ot1 = 1.5;
              ot2 = 1.0;
              tOt = 2.5 * 32000;
            }
          } else {
            // Lembur 4 jam (pulang 20:00)
            workOut = `${dateStr} 20:05:00`;
            jamPulang = '20:05';
            jamKerja = 8.0;
            if (emp.ALL_IN !== '1') {
              ot1 = 1.5;
              ot2 = 2.5;
              tOt = 4.0 * 35000;
            }
          }

          // Jika karyawan All-In lembur, catat di TR_LEMBUR_ALLIN
          if (emp.ALL_IN === '1' && otType >= 2) {
            lemburAllInRecords.push({
              DATE_TRANS: dateStr,
              EMP_CD: emp.EMP_CD,
              JAM_MULAI: '16:00',
              JAM_SELESAI: jamPulang,
              NOMINAL: 150000,
              CREATED_BY: 'HRIS_SYSTEM',
            });
          }
        } else if (randCase < 95) {
          // 3. ANOMALI TERLAMBAT (3% - PERLU PERHATIAN)
          const lateMin = randomInt(16, 45); // Terlambat 16 - 45 menit
          workIn = `${dateStr} 07:${String(lateMin).padStart(2, '0')}:00`;
          workOut = `${dateStr} 16:10:00`;
          jamMasuk = `07:${String(lateMin).padStart(2, '0')}`;
          jamPulang = '16:10';
          jamKerja = 7.5;
          timeLate = lateMin;
        } else if (randCase < 97) {
          // 4. ANOMALI JAM KOSONG (2% - LUPA TAP IN ATAU LUPA TAP OUT)
          if (Math.random() > 0.5) {
            // Lupa tap pulang
            workIn = `${dateStr} 06:58:00`;
            jamMasuk = '06:58';
          } else {
            // Lupa tap masuk
            workOut = `${dateStr} 16:02:00`;
            jamPulang = '16:02';
          }
        } else if (randCase < 98.5) {
          // 5. SAKIT MENDADAK (1.5%)
          reason = '02';
        } else {
          // 6. ALPHA / MANGKIR (1.5%)
          reason = 'A';
        }
      }

      workIn1 = workIn;
      workOut1 = workOut;

      attendanceRecords.push({
        DATE_TRANS: dateStr,
        EMP_CD: emp.EMP_CD,
        EMP_NM: emp.EMP_NM,
        SEC_CD: emp.SEC_CD,
        SHIFT: shift,
        STATUS_HARI: statusHari,
        DATE_IN: workIn,
        WORK_IN: workIn,
        WORK_IN1: workIn1,
        DATE_OUT: workOut,
        WORK_OUT: workOut,
        WORK_OUT1: workOut1,
        JAM_MASUK: jamMasuk,
        JAM_PULANG: jamPulang,
        JAM_KERJA: jamKerja,
        REASON: reason,
        OT_1: ot1,
        OT_2: ot2,
        OT_3: ot3,
        OT_4: ot4,
        T_OT: tOt,
        Time_Late: timeLate,
        U_MAKAN: workIn ? 20000 : 0,
        U_TRANSPORT: workIn ? 15000 : 0,
      });
    }
  }

  console.log(`[3/4] Berhasil menyusun ${attendanceRecords.length} transaksi presensi & ${lemburAllInRecords.length} lembur All-In.`);

  return {
    departments: DEPARTMENTS,
    sections: SECTIONS,
    jobs: JOBS,
    holidays: HOLIDAYS_2026,
    employees,
    cutiMasters,
    cutiDetails,
    attendances: attendanceRecords,
    allInLembur: lemburAllInRecords,
  };
}

// -----------------------------------------------------------------------------
// SINKRONISASI LANGSUNG KE SUPABASE VIA DATABASE_URL (JIKA TERSEDIA)
// -----------------------------------------------------------------------------
async function runDirectSeed(dbUrl: string) {
  const pool = new Pool({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
  });

  const client = await pool.connect();
  console.log('Terhubung ke database Supabase...');

  try {
    const data = await generateAllData();

    await client.query('BEGIN');

    // 1. Master Data
    console.log('Menyimpan Master Departemen...');
    for (const d of data.departments) {
      await client.query(
        `INSERT INTO MS_DEP (DEP_CD, DEP_DESC) VALUES ($1, $2) ON CONFLICT (DEP_CD) DO UPDATE SET DEP_DESC = EXCLUDED.DEP_DESC`,
        [d.code, d.name]
      );
    }

    console.log('Menyimpan Master Seksi...');
    for (const s of data.sections) {
      await client.query(
        `INSERT INTO MS_SEC (SEC_CD, SEC_DESC, GRP_CD) VALUES ($1, $2, $3) ON CONFLICT (SEC_CD) DO UPDATE SET SEC_DESC = EXCLUDED.SEC_DESC`,
        [s.code, s.desc, s.dep]
      );
    }

    console.log('Menyimpan Master Jabatan...');
    for (const j of data.jobs) {
      await client.query(
        `INSERT INTO MS_JOBS (JOB_CD, JOB_DESC) VALUES ($1, $2) ON CONFLICT (JOB_CD) DO UPDATE SET JOB_DESC = EXCLUDED.JOB_DESC`,
        [j.code, j.desc]
      );
    }

    console.log('Menyimpan Master Hari Libur...');
    for (const [tgl, ket] of Object.entries(data.holidays)) {
      await client.query(
        `INSERT INTO MS_LIBUR_KERJA (TANGGAL, KETERANGAN, COMPANY_CODE, STATUS_LIBUR, FLAG_PAY)
         VALUES ($1, $2, '01', '1', '1') ON CONFLICT (TANGGAL) DO UPDATE SET KETERANGAN = EXCLUDED.KETERANGAN`,
        [tgl, ket]
      );
    }

    // Master Alasan
    const reasons = [
      { c: '18', d: 'Cuti Tahunan', g: 'C' },
      { c: '02', d: 'Sakit Surat Dokter', g: 'S' },
      { c: '05', d: 'Cuti Melahirkan / Haid', g: 'H' },
      { c: '03', d: 'Izin Resmi Pribadi', g: 'I' },
      { c: 'A', d: 'Alpha / Mangkir', g: 'A' },
      { c: 'O', d: 'Dinas Luar', g: 'O' },
    ];
    for (const r of reasons) {
      await client.query(
        `INSERT INTO Ms_Reason (REASON_CODE, REASON_DESC, REASON_GROUP) VALUES ($1, $2, $3) ON CONFLICT (REASON_CODE) DO NOTHING`,
        [r.c, r.d, r.g]
      );
    }

    // 2. Karyawan
    console.log(`Menyimpan ${data.employees.length} Karyawan ke EMP_TABLE...`);
    for (const e of data.employees) {
      await client.query(
        `INSERT INTO EMP_TABLE (
          EMP_CD, EMP_NM, DEP_CD, SEC_CD, JOB_CD, DIV_CD, JNS_KRY, Act_NonAct,
          DT_ENTRY, DT_RSG, DT_BRT, PLC_BRT, ADRR, CT, SX, agama, telepon, noktp, NPWP, PTKP_ST, ALL_IN, BS_SLR
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22
        ) ON CONFLICT (EMP_CD) DO UPDATE SET
          EMP_NM = EXCLUDED.EMP_NM, SEC_CD = EXCLUDED.SEC_CD, JOB_CD = EXCLUDED.JOB_CD, Act_NonAct = EXCLUDED.Act_NonAct`,
        [
          e.EMP_CD, e.EMP_NM, e.DEP_CD, e.SEC_CD, e.JOB_CD, e.DIV_CD, e.JNS_KRY, e.Act_NonAct,
          e.DT_ENTRY, e.DT_RSG, e.DT_BRT, e.PLC_BRT, e.ADRR, e.CT, e.SX, e.agama, e.telepon, e.noktp, e.NPWP, e.PTKP_ST, e.ALL_IN, e.BS_SLR
        ]
      );
    }

    // 3. Cuti
    console.log(`Menyimpan ${data.cutiMasters.length} Pengajuan Cuti...`);
    for (const c of data.cutiMasters) {
      await client.query(
        `INSERT INTO tblCUTI (EMP_CD, EMP_NM, AWAL_CUTI, AKHIR_CUTI, REASON, REMARK, LM_CUTI)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [c.EMP_CD, c.EMP_NM, c.AWAL_CUTI, c.AKHIR_CUTI, c.REASON, c.REMARK, c.LM_CUTI]
      );
    }

    for (const d of data.cutiDetails) {
      await client.query(
        `INSERT INTO tbldetcuti (EMP_CD, EMP_NM, TGL_CUTI, REASON)
         VALUES ($1, $2, $3, $4) ON CONFLICT (EMP_CD, TGL_CUTI) DO NOTHING`,
        [d.EMP_CD, d.EMP_NM, d.TGL_CUTI, d.REASON]
      );
    }

    // 4. Batch Insert TR_ABSEN (Chunks of 1000)
    console.log(`Menyimpan ${data.attendances.length} Baris Presensi ke TR_ABSEN (Batch Chunks)...`);
    const chunkSize = 500;
    for (let i = 0; i < data.attendances.length; i += chunkSize) {
      const chunk = data.attendances.slice(i, i + chunkSize);
      const valuesSql: string[] = [];
      const params: any[] = [];
      let pIdx = 1;

      chunk.forEach(a => {
        valuesSql.push(`($${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++})`);
        params.push(
          a.DATE_TRANS, a.EMP_CD, a.EMP_NM, a.SEC_CD, a.SHIFT, a.STATUS_HARI,
          a.WORK_IN, a.WORK_OUT, a.JAM_MASUK, a.JAM_PULANG, a.JAM_KERJA,
          a.REASON, a.OT_1, a.OT_2, a.Time_Late
        );
      });

      const insertQuery = `
        INSERT INTO TR_ABSEN (
          DATE_TRANS, EMP_CD, EMP_NM, SEC_CD, SHIFT, STATUS_HARI,
          WORK_IN, WORK_OUT, JAM_MASUK, JAM_PULANG, JAM_KERJA,
          REASON, OT_1, OT_2, Time_Late
        ) VALUES ${valuesSql.join(',')}
        ON CONFLICT (EMP_CD, DATE_TRANS) DO UPDATE SET
          WORK_IN = EXCLUDED.WORK_IN,
          WORK_OUT = EXCLUDED.WORK_OUT,
          JAM_MASUK = EXCLUDED.JAM_MASUK,
          JAM_PULANG = EXCLUDED.JAM_PULANG,
          JAM_KERJA = EXCLUDED.JAM_KERJA,
          REASON = EXCLUDED.REASON,
          OT_1 = EXCLUDED.OT_1,
          OT_2 = EXCLUDED.OT_2,
          Time_Late = EXCLUDED.Time_Late
      `;

      await client.query(insertQuery, params);
      process.stdout.write(`\rProgress: ${Math.min(i + chunkSize, data.attendances.length)} / ${data.attendances.length} baris...`);
    }
    console.log('\nPresensi selesai disimpan!');

    // 5. Lembur All-In
    console.log(`Menyimpan ${data.allInLembur.length} data lembur All-In...`);
    for (const l of data.allInLembur) {
      await client.query(
        `INSERT INTO TR_LEMBUR_ALLIN (DATE_TRANS, EMP_CD, JAM_MULAI, JAM_SELESAI, NOMINAL, CREATED_BY)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [l.DATE_TRANS, l.EMP_CD, l.JAM_MULAI, l.JAM_SELESAI, l.NOMINAL, l.CREATED_BY]
      );
    }

    await client.query('COMMIT');
    console.log('\n=============================================================');
    console.log('SEMUA DATA DUMMY BERHASIL DIMASUKKAN KE SUPABASE 100%!');
    console.log('=============================================================\n');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Terjadi kesalahan seeder:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

// Jalankan jika dipanggil langsung via CLI
const targetDb = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.SUPABASE_DB_URL;
if (targetDb) {
  runDirectSeed(targetDb).then(() => process.exit(0)).catch(err => {
    console.error(err);
    process.exit(1);
  });
} else {
  console.log('Info: DATABASE_URL belum diisi. Anda dapat menjalankan skrip ini dengan memasukkan connection string Supabase:');
  console.log('DATABASE_URL="postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres" npx tsx scripts/seed_supabase.ts\n');
}
