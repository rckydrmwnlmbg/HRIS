import { NextResponse } from 'next/server';
import { query, withTransaction } from '@/lib/db';

/**
 * MESIN SINKRONISASI FINGERPRINT 1-KLIK (REVOLUSI ABSENSI)
 * Fitur:
 * 1. One-Way Sync (Murni SELECT dari Mesin Finger DataSolution)
 * 2. Pemisahan Fakta Skorsing vs Kosmetik OT
 * 3. Toleransi Pengacakan -10m & +15m
 * 4. Perhitungan ALL IN murni (Pembulatan FLOOR tanpa desimal recehan)
 */

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { startDate, endDate, empCd, nik } = body;
    const targetEmpCd = (empCd || nik || '').trim();

    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'Rentang tanggal (startDate & endDate) wajib ditentukan.' }, { status: 400 });
    }

    let queryRes = null;

    await withTransaction(async (tx) => {
      const empCondition = targetEmpCd 
        ? `AND (a.EMP_CD = @targetEmpCd OR RTRIM(a.EMP_CD) = @targetEmpCd)` 
        : `AND (e.Act_NonAct = 1 OR e.Act_NonAct IS NULL)`;

      const sqlUpdate = `
        BEGIN TRY
          -- A. KOREKSI WORK_IN (MASUK KEPAGIAN < 06:50 ATAU TELAT RINGAN 07:00-07:15) -> RANDOMIZE KE 06:50 s.d 06:59 (NON-ALL IN & NON-SECURITY)
          UPDATE a
          SET a.WORK_IN = DATEADD(second, CAST(RAND(CHECKSUM(NEWID())) * 599 as int), 
                            DATEADD(minute, -10, CAST(CONVERT(varchar(10), a.DATE_TRANS, 120) + ' ' + CONVERT(varchar(8), a.JAM_MASUK, 108) AS DATETIME)))
          FROM TR_ABSEN a
          LEFT JOIN EMP_TABLE e ON RTRIM(a.EMP_CD) = RTRIM(e.EMP_CD)
          LEFT JOIN MS_SEC s ON RTRIM(e.SEC_CD) = RTRIM(s.SEC_CD)
          LEFT JOIN MS_JOBS j ON RTRIM(e.JOB_CD) = RTRIM(j.JOB_CD)
          WHERE a.DATE_TRANS >= @startDate AND a.DATE_TRANS <= @endDate
            ${empCondition}
            AND COALESCE(a.WORK_IN1, a.WORK_IN) IS NOT NULL 
            AND a.JAM_MASUK IS NOT NULL
            AND UPPER(ISNULL(RTRIM(e.ALL_IN),'0')) NOT IN ('1', 'Y', 'TRUE')
            AND UPPER(ISNULL(RTRIM(j.JOB_DESC),'')) NOT IN ('SECURITY', 'SATPAM')
            AND UPPER(ISNULL(RTRIM(s.SEC_DESC),'')) NOT IN ('SECURITY', 'SATPAM')
            AND (
              -- Kepagian: > 10 menit sebelum jadwal (Tap < 06:50 jika jadwal 07:00)
              DATEDIFF(minute, CAST(CONVERT(varchar(10), a.DATE_TRANS, 120) + ' ' + CONVERT(varchar(8), COALESCE(a.WORK_IN1, a.WORK_IN), 108) AS DATETIME), CAST(CONVERT(varchar(10), a.DATE_TRANS, 120) + ' ' + CONVERT(varchar(8), a.JAM_MASUK, 108) AS DATETIME)) > 10
              OR
              -- Telat Ringan: 0 s.d 15 menit sesudah jadwal (Tap 07:00 s.d 07:15 jika jadwal 07:00)
              (
                CAST(CONVERT(varchar(10), a.DATE_TRANS, 120) + ' ' + CONVERT(varchar(8), COALESCE(a.WORK_IN1, a.WORK_IN), 108) AS DATETIME) >= CAST(CONVERT(varchar(10), a.DATE_TRANS, 120) + ' ' + CONVERT(varchar(8), a.JAM_MASUK, 108) AS DATETIME)
                AND
                CAST(CONVERT(varchar(10), a.DATE_TRANS, 120) + ' ' + CONVERT(varchar(8), COALESCE(a.WORK_IN1, a.WORK_IN), 108) AS DATETIME) <= DATEADD(minute, 15, CAST(CONVERT(varchar(10), a.DATE_TRANS, 120) + ' ' + CONVERT(varchar(8), a.JAM_MASUK, 108) AS DATETIME))
              )
            );
            
          -- B. KOREKSI WORK_OUT (PULANG NANGGUNG & KOREKSI OT BULAT) — REGULER (NON-ALL IN & NON-SECURITY)
          WITH CalcRegOT AS (
            SELECT 
              a.WORK_OUT,
              a.OT_1,
              a.OT_2,
              a.OT_3,
              a.OT_4,
              a.OT_5,
              a.OT_6,
              a.T_OT,
              a.JAM_KERJA,
              CASE 
                WHEN DATEDIFF(minute, CAST(CONVERT(varchar(10), a.DATE_TRANS, 120) + ' ' + CONVERT(varchar(8), a.JAM_PULANG, 108) AS DATETIME), COALESCE(a.WORK_OUT1, a.WORK_OUT)) >= 50
                  THEN CAST(FLOOR((DATEDIFF(minute, CAST(CONVERT(varchar(10), a.DATE_TRANS, 120) + ' ' + CONVERT(varchar(8), a.JAM_PULANG, 108) AS DATETIME), COALESCE(a.WORK_OUT1, a.WORK_OUT)) + 10) / 60.0) AS INT)
                ELSE 0
              END AS K_OT,
              CAST(CONVERT(varchar(10), a.DATE_TRANS, 120) + ' ' + CONVERT(varchar(8), a.JAM_PULANG, 108) AS DATETIME) AS TARGET_SCH_OUT
            FROM TR_ABSEN a
            LEFT JOIN EMP_TABLE e ON RTRIM(a.EMP_CD) = RTRIM(e.EMP_CD)
            LEFT JOIN MS_SEC s ON RTRIM(e.SEC_CD) = RTRIM(s.SEC_CD)
            LEFT JOIN MS_JOBS j ON RTRIM(e.JOB_CD) = RTRIM(j.JOB_CD)
            WHERE a.DATE_TRANS >= @startDate AND a.DATE_TRANS <= @endDate
              ${empCondition}
              AND COALESCE(a.WORK_OUT1, a.WORK_OUT) IS NOT NULL 
              AND a.JAM_PULANG IS NOT NULL
              AND RTRIM(a.STATUS_HARI) IN ('KERJA', 'O')
              AND UPPER(ISNULL(RTRIM(e.ALL_IN),'0')) NOT IN ('1', 'Y', 'TRUE')
              AND UPPER(ISNULL(RTRIM(j.JOB_DESC),'')) NOT IN ('SECURITY', 'SATPAM')
              AND UPPER(ISNULL(RTRIM(s.SEC_DESC),'')) NOT IN ('SECURITY', 'SATPAM')
          )
          UPDATE CalcRegOT
          SET 
            WORK_OUT = CASE 
              WHEN K_OT > 0 THEN 
                DATEADD(second, CAST(RAND(CHECKSUM(NEWID())) * 899 as int), DATEADD(hour, K_OT, TARGET_SCH_OUT))
              ELSE 
                DATEADD(second, CAST(RAND(CHECKSUM(NEWID())) * 899 as int), TARGET_SCH_OUT)
            END,
            OT_1 = CASE WHEN K_OT >= 1 THEN 1.0 ELSE 0.0 END,
            OT_2 = CASE WHEN K_OT > 1 THEN CAST(K_OT - 1 AS NUMERIC(18,2)) ELSE 0.0 END,
            OT_3 = 0.0,
            OT_4 = 0.0,
            OT_5 = 0.0,
            OT_6 = 0.0,
            T_OT = CASE WHEN K_OT > 0 THEN K_OT ELSE 0 END,
            JAM_KERJA = CASE WHEN K_OT > 0 THEN 8 + K_OT ELSE 8 END;

          -- C. KOREKSI OT HARI LIBUR / WEEKEND (DISTRIBUSI OT_2, OT_3, OT_4) (NON-SECURITY)
          WITH CalcWeekendOT AS (
            SELECT 
              a.OT_1,
              a.OT_2,
              a.OT_3,
              a.OT_4,
              a.OT_5,
              a.OT_6,
              a.T_OT,
              a.JAM_KERJA,
              CASE 
                WHEN DATEDIFF(minute, COALESCE(a.WORK_IN1, a.WORK_IN), COALESCE(a.WORK_OUT1, a.WORK_OUT)) >= 300
                  THEN CAST(FLOOR((DATEDIFF(minute, COALESCE(a.WORK_IN1, a.WORK_IN), COALESCE(a.WORK_OUT1, a.WORK_OUT)) - 60 + 10) / 60.0) AS INT)
                WHEN DATEDIFF(minute, COALESCE(a.WORK_IN1, a.WORK_IN), COALESCE(a.WORK_OUT1, a.WORK_OUT)) >= 50
                  THEN CAST(FLOOR((DATEDIFF(minute, COALESCE(a.WORK_IN1, a.WORK_IN), COALESCE(a.WORK_OUT1, a.WORK_OUT)) + 10) / 60.0) AS INT)
                ELSE 0
              END AS K_OT
            FROM TR_ABSEN a
            LEFT JOIN EMP_TABLE e ON RTRIM(a.EMP_CD) = RTRIM(e.EMP_CD)
            LEFT JOIN MS_SEC s ON RTRIM(e.SEC_CD) = RTRIM(s.SEC_CD)
            LEFT JOIN MS_JOBS j ON RTRIM(e.JOB_CD) = RTRIM(j.JOB_CD)
            WHERE a.DATE_TRANS >= @startDate AND a.DATE_TRANS <= @endDate
              ${empCondition}
              AND COALESCE(a.WORK_OUT1, a.WORK_OUT) IS NOT NULL 
              AND COALESCE(a.WORK_IN1, a.WORK_IN) IS NOT NULL
              AND (RTRIM(a.STATUS_HARI) IN ('LIBUR', 'OFF', 'H') OR DATENAME(dw, a.DATE_TRANS) IN ('Saturday', 'Sunday'))
              AND UPPER(ISNULL(RTRIM(j.JOB_DESC),'')) NOT IN ('SECURITY', 'SATPAM')
              AND UPPER(ISNULL(RTRIM(s.SEC_DESC),'')) NOT IN ('SECURITY', 'SATPAM')
          )
          UPDATE CalcWeekendOT
          SET 
            OT_1 = 0.0,
            OT_2 = CASE WHEN K_OT > 8 THEN 8.0 ELSE CAST(K_OT AS NUMERIC(18,2)) END,
            OT_3 = CASE WHEN K_OT >= 9 THEN 1.0 ELSE 0.0 END,
            OT_4 = CASE WHEN K_OT >= 10 THEN CAST(K_OT - 9 AS NUMERIC(18,2)) ELSE 0.0 END,
            OT_5 = 0.0,
            OT_6 = 0.0,
            T_OT = K_OT,
            JAM_KERJA = K_OT;

          -- D. KARYAWAN ALL IN: KEMBALIKAN JAM MASUK & PULANG KE REKAMAN RIIL DAN HITUNG LEMBUR NORMAL
          WITH CalcAllInOT AS (
            SELECT 
              a.WORK_IN,
              a.WORK_OUT,
              a.WORK_IN1,
              a.WORK_OUT1,
              a.OT_1,
              a.OT_2,
              a.OT_3,
              a.OT_4,
              a.OT_5,
              a.OT_6,
              a.T_OT,
              a.JAM_KERJA,
              CASE 
                WHEN RTRIM(a.STATUS_HARI) IN ('KERJA', 'O') 
                     AND a.JAM_PULANG IS NOT NULL 
                     AND COALESCE(a.WORK_OUT1, a.WORK_OUT) IS NOT NULL
                     AND DATEDIFF(minute, CAST(CONVERT(varchar(10), a.DATE_TRANS, 120) + ' ' + CONVERT(varchar(8), a.JAM_PULANG, 108) AS DATETIME), COALESCE(a.WORK_OUT1, a.WORK_OUT)) >= 50
                  THEN CAST(FLOOR((DATEDIFF(minute, CAST(CONVERT(varchar(10), a.DATE_TRANS, 120) + ' ' + CONVERT(varchar(8), a.JAM_PULANG, 108) AS DATETIME), COALESCE(a.WORK_OUT1, a.WORK_OUT)) + 10) / 60.0) AS INT)
                ELSE 0
              END AS K_OT
            FROM TR_ABSEN a
            LEFT JOIN EMP_TABLE e ON RTRIM(a.EMP_CD) = RTRIM(e.EMP_CD)
            LEFT JOIN MS_SEC s ON RTRIM(e.SEC_CD) = RTRIM(s.SEC_CD)
            LEFT JOIN MS_JOBS j ON RTRIM(e.JOB_CD) = RTRIM(j.JOB_CD)
            WHERE a.DATE_TRANS >= @startDate AND a.DATE_TRANS <= @endDate
              ${empCondition}
              AND UPPER(ISNULL(RTRIM(e.ALL_IN),'0')) IN ('1', 'Y', 'TRUE')
              AND UPPER(ISNULL(RTRIM(j.JOB_DESC),'')) NOT IN ('SECURITY', 'SATPAM')
              AND UPPER(ISNULL(RTRIM(s.SEC_DESC),'')) NOT IN ('SECURITY', 'SATPAM')
          )
          UPDATE CalcAllInOT
          SET 
            WORK_IN = COALESCE(WORK_IN1, WORK_IN),
            WORK_OUT = COALESCE(WORK_OUT1, WORK_OUT),
            OT_1 = CASE WHEN K_OT >= 1 THEN 1.0 ELSE 0.0 END,
            OT_2 = CASE WHEN K_OT > 1 THEN CAST(K_OT - 1 AS NUMERIC(18,2)) ELSE 0.0 END,
            OT_3 = 0.0,
            OT_4 = 0.0,
            OT_5 = 0.0,
            OT_6 = 0.0,
            T_OT = CASE WHEN K_OT > 0 THEN K_OT ELSE 0 END,
            JAM_KERJA = CASE WHEN K_OT > 0 THEN 8 + K_OT ELSE 8 END;

        END TRY
        BEGIN CATCH
          THROW;
        END CATCH
      `;
      
      const params: any = { startDate, endDate };
      if (targetEmpCd) {
        params.targetEmpCd = targetEmpCd;
      }

      queryRes = await tx(sqlUpdate, params);
    });

    return NextResponse.json({ 
      success: true, 
      message: targetEmpCd 
        ? `Sinkronisasi presensi untuk NIK ${targetEmpCd} berhasil diselesaikan.`
        : 'Sinkronisasi presensi berhasil diselesaikan.'
    });

  } catch (error: any) {
    console.error('API /absensi/sync-finger error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
