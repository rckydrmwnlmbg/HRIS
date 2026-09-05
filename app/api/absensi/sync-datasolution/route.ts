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
          
          const rawTaps = await dsQuery<any>(`
            SELECT 
              RTRIM(u.Badgenumber) AS NIK,
              c.CHECKTIME,
              RTRIM(ISNULL(c.CHECKTYPE, '')) AS CHECKTYPE
            FROM CHECKINOUT c
            JOIN USERINFO u ON c.USERID = u.USERID
            WHERE c.CHECKTIME >= @startDate AND c.CHECKTIME < DATEADD(hour, 27, CAST(@endDate AS DATETIME))
              AND u.Badgenumber IS NOT NULL AND RTRIM(u.Badgenumber) <> ''
            ORDER BY u.Badgenumber, c.CHECKTIME ASC
          `, { startDate, endDate });

          if (!rawTaps || rawTaps.length === 0) {
            sendEvent('done', { processed: 0, message: 'Tidak ada data dari DataSolution di rentang tanggal ini' });
            controller.close();
            return;
          }

          sendEvent('progress', { message: `Ditemukan ${rawTaps.length.toLocaleString()} rekaman log mesin. Mulai penataan shift & lembur...`, progress: 10 });
          
          // Kelompokkan tap mentah per NIK
          const tapsByNik = new Map<string, Array<{ time: Date; type: string }>>();
          rawTaps.forEach((row: any) => {
            if (!row.NIK || !row.CHECKTIME) return;
            const list = tapsByNik.get(row.NIK) || [];
            list.push({ time: new Date(row.CHECKTIME), type: row.CHECKTYPE });
            tapsByNik.set(row.NIK, list);
          });

          // Bangun daftar tanggal kalender dalam rentang [startDate s/d endDate]
          const targetDates: string[] = [];
          let currD = new Date(startDate + 'T00:00:00');
          const endD = new Date(endDate + 'T00:00:00');
          while (currD <= endD) {
            const y = currD.getFullYear();
            const m = String(currD.getMonth() + 1).padStart(2, '0');
            const d = String(currD.getDate()).padStart(2, '0');
            targetDates.push(`${y}-${m}-${d}`);
            currD.setDate(currD.getDate() + 1);
          }

          const dsData: any[] = [];
          const fallbackLogs: string[] = [];

          tapsByNik.forEach((taps, nik) => {
            const consumedTimestamps = new Set<number>();

            targetDates.forEach(tglStr => {
              const tglStart = new Date(`${tglStr}T00:00:00`);
              const tglEnd = new Date(`${tglStr}T23:59:59.999`);
              const nextDayCutoff = new Date(`${tglStr}T03:00:00`);
              nextDayCutoff.setDate(nextDayCutoff.getDate() + 1); // Cutoff 03:00 AM keesokan harinya

              // Tap pada hari berjalan yang belum dikonsumsi
              const dayTaps = taps.filter(t => t.time >= tglStart && t.time <= tglEnd && !consumedTimestamps.has(t.time.getTime()));

              if (dayTaps.length === 0) return;

              let workIn: Date | null = null;
              let workOut: Date | null = null;

              // 1. Tentukan Jam Masuk (Prioritaskan 'I' atau tap paling awal hari itu)
              const inCandidate = dayTaps.find(t => t.type === 'I') || dayTaps[0];
              workIn = inCandidate.time;
              consumedTimestamps.add(workIn.getTime());

              // 2. Tentukan Jam Pulang pada hari yang sama (tap setelah jam masuk)
              const outCandidatesSameDay = dayTaps.filter(t => t.time.getTime() > workIn!.getTime());
              
              if (outCandidatesSameDay.length > 0) {
                const outCandidate = outCandidatesSameDay.filter(t => t.type === 'O').pop() || outCandidatesSameDay[outCandidatesSameDay.length - 1];
                workOut = outCandidate.time;
                consumedTimestamps.add(workOut.getTime());
              } else {
                // 3. OVERNIGHT HEURISTIC (Cutoff s/d 03:00 Pagi):
                // Jika tidak ada tap pulang di hari H, cek apakah ada tap keluar di hari esoknya s/d pukul 03:00 pagi
                const overnightTaps = taps.filter(t => t.time > tglEnd && t.time <= nextDayCutoff && !consumedTimestamps.has(t.time.getTime()));
                if (overnightTaps.length > 0) {
                  const outCandidate = overnightTaps.filter(t => t.type === 'O').pop() || overnightTaps[overnightTaps.length - 1];
                  workOut = outCandidate.time;
                  consumedTimestamps.add(workOut.getTime());
                  fallbackLogs.push(`Overnight OT (Cutoff 03:00): NIK ${nik} tanggal ${tglStr} pulang jam ${workOut.toTimeString().substring(0, 5)}`);
                }
              }

              // Kalkulasi durasi kotor
              let calcJamKerja = 0;
              if (workIn && workOut) {
                const diffMins = Math.floor((workOut.getTime() - workIn.getTime()) / 60000);
                const netMins = diffMins > 60 ? diffMins - 60 : 0;
                calcJamKerja = Math.max(0, Math.floor(netMins / 30) * 0.5);
              }

              dsData.push({
                NIK: nik,
                Tanggal: tglStr,
                finalWorkIn: workIn,
                finalWorkOut: workOut,
                calcJamKerja
              });
            });
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

            // 3. Set-Based UPDATE on TR_ABSEN (Non-Security, dengan Proteksi Mutlak Koreksi Manual HR)
            await tx(`
              UPDATE a
              SET 
                a.WORK_IN = t.WorkIn,
                a.WORK_OUT = t.WorkOut,
                a.WORK_IN1 = t.WorkIn,
                a.WORK_OUT1 = t.WorkOut,
                a.DATE_IN = CONVERT(date, t.WorkIn),
                a.DATE_OUT = CONVERT(date, t.WorkOut),
                a.JAM_KERJA = t.CalcJamKerja,
                a.HADIR = 1,
                a.STATUS_HARI = CASE
                                  WHEN EXISTS (
                                    SELECT 1 FROM MS_LIBUR_KERJA l 
                                    WHERE CONVERT(varchar(10), l.TANGGAL, 120) = CONVERT(varchar(10), a.DATE_TRANS, 120)
                                  ) THEN 'LIBUR'
                                  ELSE 'KERJA'
                                END,
                a.SHIFT = ISNULL(a.SHIFT, '1'),
                a.FLAG_ABSEN = ISNULL(a.FLAG_ABSEN, 'M'),
                a.Time_Late = CASE 
                                WHEN t.WorkIn IS NOT NULL AND a.JAM_MASUK IS NOT NULL AND t.WorkIn > a.JAM_MASUK
                                THEN 
                                  CASE 
                                    WHEN DATEDIFF(MINUTE, a.JAM_MASUK, t.WorkIn) <= 120
                                    THEN CEILING(CAST(DATEDIFF(MINUTE, a.JAM_MASUK, t.WorkIn) AS FLOAT) / 30.0) * 0.5
                                    ELSE CAST(DATEDIFF(MINUTE, a.JAM_MASUK, t.WorkIn) AS FLOAT)
                                  END
                                ELSE 0.0 
                              END,
                a.POT_JAM = CASE 
                              WHEN t.WorkIn IS NOT NULL AND a.JAM_MASUK IS NOT NULL AND t.WorkIn > a.JAM_MASUK
                              THEN 
                                CASE 
                                  WHEN DATEDIFF(MINUTE, a.JAM_MASUK, t.WorkIn) <= 120
                                  THEN CEILING(CAST(DATEDIFF(MINUTE, a.JAM_MASUK, t.WorkIn) AS FLOAT) / 30.0) * 0.5
                                  ELSE 0.0
                                END
                              ELSE 0.0 
                            END
              FROM TR_ABSEN a
              JOIN TMP_HRIS_SYNC t ON RTRIM(a.EMP_CD) = RTRIM(t.NIK) AND CONVERT(varchar(10), a.DATE_TRANS, 120) = t.Tanggal
              WHERE (a.SEC_CD IS NULL OR RTRIM(a.SEC_CD) <> 'SEC')
                -- 🛡️ PROTEKSI MUTLAK: LEWATI SEMUA BARIS KOREKSI MANUAL HR (JAMEDIT/USERNAME) & ALASAN/CUTI/IZIN
                AND a.JAMEDIT IS NULL
                AND (a.USERNAME IS NULL OR RTRIM(a.USERNAME) = '')
                AND (a.REASON IS NULL OR RTRIM(a.REASON) = '' OR RTRIM(a.REASON) = '-')
                AND ISNULL(CONVERT(varchar(19), a.WORK_IN, 120), '') = ISNULL(CONVERT(varchar(19), a.WORK_IN1, 120), '')
                AND ISNULL(CONVERT(varchar(19), a.WORK_OUT, 120), '') = ISNULL(CONVERT(varchar(19), a.WORK_OUT1, 120), '');
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
                STATUS_HARI, SHIFT, HADIR, FLAG_ABSEN, Time_Late, POT_JAM
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
                CASE
                  WHEN EXISTS (
                    SELECT 1 FROM MS_LIBUR_KERJA l 
                    WHERE CONVERT(varchar(10), l.TANGGAL, 120) = t.Tanggal
                  ) THEN 'LIBUR'
                  ELSE 'KERJA'
                END,
                '1',
                1,
                'M',
                CASE 
                  WHEN t.WorkIn IS NOT NULL AND t.WorkIn > CAST(t.Tanggal + ' ' + @defInStr AS DATETIME)
                  THEN 
                    CASE 
                      WHEN DATEDIFF(MINUTE, CAST(t.Tanggal + ' ' + @defInStr AS DATETIME), t.WorkIn) <= 120
                      THEN CEILING(CAST(DATEDIFF(MINUTE, CAST(t.Tanggal + ' ' + @defInStr AS DATETIME), t.WorkIn) AS FLOAT) / 30.0) * 0.5
                      ELSE CAST(DATEDIFF(MINUTE, CAST(t.Tanggal + ' ' + @defInStr AS DATETIME), t.WorkIn) AS FLOAT)
                    END
                  ELSE 0.0 
                END,
                CASE 
                  WHEN t.WorkIn IS NOT NULL AND t.WorkIn > CAST(t.Tanggal + ' ' + @defInStr AS DATETIME)
                  THEN 
                    CASE 
                      WHEN DATEDIFF(MINUTE, CAST(t.Tanggal + ' ' + @defInStr AS DATETIME), t.WorkIn) <= 120
                      THEN CEILING(CAST(DATEDIFF(MINUTE, CAST(t.Tanggal + ' ' + @defInStr AS DATETIME), t.WorkIn) AS FLOAT) / 30.0) * 0.5
                      ELSE 0.0
                    END
                  ELSE 0.0 
                END
              FROM TMP_HRIS_SYNC t
              WHERE NOT EXISTS (
                SELECT 1 FROM TR_ABSEN a 
                WHERE RTRIM(a.EMP_CD) = RTRIM(t.NIK) 
                  AND CONVERT(varchar(10), a.DATE_TRANS, 120) = t.Tanggal
              );
            `);

            // 4b. JAMINAN MUTLAK: Pastikan STATUS_HARI, SHIFT, dan FLAG_ABSEN TIDAK BOLEH NULL/KOSONG
            // Hanya mengisi kolom yang masih kosong, TANPA menyentuh jam masuk/pulang hasil koreksi HR!
            await tx(`
              UPDATE a
              SET 
                a.STATUS_HARI = CASE
                                  WHEN a.STATUS_HARI IS NOT NULL AND RTRIM(a.STATUS_HARI) <> '' THEN a.STATUS_HARI
                                  WHEN EXISTS (
                                    SELECT 1 FROM MS_LIBUR_KERJA l 
                                    WHERE CONVERT(varchar(10), l.TANGGAL, 120) = CONVERT(varchar(10), a.DATE_TRANS, 120)
                                  ) THEN 'LIBUR'
                                  ELSE 'KERJA'
                                END,
                a.SHIFT = CASE
                            WHEN a.SHIFT IS NOT NULL AND RTRIM(a.SHIFT) <> '' THEN a.SHIFT
                            ELSE '1'
                          END,
                a.FLAG_ABSEN = CASE
                                 WHEN a.FLAG_ABSEN IS NOT NULL AND RTRIM(a.FLAG_ABSEN) <> '' THEN a.FLAG_ABSEN
                                 ELSE 'M'
                               END
              FROM TR_ABSEN a
              WHERE a.DATE_TRANS >= @startDate AND a.DATE_TRANS < DATEADD(day, 1, @endDate)
                AND (
                  a.STATUS_HARI IS NULL OR RTRIM(a.STATUS_HARI) = ''
                  OR a.SHIFT IS NULL OR RTRIM(a.SHIFT) = ''
                  OR a.FLAG_ABSEN IS NULL OR RTRIM(a.FLAG_ABSEN) = ''
                );
            `, { startDate, endDate });

            // ── FASE 2: Hitung ulang lembur dengan otCalculator (Super Cepat & Akurat) ──
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

              // Set-Based UPDATE Overtime langsung ke TR_ABSEN
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

