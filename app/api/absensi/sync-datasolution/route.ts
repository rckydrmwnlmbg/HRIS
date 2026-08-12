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
          sendEvent('progress', { message: 'Menghubungkan ke DataSolution...', progress: 5 });
          
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

          sendEvent('progress', { message: `Ditemukan ${dsData.length} data presensi. Mulai menyinkronkan...`, progress: 10 });
          
          let processedCount = 0;
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
          });

          // ── FASE 1: Sinkronisasi data presensi (per-row, sequential, aman dari deadlock) ──
          const singleMergeQuery = `
            BEGIN
              IF NOT EXISTS (
                SELECT 1 FROM EMP_TABLE e 
                LEFT JOIN MS_SEC s ON RTRIM(e.SEC_CD) = RTRIM(s.SEC_CD)
                WHERE RTRIM(e.EMP_CD) = @nik AND (RTRIM(e.SEC_CD) = 'SEC' OR RTRIM(s.SEC_DESC) LIKE '%SECURITY%')
              )
              BEGIN
                DECLARE @diffMins INT = DATEDIFF(MINUTE, @workIn, @workOut);
                DECLARE @netMins INT = CASE WHEN @diffMins > 60 THEN @diffMins - 60 ELSE 0 END;
                DECLARE @calcJamKerja DECIMAL(5,2) = FLOOR(@netMins / 30.0) * 0.5;
                IF @calcJamKerja < 0 SET @calcJamKerja = 0;

                DECLARE @targetShift VARCHAR(10) = (SELECT TOP 1 SHIFT FROM TR_ABSEN WHERE EMP_CD = @nik AND CONVERT(date, DATE_TRANS) = CONVERT(date, @tanggal));
                SET @targetShift = ISNULL(@targetShift, '1');

                DECLARE @targetJamMasuk DATETIME = (SELECT TOP 1 CAST(CONVERT(varchar(10), @tanggal, 120) + ' ' + CONVERT(varchar(8), WORK_IN, 108) AS DATETIME) FROM msSHIFT WHERE RTRIM(shift_CODE) = RTRIM(@targetShift));
                DECLARE @targetJamPulang DATETIME = (SELECT TOP 1 
                      CASE 
                        WHEN CONVERT(varchar(8), WORK_OUT, 108) < CONVERT(varchar(8), WORK_IN, 108) 
                        THEN CAST(CONVERT(varchar(10), DATEADD(day, 1, CONVERT(date, @tanggal)), 120) + ' ' + CONVERT(varchar(8), WORK_OUT, 108) AS DATETIME)
                        ELSE CAST(CONVERT(varchar(10), @tanggal, 120) + ' ' + CONVERT(varchar(8), WORK_OUT, 108) AS DATETIME)
                      END
                    FROM msSHIFT WHERE RTRIM(shift_CODE) = RTRIM(@targetShift));

                IF EXISTS (SELECT 1 FROM TR_ABSEN WHERE EMP_CD = @nik AND CONVERT(date, DATE_TRANS) = CONVERT(date, @tanggal))
                BEGIN
                  UPDATE TR_ABSEN SET 
                    WORK_IN = CASE 
                                WHEN ISNULL(CONVERT(varchar(19), WORK_IN, 120), '') <> ISNULL(CONVERT(varchar(19), WORK_IN1, 120), '') THEN WORK_IN 
                                ELSE ISNULL(@workIn, WORK_IN) 
                              END,
                    WORK_OUT = CASE 
                                WHEN ISNULL(CONVERT(varchar(19), WORK_OUT, 120), '') <> ISNULL(CONVERT(varchar(19), WORK_OUT1, 120), '') THEN WORK_OUT 
                                ELSE ISNULL(@workOut, WORK_OUT) 
                              END,
                    WORK_IN1 = ISNULL(@workIn, WORK_IN1),
                    WORK_OUT1 = ISNULL(@workOut, WORK_OUT1),
                    DATE_IN = CONVERT(date, @workIn),
                    DATE_OUT = CONVERT(date, @workOut),
                    JAM_MASUK = @targetJamMasuk,
                    JAM_PULANG = @targetJamPulang,
                    JAM_KERJA = @calcJamKerja,
                    HADIR = 1,
                    STATUS_HARI = ISNULL(STATUS_HARI, 'KERJA'),
                    SHIFT = ISNULL(SHIFT, '1'),
                    FLAG_ABSEN = ISNULL(FLAG_ABSEN, 'M'),
                    Time_Late = CASE 
                      WHEN @workIn IS NOT NULL THEN CAST(DATEDIFF(MINUTE, @targetJamMasuk, @workIn) AS FLOAT)
                      ELSE 0.0 
                    END
                  WHERE EMP_CD = @nik AND CONVERT(date, DATE_TRANS) = CONVERT(date, @tanggal);
                END
                ELSE
                BEGIN
                  DECLARE @defaultJamMasuk DATETIME = (SELECT TOP 1 CAST(CONVERT(varchar(10), @tanggal, 120) + ' ' + CONVERT(varchar(8), WORK_IN, 108) AS DATETIME) FROM msSHIFT WHERE RTRIM(shift_CODE) = '1');
                  DECLARE @defaultJamPulang DATETIME = (SELECT TOP 1 
                        CASE 
                          WHEN CONVERT(varchar(8), WORK_OUT, 108) < CONVERT(varchar(8), WORK_IN, 108) 
                          THEN CAST(CONVERT(varchar(10), DATEADD(day, 1, CONVERT(date, @tanggal)), 120) + ' ' + CONVERT(varchar(8), WORK_OUT, 108) AS DATETIME)
                          ELSE CAST(CONVERT(varchar(10), @tanggal, 120) + ' ' + CONVERT(varchar(8), WORK_OUT, 108) AS DATETIME)
                        END
                      FROM msSHIFT WHERE RTRIM(shift_CODE) = '1');

                  INSERT INTO TR_ABSEN (EMP_CD, DATE_TRANS, WORK_IN, WORK_OUT, WORK_IN1, WORK_OUT1, DATE_IN, DATE_OUT, JAM_MASUK, JAM_PULANG, JAM_KERJA, STATUS_HARI, SHIFT, HADIR, FLAG_ABSEN, Time_Late)
                  VALUES (
                    @nik, @tanggal, @workIn, @workOut, @workIn, @workOut, CONVERT(date, @workIn), CONVERT(date, @workOut), 
                    @defaultJamMasuk, 
                    @defaultJamPulang,
                    @calcJamKerja, 'KERJA', '1', 1, 'M',
                    CASE 
                      WHEN @workIn IS NOT NULL THEN CAST(DATEDIFF(MINUTE, @defaultJamMasuk, @workIn) AS FLOAT)
                      ELSE 0.0 
                    END
                  );
                END
              END
            END;
          `;

          for (let i = 0; i < dsData.length; i++) {
            const row = dsData[i];
            await query(singleMergeQuery, {
              nik: String(row.NIK).trim(),
              tanggal: row.Tanggal,
              workIn: row.finalWorkIn || null,
              workOut: row.finalWorkOut || null
            });
            processedCount++;

            // Kirim progress setiap 25 row agar tidak membanjiri stream
            if (i % 25 === 0 || i === dsData.length - 1) {
              const pct = 10 + Math.floor((i / dsData.length) * 40);
              sendEvent('progress', { message: `Menyinkronkan data presensi (${i + 1}/${dsData.length})...`, progress: pct });
            }
          }

          // ── FASE 2: Hitung ulang lembur ──
          sendEvent('progress', { message: 'Mengambil data absen untuk divalidasi lemburnya...', progress: 55 });
          
          const syncedAbsen = await query<any>(`
            SELECT a.EMP_CD, a.DATE_TRANS, a.WORK_IN, a.WORK_OUT, a.STATUS_HARI, a.SHIFT,
                  e.JOB_CD, j.JOB_DESC, e.SEC_CD, s.SEC_DESC
            FROM TR_ABSEN a
            JOIN EMP_TABLE e ON RTRIM(a.EMP_CD) = RTRIM(e.EMP_CD)
            LEFT JOIN MS_JOBS j ON RTRIM(e.JOB_CD) = RTRIM(j.JOB_CD)
            LEFT JOIN MS_SEC s ON RTRIM(e.SEC_CD) = RTRIM(s.SEC_CD)
            WHERE a.DATE_TRANS >= @startDate AND a.DATE_TRANS < DATEADD(day, 1, @endDate)
              AND a.WORK_IN IS NOT NULL AND a.WORK_OUT IS NOT NULL
          `, { startDate, endDate });

          const updateOtQuery = `
            UPDATE TR_ABSEN 
            SET OT_1 = @ot1, OT_2 = @ot2, OT_3 = @ot3, OT_4 = @ot4, T_OT = @tot, JAM_KERJA = @jamKerja
            WHERE RTRIM(EMP_CD) = RTRIM(@nik) AND CONVERT(date, DATE_TRANS) = CONVERT(date, @tanggal)
          `;

          for (let i = 0; i < syncedAbsen.length; i++) {
            const row = syncedAbsen[i];
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

            if (i % 25 === 0 || i === syncedAbsen.length - 1) {
              const pct = 55 + Math.floor((i / syncedAbsen.length) * 40);
              sendEvent('progress', { message: `Menghitung ulang jam lembur (${i + 1}/${syncedAbsen.length})...`, progress: pct });
            }
          }

          if (fallbackLogs.length > 0) {
            logSyncFallback(`Sync range ${startDate} to ${endDate}: ${fallbackLogs.length} fallbacks triggered.`);
            fallbackLogs.forEach(log => logSyncFallback(log));
          }

          sendEvent('done', { 
            processed: processedCount, 
            fallbacks: fallbackLogs.length, 
            message: `Berhasil sinkronisasi ${processedCount} data dari DataSolution.` 
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
