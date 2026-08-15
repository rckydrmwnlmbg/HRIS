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

const isMeaningful = (val: unknown): boolean => {
  if (val == null) return false;
  const str = String(val).trim();
  return str !== '' && str !== '-' && str !== 'null' && str !== 'undefined';
};

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const empCd = String(data.EMP_CD || '').trim();
    const dateTrans = String(data.DATE_TRANS || '').split('T')[0];
    const statusHari = data.corrected_status == null || data.corrected_status === '' ? null : String(data.corrected_status).trim();
    const reason = data.corrected_reason == null || data.corrected_reason === '' ? null : String(data.corrected_reason).trim();
    const correctedShift = data.corrected_shift == null || data.corrected_shift === '' ? null : String(data.corrected_shift).trim();
    
    const workInDate = parseCorrectEpoch(data.WORK_IN);
    const workOutDate = parseCorrectEpoch(data.WORK_OUT);

    if (!empCd || !/^\d{4}-\d{2}-\d{2}$/.test(dateTrans)) {
      return NextResponse.json({ error: 'EMP_CD dan DATE_TRANS wajib valid.' }, { status: 400 });
    }

    if ((isMeaningful(data.WORK_IN) && !workInDate) || (isMeaningful(data.WORK_OUT) && !workOutDate)) {
      return NextResponse.json({ error: 'WORK_IN/WORK_OUT harus berupa timestamp valid.' }, { status: 400 });
    }

    // Normalisasi hanya untuk kandidat shift sore/malam; pembalikan pendek dianggap anomali.
    if (workInDate && workOutDate && workOutDate <= workInDate) {
      const inferredMinutes = (workOutDate.getHours() * 60 + workOutDate.getMinutes()) + 1440 - (workInDate.getHours() * 60 + workInDate.getMinutes());
      const isOvernightCandidate = workInDate.getHours() >= 14 && inferredMinutes >= 4 * 60 && inferredMinutes <= 16 * 60;
      if (!isOvernightCandidate) {
        return NextResponse.json({ error: 'WORK_OUT lebih awal dari WORK_IN; periksa pasangan fingerprint.' }, { status: 400 });
      }
      workOutDate.setDate(workOutDate.getDate() + 1);
    }
    
    // Konversi kembali ke string (tanpa Z) untuk disimpan ke DB
    const cleanWorkIn = toWibString(workInDate);
    const cleanWorkOut = toWibString(workOutDate);

    const empCheck = await query<any>(`
      SELECT TOP 1
        RTRIM(e.EMP_NM) AS EMP_NM,
        RTRIM(ISNULL(j.JOB_DESC, '')) AS JOB_DESC,
        RTRIM(ISNULL(s.SEC_DESC, '')) AS SEC_DESC,
        RTRIM(ISNULL(a.SHIFT, '')) AS CURRENT_SHIFT
      FROM EMP_TABLE e
      LEFT JOIN MS_JOBS j ON RTRIM(e.JOB_CD) = RTRIM(j.JOB_CD)
      LEFT JOIN MS_SEC s ON RTRIM(e.SEC_CD) = RTRIM(s.SEC_CD)
      LEFT JOIN TR_ABSEN a ON RTRIM(a.EMP_CD) = RTRIM(e.EMP_CD) AND CONVERT(date, a.DATE_TRANS) = @dateTrans
      WHERE RTRIM(e.EMP_CD) = @empCd
    `, { empCd, dateTrans });

    if (!empCheck.length) {
      return NextResponse.json({ error: 'Karyawan tidak ditemukan.' }, { status: 404 });
    }

    const employee = empCheck[0];
    const security = isSecurityJob(employee.JOB_DESC, employee.SEC_DESC);
    const detectedShift = security ? detectSecurityShift(cleanWorkIn, cleanWorkOut) : null;
    const shift = correctedShift || detectedShift?.code || employee.CURRENT_SHIFT || null;

    let finalStatusHariInput = (statusHari || employee.STATUS_HARI || '').trim().toUpperCase();
    if (!finalStatusHariInput) {
      const holCheck = await query<any>(`
        SELECT 1 FROM MS_LIBUR_KERJA WHERE CONVERT(varchar(10), TANGGAL, 120) = '${dateTrans}'
      `);
      finalStatusHariInput = holCheck.length > 0 ? 'LIBUR' : 'KERJA';
    }

    // Hitung Ulang JAM_KERJA, OT, dan perbaiki status hari (jika Security Weekend)
    const calcResult = calculateAttendanceAndOt(
      dateTrans,
      workInDate,
      workOutDate,
      employee.JOB_DESC,
      employee.SEC_DESC,
      finalStatusHariInput,
      shift
    );

    await withTransaction(async (tx) => tx(`
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
        JAM_KERJA = @jamKerja,
        STATUS_HARI = @statusHari,
        REASON = @reason,
        SHIFT = @targetShift,
        FLAG_ABSEN = ISNULL(FLAG_ABSEN, 'M'),
        JAM_MASUK = ISNULL(@targetJamMasuk, JAM_MASUK),
        JAM_PULANG = ISNULL(@targetJamPulang, JAM_PULANG),
        Time_Late = CASE 
          WHEN @workIn IS NOT NULL AND @targetJamMasuk IS NOT NULL AND CAST(@workIn AS DATETIME) > @targetJamMasuk 
          THEN 
            CASE 
              WHEN DATEDIFF(MINUTE, @targetJamMasuk, CAST(@workIn AS DATETIME)) <= 120
              THEN CEILING(CAST(DATEDIFF(MINUTE, @targetJamMasuk, CAST(@workIn AS DATETIME)) AS FLOAT) / 30.0) * 0.5
              ELSE CAST(DATEDIFF(MINUTE, @targetJamMasuk, CAST(@workIn AS DATETIME)) AS FLOAT)
            END
          ELSE 0.0
        END,
        POT_JAM = CASE 
          WHEN @workIn IS NOT NULL AND @targetJamMasuk IS NOT NULL AND CAST(@workIn AS DATETIME) > @targetJamMasuk 
          THEN 
            CASE 
              WHEN DATEDIFF(MINUTE, @targetJamMasuk, CAST(@workIn AS DATETIME)) <= 120
              THEN CEILING(CAST(DATEDIFF(MINUTE, @targetJamMasuk, CAST(@workIn AS DATETIME)) AS FLOAT) / 30.0) * 0.5
              ELSE 0.0
            END
          ELSE 0.0
        END,
        OT_1 = @ot1,
        OT_2 = @ot2,
        OT_3 = @ot3,
        OT_4 = @ot4,
        T_OT = @tOt
      WHERE RTRIM(EMP_CD) = @empCd AND CONVERT(date, DATE_TRANS) = @dateTrans;
    `, {
      workIn: cleanWorkIn,
      workOut: cleanWorkOut,
      jamKerja: calcResult.JAM_KERJA,
      statusHari: calcResult.STATUS_HARI,
      reason,
      shift,
      ot1: calcResult.OT_1,
      ot2: calcResult.OT_2,
      ot3: calcResult.OT_3,
      ot4: calcResult.OT_4,
      tOt: calcResult.T_OT,
      empCd,
      dateTrans
    }));

    return NextResponse.json({
      success: true,
      shift: detectedShift?.code || null,
      message: detectedShift ? `Koreksi berhasil. SHIFT terdeteksi: ${detectedShift.code}.` : 'Koreksi absensi berhasil disimpan.'
    });
  } catch (error: any) {
    console.error('API /absensi/koreksi POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
