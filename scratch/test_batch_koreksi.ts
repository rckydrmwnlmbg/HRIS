import * as fs from 'fs';
import * as path from 'path';

const envContent = fs.readFileSync(path.join(__dirname, '../.env.local'), 'utf8');
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
    const idx = trimmed.indexOf('=');
    const key = trimmed.substring(0, idx).trim();
    const val = trimmed.substring(idx + 1).trim().replace(/^["']|["']$/g, '');
    process.env[key] = val;
  }
}
process.env.NODE_ENV = 'development';
process.env.DATA_MODE = 'live';
if (!process.env.DB_ODBC_DRIVER) {
  process.env.DB_ODBC_DRIVER = 'SQL Server';
}

async function main() {
  const { query, withTransaction } = await import('../lib/db');
  const { calculateAttendanceAndOt } = await import('../lib/otCalculator');
  const { detectSecurityShift, isSecurityJob } = await import('../lib/securitySchedule');

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

  console.log('Testing Batch Koreksi with Transaction...');

  // Ambil contoh data absensi 1 karyawan untuk 5 hari
  const sampleRows = await query<any>(`
    SELECT TOP 5 
      RTRIM(EMP_CD) AS EMP_CD,
      CONVERT(varchar(10), DATE_TRANS, 120) AS DATE_TRANS,
      STATUS_HARI,
      SHIFT,
      CONVERT(varchar(19), WORK_IN, 120) AS WORK_IN,
      CONVERT(varchar(19), WORK_OUT, 120) AS WORK_OUT
    FROM TR_ABSEN WITH (NOLOCK)
    WHERE EMP_CD IS NOT NULL AND EMP_CD <> ''
    ORDER BY DATE_TRANS DESC
  `);

  if (!sampleRows.length) {
    console.log('No rows found in TR_ABSEN.');
    return;
  }

  console.log(`Found ${sampleRows.length} sample rows.`);

  const items = sampleRows.map(r => ({
    EMP_CD: r.EMP_CD,
    DATE_TRANS: r.DATE_TRANS,
    WORK_IN: r.WORK_IN ? `${r.WORK_IN.replace(' ', 'T')}.000` : null,
    WORK_OUT: r.WORK_OUT ? `${r.WORK_OUT.replace(' ', 'T')}.000` : null,
    corrected_status: r.STATUS_HARI,
    corrected_reason: null,
    corrected_shift: r.SHIFT,
    correction_by: 'test_batch'
  }));

  // Step 1: Pre-fetch employee metadata
  const empCds = Array.from(new Set(items.map(i => i.EMP_CD)));
  const empMap = new Map<string, any>();

  for (const empCd of empCds) {
    const empRows = await query<any>(`
      SELECT TOP 1
        RTRIM(e.EMP_NM) AS EMP_NM,
        RTRIM(ISNULL(j.JOB_DESC, '')) AS JOB_DESC,
        RTRIM(ISNULL(s.SEC_DESC, '')) AS SEC_DESC
      FROM EMP_TABLE e WITH (NOLOCK)
      LEFT JOIN MS_JOBS j WITH (NOLOCK) ON RTRIM(e.JOB_CD) = RTRIM(j.JOB_CD)
      LEFT JOIN MS_SEC s WITH (NOLOCK) ON RTRIM(e.SEC_CD) = RTRIM(s.SEC_CD)
      WHERE RTRIM(e.EMP_CD) = @empCd
    `, { empCd });
    if (empRows.length) {
      empMap.set(empCd, empRows[0]);
    }
  }

  // Step 2: Pre-fetch holidays
  const holidayRows = await query<any>(`
    SELECT CONVERT(varchar(10), TANGGAL, 120) AS TANGGAL
    FROM MS_LIBUR_KERJA WITH (NOLOCK)
  `);
  const holidaySet = new Set(holidayRows.map(h => h.TANGGAL));

  console.log(`Pre-fetched ${empMap.size} employees, ${holidaySet.size} holidays.`);

  const startTime = Date.now();

  // Execute inside withTransaction - ONLY tx calls!
  await withTransaction(async (tx) => {
    for (const item of items) {
      const empCd = String(item.EMP_CD || '').trim();
      const dateTrans = String(item.DATE_TRANS || '').split('T')[0];
      const statusHari = item.corrected_status == null || item.corrected_status === '' ? null : String(item.corrected_status).trim();
      const reason = item.corrected_reason == null || item.corrected_reason === '' ? null : String(item.corrected_reason).trim();
      const correctedShift = item.corrected_shift == null || item.corrected_shift === '' ? null : String(item.corrected_shift).trim();
      const correctionBy = String(item.correction_by || 'lusi').trim() || 'lusi';

      let workInDate = parseCorrectEpoch(item.WORK_IN);
      let workOutDate = parseCorrectEpoch(item.WORK_OUT);

      const isLeaveOrSick = reason && !['01', '03', '04', '20', '21'].includes(reason);
      if (isLeaveOrSick) {
        workInDate = null;
        workOutDate = null;
      }

      if (workInDate && workOutDate && workOutDate <= workInDate) {
        const inferredMinutes = (workOutDate.getHours() * 60 + workOutDate.getMinutes()) + 1440 - (workInDate.getHours() * 60 + workInDate.getMinutes());
        const isOvernightCandidate = workInDate.getHours() >= 14 && inferredMinutes >= 4 * 60 && inferredMinutes <= 16 * 60;
        if (isOvernightCandidate) {
          workOutDate.setDate(workOutDate.getDate() + 1);
        }
      }

      const cleanWorkIn = toWibString(workInDate);
      const cleanWorkOut = toWibString(workOutDate);

      const employee = empMap.get(empCd) || { JOB_DESC: '', SEC_DESC: '' };
      const security = isSecurityJob(employee.JOB_DESC, employee.SEC_DESC);
      const detectedShift = security ? detectSecurityShift(cleanWorkIn, cleanWorkOut) : null;
      const shift = correctedShift || detectedShift?.code || null;

      let finalStatusHariInput = (statusHari || '').trim().toUpperCase();
      if (!finalStatusHariInput) {
        finalStatusHariInput = holidaySet.has(dateTrans) ? 'LIBUR' : 'KERJA';
      }

      const calcResult = calculateAttendanceAndOt(
        dateTrans,
        workInDate,
        workOutDate,
        employee.JOB_DESC,
        employee.SEC_DESC,
        finalStatusHariInput,
        shift
      );

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
        workIn: cleanWorkIn,
        workOut: cleanWorkOut,
        jamKerja: finalJamKerja,
        statusHari: statusHari || calcResult.STATUS_HARI,
        reason,
        shift,
        ot1: calcResult.OT_1,
        ot2: calcResult.OT_2,
        ot3: calcResult.OT_3,
        ot4: calcResult.OT_4,
        tOt: calcResult.T_OT,
        correctionBy,
        empCd,
        dateTrans
      });
      console.log(`Updated row for ${empCd} on ${dateTrans}`);
    }
  });

  const duration = Date.now() - startTime;
  console.log(`Batch Koreksi Transaction completed successfully in ${duration}ms!`);
}

main().then(() => process.exit(0)).catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
