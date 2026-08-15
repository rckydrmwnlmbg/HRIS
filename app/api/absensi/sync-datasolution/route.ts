import { NextResponse } from 'next/server';
import { query, withTransaction } from '@/lib/db';
import { dsQuery } from '@/lib/db-datasolution';
import { calculateAttendanceAndOt } from '@/lib/otCalculator';
import fs from 'fs';
import path from 'path';

function logSyncFallback(message: string) {
  try {
    const logDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    const logPath = path.join(logDir, 'audit-sync-absen.log');
    const timestamp = new Date().toISOString();
    fs.appendFileSync(logPath, `[${timestamp}] ${message}\n`);
  } catch (error) {
    console.error('Failed to write to audit log:', error);
  }
}

function formatLocalSqlDatetime(d: Date | string | null | undefined): string {
  if (!d) return 'NULL';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(date.getTime())) return 'NULL';
  const pad = (n: number) => String(n).padStart(2, '0');
  const YYYY = date.getFullYear();
  const MM = pad(date.getMonth() + 1);
  const DD = pad(date.getDate());
  const hh = pad(date.getHours());
  const mm = pad(date.getMinutes());
  const ss = pad(date.getSeconds());
  return `'${YYYY}-${MM}-${DD} ${hh}:${mm}:${ss}'`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { startDate, endDate } = body;

    if (!startDate || !endDate || !/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      return NextResponse.json({ error: 'startDate dan endDate wajib valid (YYYY-MM-DD)' }, { status: 400 });
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        function sendEvent(type: string, data: any) {
          const payload = JSON.stringify({ type, ...data });
          controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
        }

        try {
          sendEvent('progress', { message: 'Menghubungkan ke mesin DataSolution...', progress: 5 });
          
          const dsData = await dsQuery<any>(`
            WITH RawTaps AS (
              SELECT 
                u.Badgenumber AS NIK,
                CAST(c.CHECKTIME AS DATE) AS Tanggal,
                c.CHECKTIME,
                c.CHECKTYPE
              FROM CHECKINOUT c
              JOIN USERINFO u ON c.USERID = u.USERID
              WHERE c.CHECKTIME >= @startDate AND c.CHECKTIME < DATEADD(day, 1, @endDate)
            ),
            AggregatedTaps AS (
              SELECT 
                NIK,
                Tanggal,
                MIN(CASE WHEN CHECKTYPE = 'I' THEN CHECKTIME END) AS JamMasuk_I,
                MAX(CASE WHEN CHECKTYPE = 'O' THEN CHECKTIME END) AS JamKeluar_O,
                MIN(CHECKTIME) AS JamMasuk_Fallback,
                MAX(CHECKTIME) AS JamKeluar_Fallback
              FROM RawTaps
              GROUP BY NIK, Tanggal
            )
            SELECT 
              NIK,
              CONVERT(varchar(10), Tanggal, 120) as Tanggal,
              JamMasuk_I,
              JamKeluar_O,
              JamMasuk_Fallback,
              JamKeluar_Fallback
            FROM AggregatedTaps
            WHERE NIK IS NOT NULL AND RTRIM(NIK) <> ''
          `, { startDate, endDate });

          if (!dsData || dsData.length === 0) {
            sendEvent('done', { processed: 0, message: 'Tidak ada data dari DataSolution di rentang tanggal ini' });
            controller.close();
            return;
          }

          sendEvent('progress', { message: `Ditemukan ${dsData.length.toLocaleString()} data presensi. Mulai penyiapan staging...`, progress: 10 });
          
          const fallbackLogs: string[] = [];

          dsData.forEach((row: any) => {
            let workIn = row.JamMasuk_I;
            let workOut = row.JamKeluar_O;
            if (!workIn || !workOut) {
              workIn = row.JamMasuk_Fallback;
              workOut = row.JamKeluar_Fallback;
              fallbackLogs.push(`Fallback: NIK ${row.NIK} tanggal ${row.Tanggal} (Taps: IN=${row.JamMasuk_I ? 'Yes' : 'No'}, OUT=${row.JamKeluar_O ? 'Yes' : 'No'})`);
            }
            row.finalWorkIn = workIn;
            row.finalWorkOut = workOut;

            let calcJamKerja = 0;
            if (workIn && workOut) {
              const diffMins = Math.floor((new Date(workOut).getTime() - new Date(workIn).getTime()) / 60000);
              const netMins = diffMins > 60 ? diffMins - 60 : 0;
              calcJamKerja = Math.max(0, Math.floor(netMins / 30) * 0.5);
            }
            row.calcJamKerja = calcJamKerja;
          });

          // ── EKSEKUSI TRANSAKSI DATABASE (STAGING TABLE TMP_HRIS_SYNC & TMP_HRIS_OT) ──
          await withTransaction(async (tx) => {
            // 1. Setup Staging Tables (Auto-create jika belum ada, lalu truncate)
            await tx(`
              IF OBJECT_ID('TMP_HRIS_SYNC', 'U') IS NULL
              BEGIN
                CREATE TABLE TMP_HRIS_SYNC (
                  NIK VARCHAR(20) NOT NULL,
                  Tanggal VARCHAR(10) NOT NULL,
                  WorkIn DATETIME NULL,
                  WorkOut DATETIME NULL,
                  CalcJamKerja DECIMAL(5,2) DEFAULT 0
                );
                CREATE CLUSTERED INDEX IX_TMP_HRIS_SYNC_NT ON TMP_HRIS_SYNC (NIK, Tanggal);
              END;
              TRUNCATE TABLE TMP_HRIS_SYNC;

              IF OBJECT_ID('TMP_HRIS_OT', 'U') IS NULL
              BEGIN
                CREATE TABLE TMP_HRIS_OT (
                  EMP_CD VARCHAR(20) NOT NULL,
                  DATE_TRANS VARCHAR(10) NOT NULL,
                  OT_1 DECIMAL(5,2) DEFAULT 0,
                  OT_2 DECIMAL(5,2) DEFAULT 0,
                  OT_3 DECIMAL(5,2) DEFAULT 0,
                  OT_4 DECIMAL(5,2) DEFAULT 0,
                  T_OT DECIMAL(5,2) DEFAULT 0,
                  JAM_KERJA DECIMAL(5,2) DEFAULT 0
                );
                CREATE CLUSTERED INDEX IX_TMP_HRIS_OT_ED ON TMP_HRIS_OT (EMP_CD, DATE_TRANS);
              END;
              TRUNCATE TABLE TMP_HRIS_OT;
            `);

            // 2. Batch Bulk Insert ke TMP_HRIS_SYNC (MENGGUNAKAN LOCAL TIME TANPA PERGESERAN UTC)
            const STAGING_BATCH = 400;
            for (let i = 0; i < dsData.length; i += STAGING_BATCH) {
              const chunk = dsData.slice(i, i + STAGING_BATCH);
              const valuesSql = chunk.map(r => {
                const pNik = `'${String(r.NIK).trim().replace(/'/g, "''")}'`;
                const pTgl = `'${r.Tanggal}'`;
                const pIn = formatLocalSqlDatetime(r.finalWorkIn);
                const pOut = formatLocalSqlDatetime(r.finalWorkOut);
                const pJam = r.calcJamKerja || 0;
                return `(${pNik}, ${pTgl}, ${pIn}, ${pOut}, ${pJam})`;
              }).join(',\n');

              await tx(`INSERT INTO TMP_HRIS_SYNC (NIK, Tanggal, WorkIn, WorkOut, CalcJamKerja) VALUES\n${valuesSql};`);
              
              const currentLoaded = Math.min(i + STAGING_BATCH, dsData.length);
              const pct = 10 + Math.floor((currentLoaded / dsData.length) * 35);
              sendEvent('progress', { message: `Menyinkronkan data presensi (${currentLoaded}/${dsData.length})...`, progress: pct });
            }

            sendEvent('progress', { message: 'Menjalankan integrasi data presensi...', progress: 48 });

            // 3. Set-Based UPDATE on TR_ABSEN (Non-Security, dengan Proteksi Koreksi Manual HR)
            await tx(`
              UPDATE a
              SET 
                a.WORK_IN = CASE 
                              WHEN ISNULL(CONVERT(varchar(19), a.WORK_IN, 120), '') <> ISNULL(CONVERT(varchar(19), a.WORK_IN1, 120), '') 
                              THEN a.WORK_IN 
                              ELSE ISNULL(t.WorkIn, a.WORK_IN) 
                            END,
                a.WORK_OUT = CASE 
                               WHEN ISNULL(CONVERT(varchar(19), a.WORK_OUT, 120), '') <> ISNULL(CONVERT(varchar(19), a.WORK_OUT1, 120), '') 
                               THEN a.WORK_OUT 
                               ELSE ISNULL(t.WorkOut, a.WORK_OUT) 
                             END,
                a.WORK_IN1 = ISNULL(t.WorkIn, a.WORK_IN1),
                a.WORK_OUT1 = ISNULL(t.WorkOut, a.WORK_OUT1),
                a.DATE_IN = CONVERT(date, t.WorkIn),
                a.DATE_OUT = CONVERT(date, t.WorkOut),
                a.JAM_KERJA = t.CalcJamKerja,
                a.HADIR = 1,
                a.STATUS_HARI = ISNULL(a.STATUS_HARI, 'KERJA'),
                a.SHIFT = ISNULL(a.SHIFT, '1'),
                a.FLAG_ABSEN = ISNULL(a.FLAG_ABSEN, 'M'),
                a.Time_Late = CASE 
                                WHEN t.WorkIn IS NOT NULL AND a.JAM_MASUK IS NOT NULL 
                                THEN CAST(DATEDIFF(MINUTE, a.JAM_MASUK, t.WorkIn) AS FLOAT)
                                ELSE 0.0 
                              END
              FROM TR_ABSEN a
              JOIN TMP_HRIS_SYNC t ON RTRIM(a.EMP_CD) = RTRIM(t.NIK) AND CONVERT(varchar(10), a.DATE_TRANS, 120) = t.Tanggal
              WHERE (a.SEC_CD IS NULL OR RTRIM(a.SEC_CD) <> 'SEC');
            `);

            // 4. Set-Based INSERT for Rows not yet in TR_ABSEN
            await tx(`
              DECLARE @defInStr VARCHAR(8) = (SELECT TOP 1 CONVERT(varchar(8), WORK_IN, 108) FROM msSHIFT WHERE RTRIM(shift_CODE) = '1');
              DECLARE @defOutStr VARCHAR(8) = (SELECT TOP 1 CONVERT(varchar(8), WORK_OUT, 108) FROM msSHIFT WHERE RTRIM(shift_CODE) = '1');
              SET @defInStr = ISNULL(@defInStr, '07:00:00');
              SET @defOutStr = ISNULL(@defOutStr, '16:00:00');

              INSERT INTO TR_ABSEN (
                EMP_CD, DATE_TRANS, WORK_IN, WORK_OUT, WORK_IN1, WORK_OUT1, 
                DATE_IN, DATE_OUT, JAM_MASUK, JAM_PULANG, JAM_KERJA, 
                STATUS_HARI, SHIFT, HADIR, FLAG_ABSEN, Time_Late
              )
              SELECT 
                t.NIK, 
                CONVERT(date, t.Tanggal), 
                t.WorkIn, 
                t.WorkOut, 
                t.WorkIn, 
                t.WorkOut, 
                CONVERT(date, t.WorkIn), 
                CONVERT(date, t.WorkOut),
                CAST(t.Tanggal + ' ' + @defInStr AS DATETIME),
                CAST(t.Tanggal + ' ' + @defOutStr AS DATETIME),
                t.CalcJamKerja,
                'KERJA',
                '1',
                1,
                'M',
                CASE 
                  WHEN t.WorkIn IS NOT NULL 
                  THEN CAST(DATEDIFF(MINUTE, CAST(t.Tanggal + ' ' + @defInStr AS DATETIME), t.WorkIn) AS FLOAT)
                  ELSE 0.0 
                END
              FROM TMP_HRIS_SYNC t
              WHERE NOT EXISTS (
                SELECT 1 FROM TR_ABSEN a 
                WHERE RTRIM(a.EMP_CD) = RTRIM(t.NIK) 
                  AND CONVERT(varchar(10), a.DATE_TRANS, 120) = t.Tanggal
              );
            `);

            // ── FASE 2: Hitung ulang lembur dengan otCalculator (Super Cepat) ──
            sendEvent('progress', { message: 'Mengambil data presensi untuk kalkulasi lembur...', progress: 55 });
            
            const syncedAbsen = await tx<any>(`
              SELECT a.EMP_CD, CONVERT(varchar(10), a.DATE_TRANS, 120) AS DATE_TRANS, 
                     a.WORK_IN, a.WORK_OUT, a.STATUS_HARI, a.SHIFT,
                     e.JOB_CD, j.JOB_DESC, e.SEC_CD, s.SEC_DESC
              FROM TR_ABSEN a
              JOIN EMP_TABLE e ON RTRIM(a.EMP_CD) = RTRIM(e.EMP_CD)
              LEFT JOIN MS_JOBS j ON RTRIM(e.JOB_CD) = RTRIM(j.JOB_CD)
              LEFT JOIN MS_SEC s ON RTRIM(e.SEC_CD) = RTRIM(s.SEC_CD)
              WHERE a.DATE_TRANS >= @startDate AND a.DATE_TRANS < DATEADD(day, 1, @endDate)
                AND a.WORK_IN IS NOT NULL AND a.WORK_OUT IS NOT NULL;
            `, { startDate, endDate });

            if (syncedAbsen && syncedAbsen.length > 0) {
              const otResults = syncedAbsen.map((row: any) => {
                const ot = calculateAttendanceAndOt(
                  row.DATE_TRANS,
                  new Date(row.WORK_IN),
                  new Date(row.WORK_OUT),
                  row.JOB_DESC || '',
                  row.SEC_DESC || '',
                  row.STATUS_HARI || '',
                  row.SHIFT || ''
                );
                return {
                  EMP_CD: String(row.EMP_CD).trim(),
                  DATE_TRANS: row.DATE_TRANS,
                  OT_1: ot.OT_1 || 0,
                  OT_2: ot.OT_2 || 0,
                  OT_3: ot.OT_3 || 0,
                  OT_4: ot.OT_4 || 0,
                  T_OT: ot.T_OT || 0,
                  JAM_KERJA: ot.JAM_KERJA || 0,
                };
              });

              const OT_BATCH = 400;
              for (let i = 0; i < otResults.length; i += OT_BATCH) {
                const chunk = otResults.slice(i, i + OT_BATCH);
                const valuesSql = chunk.map(r => {
                  const pNik = `'${r.EMP_CD.replace(/'/g, "''")}'`;
                  const pTgl = `'${r.DATE_TRANS}'`;
                  return `(${pNik}, ${pTgl}, ${r.OT_1}, ${r.OT_2}, ${r.OT_3}, ${r.OT_4}, ${r.T_OT}, ${r.JAM_KERJA})`;
                }).join(',\n');

                await tx(`INSERT INTO TMP_HRIS_OT (EMP_CD, DATE_TRANS, OT_1, OT_2, OT_3, OT_4, T_OT, JAM_KERJA) VALUES\n${valuesSql};`);

                const currentOt = Math.min(i + OT_BATCH, otResults.length);
                const pct = 55 + Math.floor((currentOt / otResults.length) * 35);
                sendEvent('progress', { message: `Menghitung ulang jam lembur (${currentOt}/${otResults.length})...`, progress: pct });
              }

              // Set-Based UPDATE Overtime
              await tx(`
                UPDATE a
                SET 
                  a.OT_1 = o.OT_1,
                  a.OT_2 = o.OT_2,
                  a.OT_3 = o.OT_3,
                  a.OT_4 = o.OT_4,
                  a.T_OT = o.T_OT,
                  a.JAM_KERJA = o.JAM_KERJA
                FROM TR_ABSEN a
                JOIN TMP_HRIS_OT o ON RTRIM(a.EMP_CD) = RTRIM(o.EMP_CD) AND CONVERT(varchar(10), a.DATE_TRANS, 120) = o.DATE_TRANS;
              `);
            }

            // 5. Bersihkan data lembur anomali di hari tanpa tap (Safety Cleanup untuk seluruh tanggal rentang)
            await tx(`
              UPDATE TR_ABSEN
              SET OT_1 = 0, OT_2 = 0, OT_3 = 0, OT_4 = 0, T_OT = 0, JAM_KERJA = 0
              WHERE DATE_TRANS >= @startDate AND DATE_TRANS < DATEADD(day, 1, @endDate)
                AND (WORK_IN IS NULL OR RTRIM(CONVERT(varchar(19), WORK_IN, 120)) = '') 
                AND (WORK_OUT IS NULL OR RTRIM(CONVERT(varchar(19), WORK_OUT, 120)) = '')
                AND (REASON IS NULL OR RTRIM(REASON) = '');
            `, { startDate, endDate });
          });

          if (fallbackLogs.length > 0) {
            logSyncFallback(`Sync range ${startDate} to ${endDate}: ${fallbackLogs.length} fallbacks triggered.`);
            fallbackLogs.forEach(log => logSyncFallback(log));
          }

          sendEvent('done', { 
            processed: dsData.length, 
            fallbacks: fallbackLogs.length, 
            message: `Berhasil sinkronisasi ${dsData.length.toLocaleString()} data presensi secara instan.` 
          });
          controller.close();
        } catch (error: any) {
          console.error('API /absensi/sync-datasolution error:', error);
          sendEvent('error', { message: error.message });
          controller.close();
        }
      }
    });

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

