import fs from 'fs';
import path from 'path';

const routePath = path.join(process.cwd(), 'app/api/absensi/sync-datasolution/route.ts');
let content = fs.readFileSync(routePath, 'utf8');

const startMarker = 'let processedCount = 0;';
const endMarker = '// 4. Log fallbacks to file (not DB)';
const startIndex = content.indexOf(startMarker);
const endIndex = content.indexOf(endMarker);

if (startIndex === -1 || endIndex === -1) {
  console.error("Markers not found");
  process.exit(1);
}

const newLogic = `
    let processedCount = 0;
    const fallbackLogs: string[] = [];

    // Pre-process dsData fallbacks
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

    // 2. Process records in BATCHES
    await withTransaction(async (tx) => {
      const chunkSize = 50;
      
      // -- A. BATCH MERGE --
      for (let i = 0; i < dsData.length; i += chunkSize) {
        const chunk = dsData.slice(i, i + chunkSize);
        let batchSql = '';
        let batchParams: any = {};

        chunk.forEach((row: any, idx: number) => {
          batchParams[\`nik\${idx}\`] = String(row.NIK).trim();
          batchParams[\`tanggal\${idx}\`] = row.Tanggal;
          batchParams[\`workIn\${idx}\`] = row.finalWorkIn;
          batchParams[\`workOut\${idx}\`] = row.finalWorkOut;

          batchSql += \`
            IF NOT EXISTS (
              SELECT 1 FROM EMP_TABLE e 
              LEFT JOIN MS_SEC s ON RTRIM(e.SEC_CD) = RTRIM(s.SEC_CD)
              WHERE RTRIM(e.EMP_CD) = @nik\${idx} AND (RTRIM(e.SEC_CD) = 'SEC' OR RTRIM(s.SEC_DESC) LIKE '%SECURITY%')
            )
            BEGIN
              DECLARE @diffMins\${idx} INT = DATEDIFF(MINUTE, @workIn\${idx}, @workOut\${idx});
              DECLARE @netMins\${idx} INT = CASE WHEN @diffMins\${idx} > 60 THEN @diffMins\${idx} - 60 ELSE 0 END;
              DECLARE @calcJamKerja\${idx} DECIMAL(5,2) = FLOOR(@netMins\${idx} / 30.0) * 0.5;
              IF @calcJamKerja\${idx} < 0 SET @calcJamKerja\${idx} = 0;

              MERGE TR_ABSEN WITH (HOLDLOCK) AS target
              USING (SELECT @nik\${idx} AS EMP_CD, @tanggal\${idx} AS DATE_TRANS) AS source
              ON (RTRIM(target.EMP_CD) = RTRIM(source.EMP_CD) AND CONVERT(date, target.DATE_TRANS) = CONVERT(date, source.DATE_TRANS))
              WHEN MATCHED THEN 
                UPDATE SET 
                  WORK_IN = CASE 
                              WHEN ISNULL(CONVERT(varchar(19), target.WORK_IN, 120), '') <> ISNULL(CONVERT(varchar(19), target.WORK_IN1, 120), '') THEN target.WORK_IN 
                              ELSE ISNULL(@workIn\${idx}, target.WORK_IN) 
                            END,
                  WORK_OUT = CASE 
                              WHEN ISNULL(CONVERT(varchar(19), target.WORK_OUT, 120), '') <> ISNULL(CONVERT(varchar(19), target.WORK_OUT1, 120), '') THEN target.WORK_OUT 
                              ELSE ISNULL(@workOut\${idx}, target.WORK_OUT) 
                            END,
                  WORK_IN1 = ISNULL(@workIn\${idx}, target.WORK_IN1),
                  WORK_OUT1 = ISNULL(@workOut\${idx}, target.WORK_OUT1),
                  DATE_IN = @workIn\${idx},
                  DATE_OUT = @workOut\${idx},
                  JAM_MASUK = CONVERT(varchar(5), @workIn\${idx}, 108),
                  JAM_PULANG = CONVERT(varchar(5), @workOut\${idx}, 108),
                  JAM_KERJA = @calcJamKerja\${idx},
                  HADIR = 1,
                  STATUS_HARI = ISNULL(target.STATUS_HARI, 'KERJA'),
                  SHIFT = ISNULL(target.SHIFT, '1'),
                  FLAG_ABSEN = ISNULL(target.FLAG_ABSEN, 1),
                  Time_Late = CASE 
                    WHEN @workIn\${idx} IS NOT NULL AND @workIn\${idx} > CAST(CONVERT(varchar(10), @workIn\${idx}, 120) + CASE ISNULL(target.SHIFT, '1') WHEN '2S' THEN ' 11:30:00' WHEN '3S' THEN ' 15:00:00' WHEN '4S' THEN ' 23:00:00' ELSE ' 07:00:00' END AS DATETIME) 
                    THEN DATEDIFF(MINUTE, CAST(CONVERT(varchar(10), @workIn\${idx}, 120) + CASE ISNULL(target.SHIFT, '1') WHEN '2S' THEN ' 11:30:00' WHEN '3S' THEN ' 15:00:00' WHEN '4S' THEN ' 23:00:00' ELSE ' 07:00:00' END AS DATETIME), @workIn\${idx}) 
                    ELSE 0 
                  END
              WHEN NOT MATCHED THEN
                INSERT (EMP_CD, DATE_TRANS, WORK_IN, WORK_OUT, WORK_IN1, WORK_OUT1, DATE_IN, DATE_OUT, JAM_MASUK, JAM_PULANG, JAM_KERJA, STATUS_HARI, SHIFT, HADIR, FLAG_ABSEN, Time_Late)
                VALUES (
                  @nik\${idx}, @tanggal\${idx}, @workIn\${idx}, @workOut\${idx}, @workIn\${idx}, @workOut\${idx}, @workIn\${idx}, @workOut\${idx}, 
                  CONVERT(varchar(5), @workIn\${idx}, 108), CONVERT(varchar(5), @workOut\${idx}, 108), 
                  @calcJamKerja\${idx}, 'KERJA', '1', 1, 1,
                  CASE 
                    WHEN @workIn\${idx} IS NOT NULL AND @workIn\${idx} > CAST(CONVERT(varchar(10), @workIn\${idx}, 120) + ' 07:00:00' AS DATETIME) 
                    THEN DATEDIFF(MINUTE, CAST(CONVERT(varchar(10), @workIn\${idx}, 120) + ' 07:00:00' AS DATETIME), @workIn\${idx}) 
                    ELSE 0 
                  END
                );
            END;
          \`;
          processedCount++;
        });

        await tx(batchSql, batchParams);
      }

      // -- B. BATCH UPDATE (Lembur OT) --
      const syncedAbsen = await tx<any>(\`
        SELECT a.EMP_CD, a.DATE_TRANS, a.WORK_IN, a.WORK_OUT, a.STATUS_HARI, a.SHIFT,
               e.JOB_CD, j.JOB_DESC, e.SEC_CD, s.SEC_DESC
        FROM TR_ABSEN a
        JOIN EMP_TABLE e ON RTRIM(a.EMP_CD) = RTRIM(e.EMP_CD)
        LEFT JOIN MS_JOBS j ON RTRIM(e.JOB_CD) = RTRIM(j.JOB_CD)
        LEFT JOIN MS_SEC s ON RTRIM(e.SEC_CD) = RTRIM(s.SEC_CD)
        WHERE a.DATE_TRANS >= @startDate AND a.DATE_TRANS < DATEADD(day, 1, @endDate)
          AND a.WORK_IN IS NOT NULL AND a.WORK_OUT IS NOT NULL
      \`, { startDate, endDate });

      for (let i = 0; i < syncedAbsen.length; i += chunkSize) {
        const chunk = syncedAbsen.slice(i, i + chunkSize);
        let batchSql = '';
        let batchParams: any = {};

        chunk.forEach((row: any, idx: number) => {
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
          
          batchParams[\`ot1_\${idx}\`] = ot.OT_1;
          batchParams[\`ot2_\${idx}\`] = ot.OT_2;
          batchParams[\`ot3_\${idx}\`] = ot.OT_3;
          batchParams[\`ot4_\${idx}\`] = ot.OT_4;
          batchParams[\`tot_\${idx}\`] = ot.T_OT;
          batchParams[\`jamKerja_\${idx}\`] = ot.JAM_KERJA;
          batchParams[\`nik_\${idx}\`] = row.EMP_CD.trim();
          batchParams[\`tanggal_\${idx}\`] = dateStr;

          batchSql += \`
            UPDATE TR_ABSEN 
            SET OT_1 = @ot1_\${idx}, OT_2 = @ot2_\${idx}, OT_3 = @ot3_\${idx}, OT_4 = @ot4_\${idx}, T_OT = @tot_\${idx}, JAM_KERJA = @jamKerja_\${idx}
            WHERE RTRIM(EMP_CD) = RTRIM(@nik_\${idx}) AND CONVERT(date, DATE_TRANS) = CONVERT(date, @tanggal_\${idx});
          \`;
        });

        await tx(batchSql, batchParams);
      }
    });

    `;

const finalContent = content.substring(0, startIndex) + newLogic + content.substring(endIndex);

fs.writeFileSync(routePath, finalContent, 'utf8');
console.log('Done rewriting.');
