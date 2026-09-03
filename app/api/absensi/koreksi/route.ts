import { NextResponse } from 'next/server';
import { query, withTransaction } from '@/lib/db';
import { detectSecurityShift, isSecurityJob } from '@/lib/securitySchedule';
import { calculateAttendanceAndOt } from '@/lib/otCalculator';

const parseCorrectEpoch = (val: unknown): Date | null => {
  if (!val) return null;
  if (val instanceof Date) {
    return Number.isNaN(val.getTime()) ? null : val;
  }
  if (typeof val !== 'string') return null;
  const trimmed = val.trim();
  if (!trimmed || trimmed === '-' || trimmed === 'null' || trimmed === 'undefined') return null;

  let date: Date;
  if (trimmed.endsWith('Z') || /[+-]\d{2}(:\d{2})?$/.test(trimmed)) {
    date = new Date(trimmed);
  } else {
    const isoStr = trimmed.includes(' ') ? trimmed.replace(' ', 'T') : trimmed;
    date = new Date(isoStr + '+07:00');
  }

  return Number.isNaN(date.getTime()) ? null : date;
};

const toWibString = (dateObj: Date | null): string | null => {
  if (!dateObj || Number.isNaN(dateObj.getTime())) return null;
  const wibTime = new Date(dateObj.getTime() + 7 * 60 * 60 * 1000);
  if (Number.isNaN(wibTime.getTime())) return null;
  return wibTime.toISOString().replace(/Z$/, ''); 
};

export async function POST(request: Request) {
  try {
    const data = await request.json();

    // Dukung Batch Mode (Array items) maupun single item
    const rawItems: any[] = Array.isArray(data) ? data : (Array.isArray(data.items) ? data.items : [data]);

    if (!rawItems.length) {
      return NextResponse.json({ error: 'Data koreksi kosong.' }, { status: 400 });
    }

    // 1. Validasi & ekstrak data unik untuk pre-fetching
    const items: any[] = rawItems.filter((item: any) => {
      const empCd = String(item?.EMP_CD || '').trim();
      const dateTrans = String(item?.DATE_TRANS || '').split('T')[0];
      return empCd && /^\d{4}-\d{2}-\d{2}$/.test(dateTrans);
    });

    if (!items.length) {
      return NextResponse.json({ error: 'Data koreksi tidak memiliki EMP_CD dan DATE_TRANS yang valid.' }, { status: 400 });
    }

    const uniqueEmpCds: string[] = Array.from(new Set(items.map((i: any) => String(i.EMP_CD).trim())));
    const uniqueDates: string[] = Array.from(new Set(items.map((i: any) => String(i.DATE_TRANS).split('T')[0])));

    // 2. Pre-fetch Data Karyawan (1 single query sebelum transaksi untuk mencegah lock pool deadlock)
    const empInList = uniqueEmpCds.map((c: string) => `'${c.replace(/'/g, "''")}'`).join(',');
    const empRows = await query<any>(`
      SELECT
        RTRIM(e.EMP_CD) AS EMP_CD,
        RTRIM(e.EMP_NM) AS EMP_NM,
        RTRIM(ISNULL(j.JOB_DESC, '')) AS JOB_DESC,
        RTRIM(ISNULL(s.SEC_DESC, '')) AS SEC_DESC
      FROM EMP_TABLE e WITH (NOLOCK)
      LEFT JOIN MS_JOBS j WITH (NOLOCK) ON RTRIM(e.JOB_CD) = RTRIM(j.JOB_CD)
      LEFT JOIN MS_SEC s WITH (NOLOCK) ON RTRIM(e.SEC_CD) = RTRIM(s.SEC_CD)
      WHERE RTRIM(e.EMP_CD) IN (${empInList})
    `);

    const empMap = new Map<string, any>();
    for (const er of empRows) {
      empMap.set(er.EMP_CD, er);
    }

    // 3. Pre-fetch Kalender Libur Kerja (1 single query)
    const dateInList = uniqueDates.map((d: string) => `'${d}'`).join(',');
    const holRows = await query<any>(`
      SELECT CONVERT(varchar(10), TANGGAL, 120) AS TANGGAL
      FROM MS_LIBUR_KERJA WITH (NOLOCK)
      WHERE CONVERT(varchar(10), TANGGAL, 120) IN (${dateInList})
    `);
    const holidaySet = new Set(holRows.map((h: any) => h.TANGGAL));

    // 4. Kalkulasi In-Memory untuk Semua Item
    const preparedItems = items.map((item: any) => {
      const empCd = String(item.EMP_CD || '').trim();
      const dateTrans = String(item.DATE_TRANS || '').split('T')[0];
      const statusHari = item.corrected_status == null || item.corrected_status === '' ? null : String(item.corrected_status).trim();
      const reason = item.corrected_reason == null || item.corrected_reason === '' ? null : String(item.corrected_reason).trim();
      const correctedShift = item.corrected_shift == null || item.corrected_shift === '' ? null : String(item.corrected_shift).trim();
      const correctionBy = String(item.correction_by || 'lusi').trim() || 'lusi';

      let workInDate = parseCorrectEpoch(item.WORK_IN);
      let workOutDate = parseCorrectEpoch(item.WORK_OUT);

      // Jika alasan adalah Cuti / Izin / Sakit (bukan kerja/dinas/pulang cepat), bersihkan jam masuk & keluar jadi NULL
      const isLeaveOrSick = reason && !['01', '03', '04', '20', '21'].includes(reason);
      if (isLeaveOrSick) {
        workInDate = null;
        workOutDate = null;
      }

      // Normalisasi hanya untuk kandidat shift sore/malam; pembalikan pendek dianggap anomali.
      if (workInDate && workOutDate && workOutDate <= workInDate) {
        const inferredMinutes = (workOutDate.getHours() * 60 + workOutDate.getMinutes()) + 1440 - (workInDate.getHours() * 60 + workInDate.getMinutes());
        const isOvernightCandidate = workInDate.getHours() >= 14 && inferredMinutes >= 4 * 60 && inferredMinutes <= 16 * 60;
        if (isOvernightCandidate) {
          workOutDate.setDate(workOutDate.getDate() + 1);
        }
      }

      // Konversi kembali ke string SQL (tanpa Z) untuk disimpan ke DB
      const cleanWorkIn = toWibString(workInDate);
      const cleanWorkOut = toWibString(workOutDate);

      const employee = empMap.get(empCd) || { JOB_DESC: '', SEC_DESC: '' };
      const security = isSecurityJob(employee.JOB_DESC, employee.SEC_DESC, correctedShift || item.SHIFT);
      const detectedShift = security ? detectSecurityShift(cleanWorkIn, cleanWorkOut) : null;
      const shift = correctedShift || detectedShift?.code || null;

      let finalStatusHariInput = (statusHari || '').trim().toUpperCase();
      if (!finalStatusHariInput) {
        finalStatusHariInput = holidaySet.has(dateTrans) ? 'LIBUR' : 'KERJA';
      }

      // Hitung Ulang JAM_KERJA, OT, dan status hari
      const calcResult = calculateAttendanceAndOt(
        dateTrans,
        workInDate,
        workOutDate,
        employee.JOB_DESC,
        employee.SEC_DESC,
        finalStatusHariInput,
        shift
      );

      // Tentukan Jam Kerja Final (Cuti/Dinas = 8 jam, Hadir = hitung durasi, Libur/Kosong = 0 jam)
      const isCuti = reason && ['08', '09', '10', '11', '12', '13', '14', '17', '18'].includes(reason);
      const isDinas = reason === '21';
      let finalJamKerja: number = 0.0;
      if (isCuti || isDinas) {
        finalJamKerja = 8.0;
      } else if (cleanWorkIn && cleanWorkOut) {
        finalJamKerja = calcResult.JAM_KERJA ?? 8.0;
      } else {
        finalJamKerja = 0.0;
      }

      return {
        empCd,
        dateTrans,
        cleanWorkIn,
        cleanWorkOut,
        finalJamKerja,
        statusHari: statusHari || calcResult.STATUS_HARI,
        reason,
        shift,
        ot1: calcResult.OT_1,
        ot2: calcResult.OT_2,
        ot3: calcResult.OT_3,
        ot4: calcResult.OT_4,
        tOt: calcResult.T_OT,
        correctionBy
      };
    });

    // 5. Eksekusi UPDATE serentak dalam SATU Transaksi (HANYA menjalankan tx, anti-deadlock!)
    await withTransaction(async (tx) => {
      for (const p of preparedItems) {
        await tx(`
          DECLARE @targetShift VARCHAR(10) = ISNULL(@shift, (SELECT TOP 1 SHIFT FROM TR_ABSEN WHERE RTRIM(EMP_CD) = @empCd AND CONVERT(date, DATE_TRANS) = @dateTrans));
          SET @targetShift = ISNULL(@targetShift, '1');

          DECLARE @targetJamMasuk DATETIME = (
            SELECT TOP 1 CAST(@dateTrans + ' ' + CONVERT(varchar(8), WORK_IN, 108) AS DATETIME) 
            FROM msSHIFT 
            WHERE RTRIM(shift_CODE) = RTRIM(@targetShift)
          );

          DECLARE @targetJamPulang DATETIME = (
            SELECT TOP 1 
              CASE 
                WHEN CONVERT(varchar(8), WORK_OUT, 108) < CONVERT(varchar(8), WORK_IN, 108) 
                THEN CAST(CONVERT(varchar(10), DATEADD(day, 1, CONVERT(date, @dateTrans)), 120) + ' ' + CONVERT(varchar(8), WORK_OUT, 108) AS DATETIME)
                ELSE CAST(@dateTrans + ' ' + CONVERT(varchar(8), WORK_OUT, 108) AS DATETIME)
              END
            FROM msSHIFT 
            WHERE RTRIM(shift_CODE) = RTRIM(@targetShift)
          );

          UPDATE TR_ABSEN
          SET
            WORK_IN = @workIn,
            WORK_OUT = @workOut,
            DATE_IN = ISNULL(CONVERT(date, @workIn), CONVERT(date, @dateTrans)),
            DATE_OUT = ISNULL(CONVERT(date, @workOut), CASE 
              WHEN @workIn IS NOT NULL AND @workOut IS NOT NULL AND CAST(@workOut AS DATETIME) < CAST(@workIn AS DATETIME) 
              THEN DATEADD(day, 1, CONVERT(date, @dateTrans))
              WHEN @targetShift IN ('2', '4S')
              THEN DATEADD(day, 1, CONVERT(date, @dateTrans))
              ELSE CONVERT(date, @dateTrans)
            END),
            WORK_IN1 = ISNULL(WORK_IN1, @workIn),
            WORK_OUT1 = ISNULL(WORK_OUT1, @workOut),
            HADIR = CASE 
              WHEN @statusHari = 'LIBUR' AND (@workIn IS NULL AND @workOut IS NULL) THEN 0
              WHEN @workIn IS NOT NULL OR @workOut IS NOT NULL THEN 1
              WHEN @reason IS NOT NULL AND @reason IN ('01', '03', '04', '20', '21') THEN 1
              ELSE 0
            END,
            JAM_KERJA = @jamKerja,
            STATUS_HARI = @statusHari,
            REASON = @reason,
            SHIFT = @targetShift,
            FLAG_ABSEN = 'M',
            JAM_MASUK = ISNULL(@targetJamMasuk, JAM_MASUK),
            JAM_PULANG = ISNULL(@targetJamPulang, JAM_PULANG),
            STDJAM = ISNULL((SELECT TOP 1 STD_JAM FROM msSHIFT WHERE RTRIM(shift_CODE) = RTRIM(@targetShift)), STDJAM),
            IS1 = ISNULL((SELECT TOP 1 REST1 FROM msSHIFT WHERE RTRIM(shift_CODE) = RTRIM(@targetShift)), IS1),
            IS2 = ISNULL((SELECT TOP 1 REST2 FROM msSHIFT WHERE RTRIM(shift_CODE) = RTRIM(@targetShift)), IS2),
            MAXJAM = ISNULL((SELECT TOP 1 MAXJAM FROM msSHIFT WHERE RTRIM(shift_CODE) = RTRIM(@targetShift)), MAXJAM),
            REST1_IN = ISNULL((SELECT TOP 1 REST1_IN FROM msSHIFT WHERE RTRIM(shift_CODE) = RTRIM(@targetShift)), REST1_IN),
            REST1_OUT = ISNULL((SELECT TOP 1 REST1_OUT FROM msSHIFT WHERE RTRIM(shift_CODE) = RTRIM(@targetShift)), REST1_OUT),
            REST2_IN = ISNULL((SELECT TOP 1 REST2_IN FROM msSHIFT WHERE RTRIM(shift_CODE) = RTRIM(@targetShift)), REST2_IN),
            REST2_OUT = ISNULL((SELECT TOP 1 REST2_OUT FROM msSHIFT WHERE RTRIM(shift_CODE) = RTRIM(@targetShift)), REST2_OUT),
            Time_Late = CASE 
              WHEN @workIn IS NOT NULL AND @targetJamMasuk IS NOT NULL AND CAST(@workIn AS DATETIME) > @targetJamMasuk 
              THEN CAST(DATEDIFF(MINUTE, @targetJamMasuk, CAST(@workIn AS DATETIME)) AS FLOAT)
              ELSE 0.0
            END,
            POT_JAM = CASE 
              -- Jika masuk di bawah jam 8 (<= 60 menit dari jadwal shift), BEBAS POTONGAN (POT_JAM = 0.0)
              WHEN @workIn IS NOT NULL AND @targetJamMasuk IS NOT NULL AND DATEDIFF(MINUTE, @targetJamMasuk, CAST(@workIn AS DATETIME)) > 60
              THEN CEILING(CAST(DATEDIFF(MINUTE, DATEADD(minute, 60, @targetJamMasuk), CAST(@workIn AS DATETIME)) AS FLOAT) / 30.0) * 0.5
              ELSE 0.0
            END,
            OT_1 = @ot1,
            OT_2 = @ot2,
            OT_3 = @ot3,
            OT_4 = @ot4,
            T_OT = @tOt,
            USERNAME = @correctionBy,
            JAMEDIT = GETDATE(),
            TANDA = NULL
          WHERE RTRIM(EMP_CD) = @empCd AND CONVERT(date, DATE_TRANS) = @dateTrans;
        `, {
          workIn: p.cleanWorkIn,
          workOut: p.cleanWorkOut,
          jamKerja: p.finalJamKerja,
          statusHari: p.statusHari,
          reason: p.reason,
          shift: p.shift,
          ot1: p.ot1,
          ot2: p.ot2,
          ot3: p.ot3,
          ot4: p.ot4,
          tOt: p.tOt,
          correctionBy: p.correctionBy,
          empCd: p.empCd,
          dateTrans: p.dateTrans
        });
      }
    });

    return NextResponse.json({
      success: true,
      count: preparedItems.length,
      message: `${preparedItems.length} data koreksi absensi berhasil disimpan secara serentak.`
    });
  } catch (error: any) {
    console.error('API /absensi/koreksi POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
