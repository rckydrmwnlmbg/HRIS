import { NextResponse } from 'next/server';
import { query, withTransaction } from '@/lib/db';
import { detectSecurityShift, isSecurityJob } from '@/lib/securitySchedule';
import { calculateAttendanceAndOt } from '@/lib/otCalculator';

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const bulan = parseInt(data.bulan);
    const tahun = parseInt(data.tahun);
    const mode: 'preview' | 'apply' = data.mode === 'apply' ? 'apply' : 'preview';
    // Optional: filter by single employee
    const empCd = data.emp_cd ? String(data.emp_cd).trim() : null;

    if (!bulan || !tahun || bulan < 1 || bulan > 12 || tahun < 2000) {
      return NextResponse.json({ error: 'Parameter bulan dan tahun wajib valid.' }, { status: 400 });
    }

    // Query all Security employees' attendance for the month
    const empFilter = empCd ? `AND RTRIM(a.EMP_CD) = '${empCd.replace(/'/g, "''")}'` : '';
    const rows = await query<any>(`
      SELECT
        RTRIM(a.EMP_CD) AS EMP_CD,
        RTRIM(a.EMP_NM) AS EMP_NM,
        CONVERT(varchar(10), a.DATE_TRANS, 120) AS DATE_TRANS,
        RTRIM(a.SHIFT) AS SHIFT,
        a.STATUS_HARI,
        CONVERT(varchar(19), a.WORK_IN, 120) AS WORK_IN,
        CONVERT(varchar(19), a.WORK_OUT, 120) AS WORK_OUT,
        RTRIM(ISNULL(j.JOB_DESC, '')) AS JOB_DESC,
        RTRIM(ISNULL(s.SEC_DESC, '')) AS SEC_DESC
      FROM TR_ABSEN a
      LEFT JOIN EMP_TABLE e ON RTRIM(a.EMP_CD) = RTRIM(e.EMP_CD)
      LEFT JOIN MS_JOBS j ON RTRIM(e.JOB_CD) = RTRIM(j.JOB_CD)
      LEFT JOIN MS_SEC s ON RTRIM(e.SEC_CD) = RTRIM(s.SEC_CD)
      WHERE MONTH(a.DATE_TRANS) = ${bulan}
        AND YEAR(a.DATE_TRANS) = ${tahun}
        ${empFilter}
      ORDER BY a.EMP_CD, a.DATE_TRANS
    `);

    // Filter Security employees and detect mismatches
    const mismatches: Array<{
      EMP_CD: string;
      EMP_NM: string;
      DATE_TRANS: string;
      WORK_IN: string | null;
      WORK_OUT: string | null;
      current_shift: string;
      detected_shift: string;
      current_status: string;
      detected_status: string;
      calcResult: any;
    }> = [];

    let totalSecurityRows = 0;

    const parseDate = (value: unknown): Date | null => {
      if (!value) return null;
      const date = new Date(String(value).replace('Z', ''));
      return Number.isNaN(date.getTime()) ? null : date;
    };

    for (const row of rows) {
      if (!isSecurityJob(row.JOB_DESC, row.SEC_DESC)) continue;
      totalSecurityRows++;

      let wInDate = parseDate(row.WORK_IN);
      let wOutDate = parseDate(row.WORK_OUT);

      if (wInDate && wOutDate && wOutDate <= wInDate) {
        const inferredMinutes = (wOutDate.getHours() * 60 + wOutDate.getMinutes()) + 1440 - (wInDate.getHours() * 60 + wInDate.getMinutes());
        if (wInDate.getHours() >= 14 && inferredMinutes >= 4 * 60 && inferredMinutes <= 16 * 60) {
          wOutDate.setDate(wOutDate.getDate() + 1);
        }
      }

      const detected = detectSecurityShift(row.WORK_IN ? String(row.WORK_IN).replace('Z', '') : null, row.WORK_OUT ? String(row.WORK_OUT).replace('Z', '') : null);
      if (!detected) continue; 

      const storedShift = (row.SHIFT || '').trim();
      const storedStatus = (row.STATUS_HARI || '').trim().toUpperCase();

      const calcResult = calculateAttendanceAndOt(
        row.DATE_TRANS,
        wInDate,
        wOutDate,
        row.JOB_DESC,
        row.SEC_DESC,
        storedStatus,
        detected.code
      );

      // Jika shift berubah, atau status hari harus dikoreksi (misal karena weekend protection)
      if (detected.code !== storedShift || calcResult.STATUS_HARI !== storedStatus) {
        mismatches.push({
          EMP_CD: row.EMP_CD,
          EMP_NM: row.EMP_NM,
          DATE_TRANS: row.DATE_TRANS,
          WORK_IN: row.WORK_IN,
          WORK_OUT: row.WORK_OUT,
          current_shift: storedShift || '(kosong)',
          detected_shift: detected.code,
          current_status: storedStatus || '(kosong)',
          detected_status: calcResult.STATUS_HARI,
          calcResult,
        });
      }
    }

    if (mode === 'preview') {
      return NextResponse.json({
        mode: 'preview',
        total_security_rows: totalSecurityRows,
        mismatch_count: mismatches.length,
        mismatches,
      });
    }

    // Mode apply: update SHIFT only for mismatched rows
    if (mismatches.length === 0) {
      return NextResponse.json({
        mode: 'apply',
        message: 'Tidak ada mismatch shift Security yang perlu diperbaiki.',
        updated: 0,
      });
    }

    let updatedCount = 0;

    await withTransaction(async (tx) => {
      for (const m of mismatches) {
        await tx(`
          UPDATE TR_ABSEN
          SET 
            SHIFT = @detectedShift,
            STATUS_HARI = @statusHari,
            JAM_KERJA = @jamKerja,
            OT_1 = @ot1,
            OT_2 = @ot2,
            OT_3 = @ot3,
            OT_4 = @ot4,
            T_OT = @tOt
          WHERE RTRIM(EMP_CD) = @empCd
            AND CONVERT(varchar(10), DATE_TRANS, 120) = @dateTrans
        `, {
          detectedShift: m.detected_shift,
          statusHari: m.calcResult.STATUS_HARI,
          jamKerja: m.calcResult.JAM_KERJA,
          ot1: m.calcResult.OT_1,
          ot2: m.calcResult.OT_2,
          ot3: m.calcResult.OT_3,
          ot4: m.calcResult.OT_4,
          tOt: m.calcResult.T_OT,
          empCd: m.EMP_CD,
          dateTrans: m.DATE_TRANS,
        });
        updatedCount++;
      }
    });

    return NextResponse.json({
      mode: 'apply',
      message: `Berhasil memperbaiki ${updatedCount} record shift Security.`,
      updated: updatedCount,
      details: mismatches.map(m => ({
        EMP_CD: m.EMP_CD,
        DATE_TRANS: m.DATE_TRANS,
        from: m.current_shift,
        to: m.detected_shift,
      })),
    });

  } catch (error: any) {
    console.error('API /absensi/sync-shift-security error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
