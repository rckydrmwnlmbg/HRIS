import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const { action, startDate, endDate, empCds } = await request.json();

    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'startDate and endDate are required' }, { status: 400 });
    }

    // Common WHERE clause
    let whereClause = `
      t.STATUS_HARI = 'KERJA'
      AND t.WORK_IN IS NOT NULL AND YEAR(t.WORK_IN) > 2000
      AND t.WORK_OUT IS NOT NULL AND YEAR(t.WORK_OUT) > 2000
      AND t.JAM_MASUK IS NOT NULL AND LTRIM(RTRIM(CAST(t.JAM_MASUK AS VARCHAR(50)))) <> '' AND YEAR(CAST(t.JAM_MASUK AS DATETIME)) > 1900
      AND t.JAM_PULANG IS NOT NULL AND LTRIM(RTRIM(CAST(t.JAM_PULANG AS VARCHAR(50)))) <> '' AND YEAR(CAST(t.JAM_PULANG AS DATETIME)) > 1900
      AND t.DATE_TRANS >= @startDate AND t.DATE_TRANS <= @endDate
    `;

    // Array of string for IN clause if empCds provided
    if (empCds && Array.isArray(empCds) && empCds.length > 0) {
      const empList = empCds.map((e: string) => `'${e.replace(/'/g, "''")}'`).join(',');
      whereClause += ` AND RTRIM(t.EMP_CD) IN (${empList})`;
    }

    // CTE for calculating bounds, OT and proposed times
    const baseQuery = `
      WITH CTE_Base AS (
        SELECT 
          t.ID, t.EMP_CD, t.DATE_TRANS, t.WORK_IN, t.WORK_OUT, 
          t.JAM_KERJA AS CURRENT_JAM_KERJA,
          t.OT_1 AS CURRENT_OT_1,
          t.OT_2 AS CURRENT_OT_2,
          t.T_OT AS CURRENT_T_OT,
          t.JAM_MASUK,
          t.JAM_PULANG,
          
          -- Target Jadwal Masuk & Pulang
          CAST(CONVERT(varchar(10), t.DATE_TRANS, 120) + ' ' + CONVERT(varchar(8), t.JAM_MASUK, 108) AS DATETIME) AS SCH_IN,
          CAST(CONVERT(varchar(10), t.DATE_TRANS, 120) + ' ' + CONVERT(varchar(8), t.JAM_PULANG, 108) AS DATETIME) AS SCH_OUT,
          CASE WHEN UPPER(ISNULL(RTRIM(e.ALL_IN),'0')) IN ('1', 'Y', 'TRUE') THEN 1 ELSE 0 END AS IS_ALL_IN
        FROM TR_ABSEN t
        JOIN EMP_TABLE e ON RTRIM(t.EMP_CD) = RTRIM(e.EMP_CD)
        LEFT JOIN MS_SEC s ON RTRIM(e.SEC_CD) = RTRIM(s.SEC_CD)
        LEFT JOIN MS_JOBS j ON RTRIM(e.JOB_CD) = RTRIM(j.JOB_CD)
        WHERE ${whereClause}
          AND UPPER(ISNULL(RTRIM(j.JOB_DESC),'')) NOT IN ('SECURITY', 'SATPAM')
          AND UPPER(ISNULL(RTRIM(s.SEC_DESC),'')) NOT IN ('SECURITY', 'SATPAM')
      ),
      CTE_Calculated AS (
        SELECT 
          b.*,
          -- Hitung Jam Lembur Bulat (Toleransi 10 mnt sebelum s.d 15 mnt sesudah)
          CASE 
            WHEN DATEDIFF(minute, b.SCH_OUT, b.WORK_OUT) >= 50
              THEN CAST(FLOOR((DATEDIFF(minute, b.SCH_OUT, b.WORK_OUT) + 10) / 60.0) AS INT)
            ELSE 0
          END AS K_OT
        FROM CTE_Base b
      ),
      CTE_Final AS (
        SELECT 
          c.*,
          -- WORK_IN dikoreksi jika bukan ALL IN:
          -- 1. Kepagian (> 10 mnt sebelum jadwal, yaitu < 06:50)
          -- 2. Telat ringan (0 s.d. 15 mnt sesudah jadwal, yaitu 07:00 s.d. 07:15)
          -- Keduanya dinormalisasi ke rentang 06:50:00 s.d. 06:59:59
          -- Untuk ALL IN: Tetap jam kerja riil c.WORK_IN
          CASE 
            WHEN c.IS_ALL_IN = 1 THEN c.WORK_IN
            WHEN DATEDIFF(minute, c.WORK_IN, c.SCH_IN) > 10 
              OR (c.WORK_IN >= c.SCH_IN AND c.WORK_IN <= DATEADD(minute, 15, c.SCH_IN))
              THEN DATEADD(second, CAST(RAND(CHECKSUM(NEWID())) * 599 as int), DATEADD(minute, -10, c.SCH_IN))
            ELSE c.WORK_IN
          END AS PROPOSED_WORK_IN,
          
          -- WORK_OUT dikoreksi ke jendela aman 0..14 menit sesudah jadwal + K_OT (16:00:00 s.d. 16:14:59) jika bukan ALL IN
          -- Untuk ALL IN: Tetap jam pulang riil c.WORK_OUT
          CASE 
            WHEN c.IS_ALL_IN = 1 THEN c.WORK_OUT
            WHEN c.K_OT > 0 
              THEN DATEADD(second, CAST(RAND(CHECKSUM(NEWID())) * 899 as int), DATEADD(hour, c.K_OT, c.SCH_OUT))
            ELSE 
              DATEADD(second, CAST(RAND(CHECKSUM(NEWID())) * 899 as int), c.SCH_OUT)
          END AS PROPOSED_WORK_OUT,
          
          -- OT & JAM_KERJA Bersih (8 jam kerja normal + T_OT)
          CASE WHEN c.K_OT >= 1 THEN 1.0 ELSE 0.0 END AS PROPOSED_OT_1,
          CASE WHEN c.K_OT > 1 THEN CAST(c.K_OT - 1 AS NUMERIC(18,2)) ELSE 0.0 END AS PROPOSED_OT_2,
          CASE WHEN c.K_OT > 0 THEN c.K_OT ELSE 0 END AS PROPOSED_T_OT,
          CASE WHEN c.K_OT > 0 THEN 8 + c.K_OT ELSE 8 END AS PROPOSED_JAM_KERJA
        FROM CTE_Calculated c
      )
    `;

    if (action === 'preview') {
      // Return only rows that ACTUALLY need changes
      const previewSql = `
        ${baseQuery}
        SELECT * FROM CTE_Final
        WHERE WORK_IN <> PROPOSED_WORK_IN 
           OR WORK_OUT <> PROPOSED_WORK_OUT
           OR CURRENT_JAM_KERJA <> PROPOSED_JAM_KERJA
           OR ISNULL(CURRENT_T_OT, 0) <> PROPOSED_T_OT
        ORDER BY DATE_TRANS, EMP_CD
      `;

      const previewData = await query(previewSql, { startDate, endDate });
      return NextResponse.json({ success: true, data: previewData });
    }

    if (action === 'apply') {
      // Execute Atomic Transaction to AUDIT and UPDATE
      const applySql = `
        ${baseQuery}
        BEGIN TRY
          BEGIN TRAN;
          
          -- 1. Insert ke Tabel Audit (Hanya yang akan berubah)
          INSERT INTO TR_AUDIT_ABSEN (
            EMP_CD, DATE_TRANS, 
            OLD_WORK_IN, OLD_WORK_OUT, OLD_JAM_KERJA,
            NEW_WORK_IN, NEW_WORK_OUT, NEW_JAM_KERJA,
            MODIFIED_BY, MODIFIED_DATE, REASON
          )
          SELECT 
            c.EMP_CD, c.DATE_TRANS,
            c.WORK_IN, c.WORK_OUT, c.CURRENT_JAM_KERJA,
            c.PROPOSED_WORK_IN, c.PROPOSED_WORK_OUT, c.PROPOSED_JAM_KERJA,
            'SYSTEM_OT_AUTO', GETDATE(), 'Otomasi Pembulatan Target OT (Integer Rounding)'
          FROM CTE_Final c
          WHERE c.WORK_IN <> c.PROPOSED_WORK_IN 
             OR c.WORK_OUT <> c.PROPOSED_WORK_OUT
             OR c.CURRENT_JAM_KERJA <> c.PROPOSED_JAM_KERJA
             OR ISNULL(c.CURRENT_T_OT, 0) <> c.PROPOSED_T_OT;

          -- 2. Update TR_ABSEN (Hanya yang akan berubah)
          UPDATE t
          SET 
            t.WORK_IN = c.PROPOSED_WORK_IN,
            t.WORK_OUT = c.PROPOSED_WORK_OUT,
            t.OT_1 = c.PROPOSED_OT_1,
            t.OT_2 = c.PROPOSED_OT_2,
            t.OT_3 = 0.0,
            t.OT_4 = 0.0,
            t.OT_5 = 0.0,
            t.OT_6 = 0.0,
            t.T_OT = c.PROPOSED_T_OT,
            t.JAM_KERJA = c.PROPOSED_JAM_KERJA
          FROM TR_ABSEN t
          INNER JOIN CTE_Final c ON t.ID = c.ID
          WHERE c.WORK_IN <> c.PROPOSED_WORK_IN 
             OR c.WORK_OUT <> c.PROPOSED_WORK_OUT
             OR c.CURRENT_JAM_KERJA <> c.PROPOSED_JAM_KERJA
             OR ISNULL(c.CURRENT_T_OT, 0) <> c.PROPOSED_T_OT;
          
          COMMIT TRAN;
        END TRY
        BEGIN CATCH
          IF @@TRANCOUNT > 0
            ROLLBACK TRAN;
            
          DECLARE @ErrorMessage NVARCHAR(4000) = ERROR_MESSAGE();
          DECLARE @ErrorSeverity INT = ERROR_SEVERITY();
          DECLARE @ErrorState INT = ERROR_STATE();
          RAISERROR(@ErrorMessage, @ErrorSeverity, @ErrorState);
        END CATCH;
      `;

      await query(applySql, { startDate, endDate });
      return NextResponse.json({ success: true, message: 'Otomasi OT berhasil diterapkan secara atomic.' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error: any) {
    console.error('API /absensi/otomasi-ot error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
