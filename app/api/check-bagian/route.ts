import { NextResponse } from 'next/server';
import { query, withTransaction } from '@/lib/db';
import { calculateAttendanceAndOt } from '@/lib/otCalculator';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const secCd = searchParams.get('sec_cd')?.trim();
    const date = searchParams.get('date')?.trim();

    if (!secCd || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'sec_cd dan date (YYYY-MM-DD) wajib diisi' }, { status: 400 });
    }

    // Future date guard — no attendance data can exist yet
    const today = new Date().toISOString().split('T')[0];
    if (date > today) {
      return NextResponse.json({ data: [], future: true, message: 'Tanggal yang dipilih belum terjadi.' });
    }

    // Detect if the selected date is a weekend (Saturday=6, Sunday=0)
    const dateObj = new Date(date + 'T00:00:00');
    const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;

    const rows = await query<any>(`
      SELECT
        RTRIM(e.EMP_CD) AS NIK,
        RTRIM(e.EMP_NM) AS NAMA,
        RTRIM(ISNULL(j.JOB_DESC, '')) AS JABATAN,
        CONVERT(varchar(5), a.WORK_IN, 108) AS MASUK,
        CONVERT(varchar(8), a.WORK_IN, 108) AS MASUK_FULL,
        CONVERT(varchar(5), a.WORK_OUT, 108) AS PULANG,
        CONVERT(varchar(8), a.WORK_OUT, 108) AS PULANG_FULL,
        RTRIM(ISNULL(a.STATUS_HARI, '')) AS STATUS_HARI,
        RTRIM(ISNULL(a.REASON, '')) AS REASON,
        RTRIM(ISNULL(mr.REASON_DESC, '')) AS REASON_DESC,
        RTRIM(ISNULL(mr.REASON_GROUP, '')) AS REASON_GROUP,
        RTRIM(ISNULL(a.SHIFT, '')) AS SHIFT,
        CONVERT(varchar(10), a.DATE_TRANS, 120) AS DATE_TRANS,
        ISNULL(a.JAM_KERJA, 0) AS JAM_KERJA
      FROM EMP_TABLE e
      LEFT JOIN TR_ABSEN a ON RTRIM(a.EMP_CD) = RTRIM(e.EMP_CD) AND CONVERT(date, a.DATE_TRANS) = @date
      LEFT JOIN MS_JOBS j ON RTRIM(e.JOB_CD) = RTRIM(j.JOB_CD)
      LEFT JOIN Ms_Reason mr ON RTRIM(a.REASON) = RTRIM(mr.REASON_CODE)
      WHERE RTRIM(e.SEC_CD) = @secCd
        AND e.Act_NonAct = 1
        AND (e.DT_RSG IS NULL OR CONVERT(varchar(10), e.DT_RSG, 120) >= @date)
        AND (e.DT_ENTRY IS NULL OR CONVERT(varchar(10), e.DT_ENTRY, 120) <= @date)
      ORDER BY RTRIM(e.EMP_NM) ASC
    `, { secCd, date });

    const result = rows.map((r: any) => {
      const hasReason = !!(r.REASON || r.REASON_DESC);
      const hasIn = !!(r.MASUK && r.MASUK !== '');
      // Weekend without TR_ABSEN row → LIBUR, not ALPHA
      const isAlpha = !hasIn && !hasReason && !isWeekend;
      return {
        ...r,
        ALPHA: isAlpha,
        LIBUR: isWeekend && !hasIn && !hasReason,
        STATUS_DISPLAY: isAlpha ? 'ALPHA' : (isWeekend && !hasIn && !hasReason ? 'LIBUR' : (r.REASON_DESC || r.STATUS_HARI || 'Hadir')),
      };
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('API /check-bagian GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const secCd = String(data.sec_cd || '').trim();
    const date = String(data.date || '').trim();
    const corrections = data.corrections as Array<{
      EMP_CD: string;
      WORK_IN: string | null;
      WORK_OUT: string | null;
    }> | undefined;

    if (!secCd || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'sec_cd dan date wajib valid' }, { status: 400 });
    }

    if (!corrections || !Array.isArray(corrections) || corrections.length === 0) {
      return NextResponse.json({ error: 'Array corrections wajib diisi' }, { status: 400 });
    }

    let successCount = 0;
    const errors: string[] = [];

    for (const corr of corrections) {
      try {
        const empCd = String(corr.EMP_CD || '').trim();
        const workIn = corr.WORK_IN ? String(corr.WORK_IN).replace('Z', '') : null;
        const workOut = corr.WORK_OUT ? String(corr.WORK_OUT).replace('Z', '') : null;

        if (!empCd) continue;

        const workInDate = workIn ? new Date(workIn) : null;
        const workOutDate = workOut ? new Date(workOut) : null;

        const empCheck = await query<any>(`
          SELECT TOP 1
            RTRIM(e.EMP_NM) AS EMP_NM,
            RTRIM(ISNULL(j.JOB_DESC, '')) AS JOB_DESC,
            RTRIM(ISNULL(s.SEC_DESC, '')) AS SEC_DESC,
            RTRIM(ISNULL(a.STATUS_HARI, 'KERJA')) AS STATUS_HARI,
            RTRIM(ISNULL(a.SHIFT, '1')) AS SHIFT
          FROM EMP_TABLE e
          LEFT JOIN MS_JOBS j ON RTRIM(e.JOB_CD) = RTRIM(j.JOB_CD)
          LEFT JOIN MS_SEC s ON RTRIM(e.SEC_CD) = RTRIM(s.SEC_CD)
          LEFT JOIN TR_ABSEN a ON RTRIM(a.EMP_CD) = RTRIM(e.EMP_CD) AND CONVERT(date, a.DATE_TRANS) = @date
          WHERE RTRIM(e.EMP_CD) = @empCd
        `, { empCd, date });

        if (!empCheck.length) continue;

        const employee = empCheck[0];
        const calcResult = calculateAttendanceAndOt(
          date,
          workInDate,
          workOutDate,
          employee.JOB_DESC,
          employee.SEC_DESC,
          employee.STATUS_HARI,
          employee.SHIFT
        );

        // Convert Date objects to ISO-like strings for SQL parameters (local time, no UTC conversion)
        const pad = (n: number) => String(n).padStart(2, '0');
        const toLocalISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
        const workInStr = workInDate ? toLocalISO(workInDate) : null;
        const workOutStr = workOutDate ? toLocalISO(workOutDate) : null;

        await withTransaction(async (tx) => {
          // Check if TR_ABSEN row exists
          const existing = await tx<any>(`
            SELECT COUNT(*) as cnt FROM TR_ABSEN
            WHERE RTRIM(EMP_CD) = @empCd AND CONVERT(date, DATE_TRANS) = @date
          `, { empCd, date });

          if (existing[0].cnt > 0) {
            await tx(`
              UPDATE TR_ABSEN
              SET
                WORK_IN = ISNULL(@workIn, WORK_IN),
                WORK_OUT = ISNULL(@workOut, WORK_OUT),
                JAM_KERJA = @jamKerja,
                STATUS_HARI = @statusHari,
                SHIFT = ISNULL(@shift, SHIFT),
                OT_1 = @ot1,
                OT_2 = @ot2,
                OT_3 = @ot3,
                OT_4 = @ot4,
                T_OT = @tOt
              WHERE RTRIM(EMP_CD) = @empCd AND CONVERT(date, DATE_TRANS) = @date;
            `, {
              workIn: workInStr,
              workOut: workOutStr,
              jamKerja: calcResult.JAM_KERJA,
              statusHari: calcResult.STATUS_HARI,
              shift: employee.SHIFT,
              ot1: calcResult.OT_1,
              ot2: calcResult.OT_2,
              ot3: calcResult.OT_3,
              ot4: calcResult.OT_4,
              tOt: calcResult.T_OT,
              empCd,
              date
            });
          } else {
            await tx(`
              INSERT INTO TR_ABSEN (EMP_CD, DATE_TRANS, WORK_IN, WORK_OUT, JAM_KERJA, STATUS_HARI, SHIFT, OT_1, OT_2, OT_3, OT_4, T_OT)
              VALUES (@empCd, @date, @workIn, @workOut, @jamKerja, @statusHari, @shift, @ot1, @ot2, @ot3, @ot4, @tOt)
            `, {
              empCd,
              date,
              workIn: workInStr,
              workOut: workOutStr,
              jamKerja: calcResult.JAM_KERJA,
              statusHari: calcResult.STATUS_HARI,
              shift: employee.SHIFT || '1',
              ot1: calcResult.OT_1,
              ot2: calcResult.OT_2,
              ot3: calcResult.OT_3,
              ot4: calcResult.OT_4,
              tOt: calcResult.T_OT,
            });
          }
        });

        successCount++;
      } catch (e: any) {
        errors.push(`${corr.EMP_CD}: ${e.message}`);
      }
    }

    return NextResponse.json({
      success: true,
      applied: successCount,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    console.error('API /check-bagian POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
