import fs from 'fs';
import path from 'path';

const routePath = path.join(process.cwd(), 'app/api/absensi/sync-datasolution/route.ts');
let content = fs.readFileSync(routePath, 'utf8');

const startMarker = 'let processedCount = 0;';
const endMarker = '// 4. Log fallbacks to file (not DB)';
const startIndex = content.indexOf(startMarker);
const endIndex = content.indexOf(endMarker);

const newLogic = `
    let processedCount = 0;
    const fallbackLogs: string[] = [];

    dsData.forEach((row: any) => {
      let workIn = row.JamMasuk_I;
      let workOut = row.JamKeluar_O;
      if (!workIn || !workOut) {
        workIn = row.JamMasuk_Fallback;
        workOut = row.JamKeluar_Fallback;
        fallbackLogs.push(\`Fallback: NIK \${row.NIK} tanggal \${row.Tanggal} (Taps: IN=\${row.JamMasuk_I ? 'Yes' : 'No'}, OUT=\${row.JamKeluar_O ? 'Yes' : 'No'})\`);
      }
      row.finalWorkIn = workIn;
      row.finalWorkOut = workOut;
    });

    const singleMergeQuery = \`
      IF EXISTS (
        SELECT 1 FROM EMP_TABLE e 
        LEFT JOIN MS_SEC s ON RTRIM(e.SEC_CD) = RTRIM(s.SEC_CD)
        WHERE RTRIM(e.EMP_CD) = @nik AND (RTRIM(e.SEC_CD) = 'SEC' OR RTRIM(s.SEC_DESC) LIKE '%SECURITY%')
      )
      BEGIN
        RETURN;
      END

      DECLARE @diffMins INT = DATEDIFF(MINUTE, @workIn, @workOut);
      DECLARE @netMins INT = CASE WHEN @diffMins > 60 THEN @diffMins - 60 ELSE 0 END;
      DECLARE @calcJamKerja DECIMAL(5,2) = FLOOR(@netMins / 30.0) * 0.5;
      IF @calcJamKerja < 0 SET @calcJamKerja = 0;

      MERGE TR_ABSEN WITH (HOLDLOCK) AS target
      USING (SELECT @nik AS EMP_CD, @tanggal AS DATE_TRANS) AS source
      ON (target.EMP_CD = source.EMP_CD AND CONVERT(date, target.DATE_TRANS) = CONVERT(date, source.DATE_TRANS))
      WHEN MATCHED THEN 
        UPDATE SET 
          WORK_IN = CASE 
                      WHEN ISNULL(CONVERT(varchar(19), target.WORK_IN, 120), '') <> ISNULL(CONVERT(varchar(19), target.WORK_IN1, 120), '') THEN target.WORK_IN 
                      ELSE ISNULL(@workIn, target.WORK_IN) 
                    END,
          WORK_OUT = CASE 
                      WHEN ISNULL(CONVERT(varchar(19), target.WORK_OUT, 120), '') <> ISNULL(CONVERT(varchar(19), target.WORK_OUT1, 120), '') THEN target.WORK_OUT 
                      ELSE ISNULL(@workOut, target.WORK_OUT) 
                    END,
          WORK_IN1 = ISNULL(@workIn, target.WORK_IN1),
          WORK_OUT1 = ISNULL(@workOut, target.WORK_OUT1),
          DATE_IN = @workIn,
          DATE_OUT = @workOut,
          JAM_MASUK = CONVERT(varchar(5), @workIn, 108),
          JAM_PULANG = CONVERT(varchar(5), @workOut, 108),
          JAM_KERJA = @calcJamKerja,
          HADIR = 1,
          STATUS_HARI = ISNULL(target.STATUS_HARI, 'KERJA'),
          SHIFT = ISNULL(target.SHIFT, '1'),
          FLAG_ABSEN = ISNULL(target.FLAG_ABSEN, 1),
          Time_Late = CASE 
            WHEN @workIn IS NOT NULL AND @workIn > CAST(CONVERT(varchar(10), @workIn, 120) + CASE ISNULL(target.SHIFT, '1') WHEN '2S' THEN ' 11:30:00' WHEN '3S' THEN ' 15:00:00' WHEN '4S' THEN ' 23:00:00' ELSE ' 07:00:00' END AS DATETIME) 
            THEN DATEDIFF(MINUTE, CAST(CONVERT(varchar(10), @workIn, 120) + CASE ISNULL(target.SHIFT, '1') WHEN '2S' THEN ' 11:30:00' WHEN '3S' THEN ' 15:00:00' WHEN '4S' THEN ' 23:00:00' ELSE ' 07:00:00' END AS DATETIME), @workIn) 
            ELSE 0 
          END
      WHEN NOT MATCHED THEN
        INSERT (EMP_CD, DATE_TRANS, WORK_IN, WORK_OUT, WORK_IN1, WORK_OUT1, DATE_IN, DATE_OUT, JAM_MASUK, JAM_PULANG, JAM_KERJA, STATUS_HARI, SHIFT, HADIR, FLAG_ABSEN, Time_Late)
        VALUES (
          @nik, @tanggal, @workIn, @workOut, @workIn, @workOut, @workIn, @workOut, 
          CONVERT(varchar(5), @workIn, 108), CONVERT(varchar(5), @workOut, 108), 
          @calcJamKerja, 'KERJA', '1', 1, 1,
          CASE 
            WHEN @workIn IS NOT NULL AND @workIn > CAST(CONVERT(varchar(10), @workIn, 120) + ' 07:00:00' AS DATETIME) 
            THEN DATEDIFF(MINUTE, CAST(CONVERT(varchar(10), @workIn, 120) + ' 07:00:00' AS DATETIME), @workIn) 
            ELSE 0 
          END
        );
    \`;

    for (let i = 0; i < dsData.length; i += 10) {
      const chunk = dsData.slice(i, i + 10);
      await Promise.all(chunk.map(async (row: any) => {
        await query(singleMergeQuery, {
          nik: String(row.NIK).trim(),
          tanggal: row.Tanggal,
          workIn: row.finalWorkIn || null,
          workOut: row.finalWorkOut || null
        });
        processedCount++;
      }));
    }

    const syncedAbsen = await query<any>(\`
      SELECT a.EMP_CD, a.DATE_TRANS, a.WORK_IN, a.WORK_OUT, a.STATUS_HARI, a.SHIFT,
             e.JOB_CD, j.JOB_DESC, e.SEC_CD, s.SEC_DESC
      FROM TR_ABSEN a
      JOIN EMP_TABLE e ON RTRIM(a.EMP_CD) = RTRIM(e.EMP_CD)
      LEFT JOIN MS_JOBS j ON RTRIM(e.JOB_CD) = RTRIM(j.JOB_CD)
      LEFT JOIN MS_SEC s ON RTRIM(e.SEC_CD) = RTRIM(s.SEC_CD)
      WHERE a.DATE_TRANS >= @startDate AND a.DATE_TRANS < DATEADD(day, 1, @endDate)
        AND a.WORK_IN IS NOT NULL AND a.WORK_OUT IS NOT NULL
    \`, { startDate, endDate });

    const updateOtQuery = \`
      UPDATE TR_ABSEN 
      SET OT_1 = @ot1, OT_2 = @ot2, OT_3 = @ot3, OT_4 = @ot4, T_OT = @tot, JAM_KERJA = @jamKerja
      WHERE RTRIM(EMP_CD) = RTRIM(@nik) AND CONVERT(date, DATE_TRANS) = CONVERT(date, @tanggal)
    \`;

    for (let i = 0; i < syncedAbsen.length; i += 10) {
      const chunk = syncedAbsen.slice(i, i + 10);
      await Promise.all(chunk.map(async (row: any) => {
        const dateStr = new Date(row.DATE_TRANS).toISOString().split('T')[0];
        const ot = calculateAttendanceAndOt(
          dateStr,
          new Date(row.WORK_IN),
          new Date(row.WORK_OUT),
          row.JOB_DESC || '',
          row.SEC_DESC || '',
          row.STATUS_HARI || '',
          row.SHIFT || ''
        );
        
        await query(updateOtQuery, {
          ot1: ot.OT_1, ot2: ot.OT_2, ot3: ot.OT_3, ot4: ot.OT_4, tot: ot.T_OT, jamKerja: ot.JAM_KERJA || 0,
          nik: String(row.EMP_CD).trim(), tanggal: dateStr
        });
      }));
    }
`;

const finalContent = content.substring(0, startIndex) + newLogic + content.substring(endIndex);
fs.writeFileSync(routePath, finalContent, 'utf8');
console.log('Fixed sync route');
