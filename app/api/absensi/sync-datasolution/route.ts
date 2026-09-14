import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { dsQuery } from '@/lib/db-datasolution';
import { calculateAttendanceAndOt } from '@/lib/otCalculator';
import { isSecurityJob } from '@/lib/securitySchedule';
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
            FROM CHECKINOUT c WITH (NOLOCK)
            JOIN USERINFO u WITH (NOLOCK) ON c.USERID = u.USERID
            WHERE c.CHECKTIME >= CAST(@startDate AS DATETIME) AND c.CHECKTIME < DATEADD(hour, 27, CAST(@endDate AS DATETIME))
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

          // ── TAHAP 1: INTEGRASI PRESENSI LANGSUNG KE TR_ABSEN (DIRECT VALUES BATCHING - ZERO STAGING TABLE) ──
          sendEvent('progress', { message: 'Menjalankan integrasi data presensi...', progress: 15 });

          const BATCH_SIZE = 800;
          for (let i = 0; i < dsData.length; i += BATCH_SIZE) {
            const chunk = dsData.slice(i, i + BATCH_SIZE);
            const valuesSql = chunk.map(r => {
              const pNik = `'${String(r.NIK).trim().replace(/'/g, "''")}'`;
              const pTgl = `'${r.Tanggal}'`;
              const pIn = formatLocalSqlDatetime(r.finalWorkIn);
              const pOut = formatLocalSqlDatetime(r.finalWorkOut);
              const pJam = r.calcJamKerja || 0;
              return `(${pNik}, ${pTgl}, CAST(${pIn} AS DATETIME), CAST(${pOut} AS DATETIME), CAST(${pJam} AS DECIMAL(5,2)))`;
            }).join(',\n');

            await query(`
              DECLARE @defInStr VARCHAR(8) = (SELECT TOP 1 CONVERT(varchar(8), WORK_IN, 108) FROM msSHIFT WITH (NOLOCK) WHERE RTRIM(shift_CODE) = '1');
              DECLARE @defOutStr VARCHAR(8) = (SELECT TOP 1 CONVERT(varchar(8), WORK_OUT, 108) FROM msSHIFT WITH (NOLOCK) WHERE RTRIM(shift_CODE) = '1');
              SET @defInStr = ISNULL(@defInStr, '07:00:00');
              SET @defOutStr = ISNULL(@defOutStr, '16:00:00');

              -- 1. Lean UPDATE: hanya ubah baris yang jam masuk/pulang memang berubah
              UPDATE a
              SET 
                a.WORK_IN = v.WorkIn,
                a.WORK_OUT = v.WorkOut,
                a.WORK_IN1 = v.WorkIn,
                a.WORK_OUT1 = v.WorkOut,
                a.DATE_IN = CONVERT(date, v.WorkIn),
                a.DATE_OUT = CONVERT(date, v.WorkOut),
                a.JAM_KERJA = CASE
                                WHEN DATEPART(dw, a.DATE_TRANS) = 1 THEN 0
                                WHEN EXISTS (
                                  SELECT 1 FROM MS_LIBUR_KERJA l WITH (NOLOCK)
                                  WHERE l.TANGGAL = a.DATE_TRANS
                                ) THEN 0
                                ELSE v.CalcJamKerja
                              END,
                a.HADIR = 1,
                a.STATUS_HARI = CASE
                                  WHEN DATEPART(dw, a.DATE_TRANS) = 1 THEN 'LIBUR'
                                  WHEN EXISTS (
                                    SELECT 1 FROM MS_LIBUR_KERJA l WITH (NOLOCK)
                                    WHERE l.TANGGAL = a.DATE_TRANS
                                  ) THEN 'LIBUR'
                                  ELSE 'KERJA'
                                END,
                a.SHIFT = ISNULL(a.SHIFT, '1'),
                a.FLAG_ABSEN = ISNULL(a.FLAG_ABSEN, 'M'),
                a.Time_Late = CASE 
                                WHEN v.WorkIn IS NOT NULL AND a.JAM_MASUK IS NOT NULL AND v.WorkIn > a.JAM_MASUK
                                THEN 
                                  CASE 
                                    WHEN DATEDIFF(MINUTE, a.JAM_MASUK, v.WorkIn) <= 120
                                    THEN CEILING(CAST(DATEDIFF(MINUTE, a.JAM_MASUK, v.WorkIn) AS FLOAT) / 30.0) * 0.5
                                    ELSE CAST(DATEDIFF(MINUTE, a.JAM_MASUK, v.WorkIn) AS FLOAT)
                                  END
                                ELSE 0.0 
                              END,
                a.POT_JAM = CASE 
                              WHEN v.WorkIn IS NOT NULL AND a.JAM_MASUK IS NOT NULL AND v.WorkIn > a.JAM_MASUK
                              THEN 
                                CASE 
                                  WHEN DATEDIFF(MINUTE, a.JAM_MASUK, v.WorkIn) <= 120
                                  THEN CEILING(CAST(DATEDIFF(MINUTE, a.JAM_MASUK, v.WorkIn) AS FLOAT) / 30.0) * 0.5
                                  ELSE 0.0
                                END
                              ELSE 0.0 
                            END
              FROM TR_ABSEN a
              JOIN (VALUES 
${valuesSql}
              ) AS v(NIK, Tanggal, WorkIn, WorkOut, CalcJamKerja)
                ON RTRIM(a.EMP_CD) = RTRIM(v.NIK) AND a.DATE_TRANS = CAST(v.Tanggal AS DATETIME)
              WHERE a.DATE_TRANS >= CAST(@startDate AS DATETIME) AND a.DATE_TRANS < DATEADD(day, 1, CAST(@endDate AS DATETIME))
                AND (a.SEC_CD IS NULL OR RTRIM(a.SEC_CD) <> 'SEC')
                -- 🛡️ PROTEKSI MUTLAK: LEWATI SEMUA BARIS KOREKSI MANUAL HR (JAMEDIT/USERNAME) & ALASAN/CUTI/IZIN
                AND a.JAMEDIT IS NULL
                AND (a.USERNAME IS NULL OR RTRIM(a.USERNAME) = '')
                AND (a.REASON IS NULL OR RTRIM(a.REASON) = '' OR RTRIM(a.REASON) = '-')
                AND (ISNULL(a.WORK_IN, '') <> ISNULL(v.WorkIn, '') OR ISNULL(a.WORK_OUT, '') <> ISNULL(v.WorkOut, ''));

              -- 2. INSERT baris baru untuk karyawan yang belum ada di TR_ABSEN pada tanggal tersebut
              INSERT INTO TR_ABSEN (
                EMP_CD, DATE_TRANS, WORK_IN, WORK_OUT, WORK_IN1, WORK_OUT1, 
                DATE_IN, DATE_OUT, JAM_MASUK, JAM_PULANG, JAM_KERJA, 
                STATUS_HARI, SHIFT, HADIR, FLAG_ABSEN, Time_Late, POT_JAM
              )
              SELECT 
                v.NIK, 
                CAST(v.Tanggal AS DATETIME), 
                v.WorkIn, 
                v.WorkOut, 
                v.WorkIn, 
                v.WorkOut, 
                CONVERT(date, v.WorkIn), 
                CONVERT(date, v.WorkOut),
                CAST(v.Tanggal + ' ' + @defInStr AS DATETIME),
                CAST(v.Tanggal + ' ' + @defOutStr AS DATETIME),
                CASE
                  WHEN DATEPART(dw, CAST(v.Tanggal AS DATETIME)) = 1 THEN 0
                  WHEN EXISTS (
                    SELECT 1 FROM MS_LIBUR_KERJA l WITH (NOLOCK)
                    WHERE CONVERT(date, l.TANGGAL) = CAST(v.Tanggal AS DATE)
                  ) THEN 0
                  ELSE v.CalcJamKerja
                END,
                CASE
                  WHEN DATEPART(dw, CAST(v.Tanggal AS DATETIME)) = 1 THEN 'LIBUR'
                  WHEN EXISTS (
                    SELECT 1 FROM MS_LIBUR_KERJA l WITH (NOLOCK)
                    WHERE CONVERT(date, l.TANGGAL) = CAST(v.Tanggal AS DATE)
                  ) THEN 'LIBUR'
                  ELSE 'KERJA'
                END,
                '1',
                1,
                'M',
                CASE 
                  WHEN v.WorkIn IS NOT NULL AND v.WorkIn > CAST(v.Tanggal + ' ' + @defInStr AS DATETIME)
                  THEN 
                    CASE 
                      WHEN DATEDIFF(MINUTE, CAST(v.Tanggal + ' ' + @defInStr AS DATETIME), v.WorkIn) <= 120
                      THEN CEILING(CAST(DATEDIFF(MINUTE, CAST(v.Tanggal + ' ' + @defInStr AS DATETIME), v.WorkIn) AS FLOAT) / 30.0) * 0.5
                      ELSE CAST(DATEDIFF(MINUTE, CAST(v.Tanggal + ' ' + @defInStr AS DATETIME), v.WorkIn) AS FLOAT)
                    END
                  ELSE 0.0 
                END,
                CASE 
                  WHEN v.WorkIn IS NOT NULL AND v.WorkIn > CAST(v.Tanggal + ' ' + @defInStr AS DATETIME)
                  THEN 
                    CASE 
                      WHEN DATEDIFF(MINUTE, CAST(v.Tanggal + ' ' + @defInStr AS DATETIME), v.WorkIn) <= 120
                      THEN CEILING(CAST(DATEDIFF(MINUTE, CAST(v.Tanggal + ' ' + @defInStr AS DATETIME), v.WorkIn) AS FLOAT) / 30.0) * 0.5
                      ELSE 0.0
                    END
                  ELSE 0.0 
                END
              FROM (VALUES 
${valuesSql}
              ) AS v(NIK, Tanggal, WorkIn, WorkOut, CalcJamKerja)
              WHERE NOT EXISTS (
                SELECT 1 FROM TR_ABSEN a WITH (NOLOCK)
                WHERE a.DATE_TRANS >= CAST(@startDate AS DATETIME) 
                  AND a.DATE_TRANS < DATEADD(day, 1, CAST(@endDate AS DATETIME))
                  AND RTRIM(a.EMP_CD) = RTRIM(v.NIK) 
                  AND a.DATE_TRANS = CAST(v.Tanggal AS DATETIME)
              );
            `, { startDate, endDate });

            const currentLoaded = Math.min(i + BATCH_SIZE, dsData.length);
            const pct = 15 + Math.floor((currentLoaded / dsData.length) * 35);
            sendEvent('progress', { message: `Menyinkronkan data presensi (${currentLoaded}/${dsData.length})...`, progress: pct });
          }

          // ── TAHAP 2: KALKULASI LEMBUR DI MEMORY (DILAKUKAN DI LUAR TRANSAKSI AGAR DATABASE TIDAK TERKUNCI) ──
          sendEvent('progress', { message: 'Mengambil data presensi untuk kalkulasi lembur...', progress: 52 });
          
          const holidayRows = await query<any>(`
            SELECT CONVERT(varchar(10), TANGGAL, 120) AS tanggal
            FROM MS_LIBUR_KERJA WITH (NOLOCK)
            WHERE TANGGAL >= @startDate AND TANGGAL <= @endDate
          `, { startDate, endDate });
          const holidayDates = new Set((holidayRows || []).map((h: any) => h.tanggal));

          const syncedAbsen = await query<any>(`
            SELECT a.EMP_CD, CONVERT(varchar(10), a.DATE_TRANS, 120) AS DATE_TRANS, 
                   a.WORK_IN, a.WORK_OUT, a.STATUS_HARI, a.SHIFT,
                   e.JOB_CD, j.JOB_DESC, e.SEC_CD, s.SEC_DESC
            FROM TR_ABSEN a WITH (NOLOCK)
            JOIN EMP_TABLE e WITH (NOLOCK) ON RTRIM(a.EMP_CD) = RTRIM(e.EMP_CD)
            LEFT JOIN MS_JOBS j WITH (NOLOCK) ON RTRIM(e.JOB_CD) = RTRIM(j.JOB_CD)
            LEFT JOIN MS_SEC s WITH (NOLOCK) ON RTRIM(e.SEC_CD) = RTRIM(s.SEC_CD)
            WHERE a.DATE_TRANS >= CAST(@startDate AS DATETIME) AND a.DATE_TRANS < DATEADD(day, 1, CAST(@endDate AS DATETIME))
              AND a.WORK_IN IS NOT NULL AND a.WORK_OUT IS NOT NULL;
          `, { startDate, endDate });

          if (syncedAbsen && syncedAbsen.length > 0) {
            const otResults = syncedAbsen.map((row: any) => {
              const security = isSecurityJob(row.JOB_DESC, row.SEC_DESC, row.SHIFT);
              const dObj = new Date(row.DATE_TRANS + 'T00:00:00');
              const isSunday = dObj.getDay() === 0;
              const isRegisteredHoliday = holidayDates.has(row.DATE_TRANS);
              const isStatusLibur = row.STATUS_HARI === 'LIBUR';

              let isHoliday = false;
              if (isStatusLibur) {
                isHoliday = true;
              } else if (isRegisteredHoliday) {
                isHoliday = row.STATUS_HARI !== 'KERJA';
              } else if (isSunday) {
                isHoliday = !security && row.STATUS_HARI !== 'KERJA';
              }

              const ot = calculateAttendanceAndOt(
                row.DATE_TRANS,
                new Date(row.WORK_IN),
                new Date(row.WORK_OUT),
                row.JOB_DESC || '',
                row.SEC_DESC || '',
                isHoliday ? 'LIBUR' : 'KERJA',
                row.SHIFT || '',
                isHoliday
              );
              return {
                EMP_CD: String(row.EMP_CD).trim(),
                DATE_TRANS: row.DATE_TRANS,
                OT_1: ot.OT_1 || 0,
                OT_2: ot.OT_2 || 0,
                OT_3: ot.OT_3 || 0,
                OT_4: ot.OT_4 || 0,
                T_OT: ot.T_OT || 0,
                JAM_KERJA: ot.JAM_KERJA !== null && ot.JAM_KERJA !== undefined ? ot.JAM_KERJA : (isHoliday ? 0 : 8),
                STATUS_HARI: isHoliday ? 'LIBUR' : 'KERJA'
              };
            });

            // ── TAHAP 3: INTEGRASI LEMBUR KE TR_ABSEN (DIRECT SET-BASED UPDATE TANPA STAGING TABLE) ──
            const OT_BATCH = 800;
            for (let i = 0; i < otResults.length; i += OT_BATCH) {
              const chunk = otResults.slice(i, i + OT_BATCH);
              const valuesSql = chunk.map(r => {
                const pNik = `'${r.EMP_CD.replace(/'/g, "''")}'`;
                const pTgl = `'${r.DATE_TRANS}'`;
                const pStatus = `'${r.STATUS_HARI}'`;
                return `(${pNik}, ${pTgl}, ${r.OT_1}, ${r.OT_2}, ${r.OT_3}, ${r.OT_4}, ${r.T_OT}, ${r.JAM_KERJA}, ${pStatus})`;
              }).join(',\n');

              await query(`
                UPDATE a
                SET 
                  a.OT_1 = v.OT_1,
                  a.OT_2 = v.OT_2,
                  a.OT_3 = v.OT_3,
                  a.OT_4 = v.OT_4,
                  a.T_OT = v.T_OT,
                  a.JAM_KERJA = v.JAM_KERJA,
                  a.STATUS_HARI = v.STATUS_HARI
                FROM TR_ABSEN a
                JOIN (VALUES 
${valuesSql}
                ) AS v(EMP_CD, DATE_TRANS, OT_1, OT_2, OT_3, OT_4, T_OT, JAM_KERJA, STATUS_HARI)
                  ON RTRIM(a.EMP_CD) = RTRIM(v.EMP_CD) AND a.DATE_TRANS = CAST(v.DATE_TRANS AS DATETIME)
                WHERE a.DATE_TRANS >= CAST(@startDate AS DATETIME) AND a.DATE_TRANS < DATEADD(day, 1, CAST(@endDate AS DATETIME))
                  AND (
                    ISNULL(a.OT_1, 0) <> v.OT_1 
                    OR ISNULL(a.OT_2, 0) <> v.OT_2 
                    OR ISNULL(a.OT_3, 0) <> v.OT_3 
                    OR ISNULL(a.OT_4, 0) <> v.OT_4 
                    OR ISNULL(a.T_OT, 0) <> v.T_OT 
                    OR ISNULL(a.JAM_KERJA, 0) <> v.JAM_KERJA 
                    OR ISNULL(a.STATUS_HARI, '') <> v.STATUS_HARI
                  );
              `, { startDate, endDate });

              const currentOt = Math.min(i + OT_BATCH, otResults.length);
              const pct = 55 + Math.floor((currentOt / otResults.length) * 40);
              sendEvent('progress', { message: `Menyimpan data lembur (${currentOt}/${otResults.length})...`, progress: pct });
            }

            // Bersihkan data lembur anomali di hari tanpa tap (Safety Cleanup)
            await query(`
              UPDATE TR_ABSEN
              SET OT_1 = 0, OT_2 = 0, OT_3 = 0, OT_4 = 0, T_OT = 0, JAM_KERJA = 0
              WHERE DATE_TRANS >= CAST(@startDate AS DATETIME) AND DATE_TRANS < DATEADD(day, 1, CAST(@endDate AS DATETIME))
                AND WORK_IN IS NULL
                AND WORK_OUT IS NULL
                AND (REASON IS NULL OR RTRIM(REASON) = '')
                AND (ISNULL(OT_1, 0) <> 0 OR ISNULL(OT_2, 0) <> 0 OR ISNULL(OT_3, 0) <> 0 OR ISNULL(OT_4, 0) <> 0 OR ISNULL(T_OT, 0) <> 0);
            `, { startDate, endDate });
          } else {
            // Jika tidak ada data tap sama sekali, tetap jalankan safety cleanup
            await query(`
              UPDATE TR_ABSEN
              SET OT_1 = 0, OT_2 = 0, OT_3 = 0, OT_4 = 0, T_OT = 0, JAM_KERJA = 0
              WHERE DATE_TRANS >= CAST(@startDate AS DATETIME) AND DATE_TRANS < DATEADD(day, 1, CAST(@endDate AS DATETIME))
                AND WORK_IN IS NULL
                AND WORK_OUT IS NULL
                AND (REASON IS NULL OR RTRIM(REASON) = '')
                AND (ISNULL(OT_1, 0) <> 0 OR ISNULL(OT_2, 0) <> 0 OR ISNULL(OT_3, 0) <> 0 OR ISNULL(OT_4, 0) <> 0 OR ISNULL(T_OT, 0) <> 0);
            `, { startDate, endDate });
          }

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
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

