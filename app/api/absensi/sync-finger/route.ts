import { NextResponse } from 'next/server';
import { query, withTransaction } from '@/lib/db';

/**
 * MESIN SINKRONISASI FINGERPRINT 1-KLIK (HRIS WIDY)
 * Fitur Utama:
 * 1. MERGE WITH (HOLDLOCK) untuk memastikan baris TR_ABSEN yang belum ada dibuat secara atomic tanpa race-condition.
 * 2. Normalisasi Waktu Masuk (06:50 - 06:59) dan Pulang Aman ([k*60, k*60+14] mnt) untuk Karyawan Harian Reguler.
 * 3. Karyawan ALL IN tetap menggunakan data riil (WORK_IN1 / WORK_OUT1).
 * 4. PENGECUALIAN TOTAL (Total Exclusion) untuk Divisi SECURITY / SATPAM.
 * 5. Perhitungan JAM_KERJA murni dihitung dari DATEDIFF(WORK_IN, WORK_OUT) dengan rumus desimal (+0.50).
 * 6. TIDAK MENYENTUH kolom lembur (OT_1..OT_4, T_OT, STDJAM) agar 100% dihitung oleh modul INUS.
 */

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { startDate, endDate, empCd, nik } = body;
    const targetEmpCd = (empCd || nik || '').trim();

    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'Rentang tanggal (startDate & endDate) wajib ditentukan.' }, { status: 400 });
    }

    // Pengecekan jika targetEmpCd adalah SECURITY, tolak segera dengan pesan proteksi
    if (targetEmpCd) {
      const empCheck = await query<any>(`
        SELECT 
          RTRIM(e.EMP_CD) AS EMP_CD, 
          RTRIM(e.EMP_NM) AS EMP_NM, 
          RTRIM(ISNULL(j.JOB_DESC, '')) AS JOB_DESC, 
          RTRIM(ISNULL(s.SEC_DESC, '')) AS SEC_DESC
        FROM EMP_TABLE e
        LEFT JOIN MS_JOBS j ON RTRIM(e.JOB_CD) = RTRIM(j.JOB_CD)
        LEFT JOIN MS_SEC s ON RTRIM(e.SEC_CD) = RTRIM(s.SEC_CD)
        WHERE RTRIM(e.EMP_CD) = @targetEmpCd
      `, { targetEmpCd });

      if (empCheck && empCheck.length > 0) {
        const jobDesc = (empCheck[0].JOB_DESC || '').toUpperCase();
        const secDesc = (empCheck[0].SEC_DESC || '').toUpperCase();
        if (jobDesc.includes('SECURITY') || jobDesc.includes('SATPAM') || secDesc.includes('SECURITY') || secDesc.includes('SATPAM')) {
          return NextResponse.json({ 
            error: `Sinkronisasi untuk ${empCheck[0].EMP_NM} (Divisi SECURITY/SATPAM) dinonaktifkan demi perlindungan data (menunggu modul Import Jadwal Resmi).` 
          }, { status: 403 });
        }
      }
    }

    await withTransaction(async (tx) => {
      const empCondition = targetEmpCd 
        ? `AND (a.EMP_CD = @targetEmpCd OR RTRIM(a.EMP_CD) = @targetEmpCd)` 
        : `AND (e.Act_NonAct = 1 OR e.Act_NonAct IS NULL)`;

      const mergeEmpFilter = targetEmpCd
        ? `AND (e.EMP_CD = @targetEmpCd OR RTRIM(e.EMP_CD) = @targetEmpCd)`
        : `AND (e.Act_NonAct = 1 OR e.Act_NonAct IS NULL)`;

      const sqlUpdate = `
        BEGIN TRY
          -- =========================================================================
          -- TAHAP 0: GENERASI / MERGE BARIS TR_ABSEN (MERGE WITH HOLDLOCK)
          --          Membuat baris TR_ABSEN jika belum ada untuk tanggal terkait
          -- =========================================================================
          ;WITH DateRange AS (
            SELECT CAST(@startDate AS DATETIME) AS dt
            UNION ALL
            SELECT DATEADD(day, 1, dt)
            FROM DateRange
            WHERE dt < CAST(@endDate AS DATETIME)
          ),
          EmpDates AS (
            SELECT 
              d.dt AS DATE_TRANS,
              e.EMP_CD,
              e.EMP_NM,
              e.SEC_CD,
              e.JOB_CD,
              e.EMP_JNS,
              e.SHIFT,
              CASE 
                WHEN DATENAME(dw, d.dt) IN ('Saturday', 'Sunday') THEN 'LIBUR'
                ELSE 'KERJA'
              END AS DEFAULT_STATUS_HARI,
              CAST(CONVERT(varchar(10), d.dt, 120) + ' 07:00:00' AS DATETIME) AS DEFAULT_JAM_MASUK,
              CAST(CONVERT(varchar(10), d.dt, 120) + ' 16:00:00' AS DATETIME) AS DEFAULT_JAM_PULANG
            FROM DateRange d
            CROSS JOIN EMP_TABLE e
            LEFT JOIN MS_JOBS j ON RTRIM(e.JOB_CD) = RTRIM(j.JOB_CD)
            LEFT JOIN MS_SEC s ON RTRIM(e.SEC_CD) = RTRIM(s.SEC_CD)
            WHERE 1=1
              ${mergeEmpFilter}
              AND UPPER(ISNULL(RTRIM(j.JOB_DESC),'')) NOT IN ('SECURITY', 'SATPAM')
              AND UPPER(ISNULL(RTRIM(s.SEC_DESC),'')) NOT IN ('SECURITY', 'SATPAM')
          )
          MERGE TR_ABSEN WITH (HOLDLOCK) AS target
          USING EmpDates AS source
          ON (RTRIM(target.EMP_CD) = RTRIM(source.EMP_CD) AND target.DATE_TRANS = source.DATE_TRANS)
          WHEN NOT MATCHED THEN
            INSERT (
              DATE_TRANS, EMP_CD, EMP_NM, SEC_CD, JOB_CD, EMP_JNS, SHIFT, 
              STATUS_HARI, JAM_MASUK, JAM_PULANG, HADIR, flag_Absen
            )
            VALUES (
              source.DATE_TRANS, source.EMP_CD, source.EMP_NM, source.SEC_CD, source.JOB_CD, source.EMP_JNS, source.SHIFT,
              source.DEFAULT_STATUS_HARI, source.DEFAULT_JAM_MASUK, source.DEFAULT_JAM_PULANG, 1, 'H'
            )
          OPTION (MAXRECURSION 366);

          -- =========================================================================
          -- TAHAP 1: KOREKSI WORK_IN (MASUK KEPAGIAN < 06:50 ATAU TELAT RINGAN 07:00-07:15)
          --          -> RANDOMIZE KE 06:50 s.d 06:59:59 (REGULER NON-ALL IN & NON-SECURITY)
          -- =========================================================================
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

          -- =========================================================================
          -- TAHAP 2: KOREKSI WORK_OUT (PULANG NANGGUNG & PENDARATAN AMAN) — REGULER
          -- =========================================================================
          WITH CalcRegOT AS (
            SELECT 
              a.WORK_OUT,
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
            END;

          -- =========================================================================
          -- TAHAP 3: KARYAWAN ALL IN -> KEMBALIKAN KE DATA RIIL RAW FINGERPRINT
          -- =========================================================================
          UPDATE a
          SET 
            a.WORK_IN = COALESCE(a.WORK_IN1, a.WORK_IN),
            a.WORK_OUT = COALESCE(a.WORK_OUT1, a.WORK_OUT)
          FROM TR_ABSEN a
          LEFT JOIN EMP_TABLE e ON RTRIM(a.EMP_CD) = RTRIM(e.EMP_CD)
          LEFT JOIN MS_SEC s ON RTRIM(e.SEC_CD) = RTRIM(s.SEC_CD)
          LEFT JOIN MS_JOBS j ON RTRIM(e.JOB_CD) = RTRIM(j.JOB_CD)
          WHERE a.DATE_TRANS >= @startDate AND a.DATE_TRANS <= @endDate
            ${empCondition}
            AND UPPER(ISNULL(RTRIM(e.ALL_IN),'0')) IN ('1', 'Y', 'TRUE')
            AND UPPER(ISNULL(RTRIM(j.JOB_DESC),'')) NOT IN ('SECURITY', 'SATPAM')
            AND UPPER(ISNULL(RTRIM(s.SEC_DESC),'')) NOT IN ('SECURITY', 'SATPAM');

          -- =========================================================================
          -- TAHAP 4: PERHITUNGAN ULANG JAM_KERJA DARI HASIL WORK_IN & WORK_OUT (RUMUS DESIMAL +0.50)
          --          (TIDAK MENYENTUH OT_1..OT_4, T_OT, STDJAM)
          -- =========================================================================
          UPDATE a
          SET a.JAM_KERJA = CASE 
            WHEN a.WORK_IN IS NOT NULL AND a.WORK_OUT IS NOT NULL AND a.WORK_OUT > a.WORK_IN
            THEN 
              CASE 
                WHEN (DATEDIFF(minute, a.WORK_IN, a.WORK_OUT) / 60.0) - FLOOR(DATEDIFF(minute, a.WORK_IN, a.WORK_OUT) / 60.0) < 0.50 
                THEN FLOOR(DATEDIFF(minute, a.WORK_IN, a.WORK_OUT) / 60.0) 
                ELSE FLOOR(DATEDIFF(minute, a.WORK_IN, a.WORK_OUT) / 60.0) + 0.50 
              END
            ELSE 0
          END
          FROM TR_ABSEN a
          LEFT JOIN EMP_TABLE e ON RTRIM(a.EMP_CD) = RTRIM(e.EMP_CD)
          LEFT JOIN MS_SEC s ON RTRIM(e.SEC_CD) = RTRIM(s.SEC_CD)
          LEFT JOIN MS_JOBS j ON RTRIM(e.JOB_CD) = RTRIM(j.JOB_CD)
          WHERE a.DATE_TRANS >= @startDate AND a.DATE_TRANS <= @endDate
            ${empCondition}
            AND UPPER(ISNULL(RTRIM(j.JOB_DESC),'')) NOT IN ('SECURITY', 'SATPAM')
            AND UPPER(ISNULL(RTRIM(s.SEC_DESC),'')) NOT IN ('SECURITY', 'SATPAM');

        END TRY
        BEGIN CATCH
          THROW;
        END CATCH
      `;
      
      const params: any = { startDate, endDate };
      if (targetEmpCd) {
        params.targetEmpCd = targetEmpCd;
      }

      await tx(sqlUpdate, params);
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
