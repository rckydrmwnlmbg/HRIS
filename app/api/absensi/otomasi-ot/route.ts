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

    // CTE for calculating bounds and proposed times
    const baseQuery = `
      WITH CTE_Bounds AS (
        SELECT 
          t.ID, t.EMP_CD, t.DATE_TRANS, t.WORK_IN, t.WORK_OUT, t.JAM_KERJA AS CURRENT_JAM_KERJA,
          t.JAM_MASUK,
          t.JAM_PULANG,
          
          -- Hitung Bounds IN berdasarkan tanggal aktual WORK_IN
          DATEADD(minute, -10, CAST(CAST(t.WORK_IN AS DATE) AS DATETIME) + CAST(t.JAM_MASUK AS TIME)) AS IN_LOWER_BOUND,
          DATEADD(minute, 15, CAST(CAST(t.WORK_IN AS DATE) AS DATETIME) + CAST(t.JAM_MASUK AS TIME)) AS IN_UPPER_BOUND,
          
          -- Hitung Bounds OUT berdasarkan tanggal aktual WORK_OUT (Aman untuk Lintas Malam)
          DATEADD(minute, -10, CAST(CAST(t.WORK_OUT AS DATE) AS DATETIME) + CAST(t.JAM_PULANG AS TIME)) AS OUT_LOWER_BOUND,
          DATEADD(minute, 15, CAST(CAST(t.WORK_OUT AS DATE) AS DATETIME) + CAST(t.JAM_PULANG AS TIME)) AS OUT_UPPER_BOUND
        FROM TR_ABSEN t
        JOIN EMP_TABLE e ON RTRIM(t.EMP_CD) = RTRIM(e.EMP_CD)
        WHERE ${whereClause}
      ),
      CTE_Proposed AS (
        SELECT 
          *,
          CASE 
            WHEN WORK_IN < IN_LOWER_BOUND THEN IN_LOWER_BOUND
            WHEN WORK_IN > IN_UPPER_BOUND THEN IN_UPPER_BOUND
            ELSE WORK_IN
          END AS PROPOSED_WORK_IN,
          
          CASE 
            WHEN WORK_OUT < OUT_LOWER_BOUND THEN OUT_LOWER_BOUND
            WHEN WORK_OUT > OUT_UPPER_BOUND THEN OUT_UPPER_BOUND
            ELSE WORK_OUT
          END AS PROPOSED_WORK_OUT
        FROM CTE_Bounds
      ),
      CTE_Final AS (
        SELECT 
          *,
          -- Hitung JAM_KERJA baru dengan rumus desimal murni +0.50 berdasarkan PROPOSED_WORK_IN dan PROPOSED_WORK_OUT
          CASE 
            WHEN (DATEDIFF(minute, PROPOSED_WORK_IN, PROPOSED_WORK_OUT) / 60.0) - FLOOR(DATEDIFF(minute, PROPOSED_WORK_IN, PROPOSED_WORK_OUT) / 60.0) < 0.50 
            THEN FLOOR(DATEDIFF(minute, PROPOSED_WORK_IN, PROPOSED_WORK_OUT) / 60.0) 
            ELSE FLOOR(DATEDIFF(minute, PROPOSED_WORK_IN, PROPOSED_WORK_OUT) / 60.0) + 0.50 
          END AS PROPOSED_JAM_KERJA
        FROM CTE_Proposed
      )
    `;

    if (action === 'preview') {
      // Return only rows that ACTUALLY need changes
      const previewSql = `
        ${baseQuery}
        SELECT * FROM CTE_Final
        WHERE WORK_IN <> PROPOSED_WORK_IN OR WORK_OUT <> PROPOSED_WORK_OUT
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
            'SYSTEM_OT_AUTO', GETDATE(), 'Otomasi Pembulatan Target OT (Closest Boundary)'
          FROM CTE_Final c
          WHERE c.WORK_IN <> c.PROPOSED_WORK_IN OR c.WORK_OUT <> c.PROPOSED_WORK_OUT;

          -- 2. Update TR_ABSEN (Hanya yang akan berubah)
          UPDATE t
          SET 
            t.WORK_IN = c.PROPOSED_WORK_IN,
            t.WORK_OUT = c.PROPOSED_WORK_OUT,
            t.JAM_KERJA = c.PROPOSED_JAM_KERJA
          FROM TR_ABSEN t
          INNER JOIN CTE_Final c ON t.ID = c.ID
          WHERE c.WORK_IN <> c.PROPOSED_WORK_IN OR c.WORK_OUT <> c.PROPOSED_WORK_OUT;
          
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
