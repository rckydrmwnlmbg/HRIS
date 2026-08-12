import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { calculateAttendanceAndOt } from '@/lib/otCalculator';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const absensiData = await query(`
      SELECT TOP 500 
        a.EMP_CD, RTRIM(e.EMP_NM) as EMP_NM, a.DATE_TRANS, a.WORK_IN, a.WORK_OUT, a.STATUS_HARI, a.SHIFT,
        a.OT_1 as INUS_OT_1, a.OT_2 as INUS_OT_2, a.OT_3 as INUS_OT_3, a.OT_4 as INUS_OT_4, a.T_OT as INUS_T_OT,
        e.JOB_CD, j.JOB_DESC, e.SEC_CD, s.SEC_DESC
      FROM TR_ABSEN a
      JOIN EMP_TABLE e ON RTRIM(a.EMP_CD) = RTRIM(e.EMP_CD)
      LEFT JOIN MS_JOBS j ON RTRIM(e.JOB_CD) = RTRIM(j.JOB_CD)
      LEFT JOIN MS_SEC s ON RTRIM(e.SEC_CD) = RTRIM(s.SEC_CD)
      WHERE a.DATE_TRANS >= '2026-05-01' AND (a.OT_1 > 0 OR a.OT_2 > 0 OR a.T_OT > 0)
      ORDER BY a.DATE_TRANS DESC
    `);

    let diffCount = 0;
    let matchCount = 0;
    const differences = [];

    for (const row of absensiData as any[]) {
      if (!row.WORK_IN || !row.WORK_OUT) continue;

      const dateStr = new Date(row.DATE_TRANS).toISOString().split('T')[0];

      const hrisOt = calculateAttendanceAndOt(
        dateStr,
        new Date(row.WORK_IN),
        new Date(row.WORK_OUT),
        row.JOB_DESC || '',
        row.SEC_DESC || '',
        row.STATUS_HARI || '',
        row.SHIFT || ''
      );

      const inusTot = Number(row.INUS_T_OT) || 0;
      const hrisTot = Number(hrisOt.T_OT) || 0;
      
      const ot1Diff = Math.abs((Number(row.INUS_OT_1)||0) - (hrisOt.OT_1||0));
      const ot2Diff = Math.abs((Number(row.INUS_OT_2)||0) - (hrisOt.OT_2||0));
      const ot3Diff = Math.abs((Number(row.INUS_OT_3)||0) - (hrisOt.OT_3||0));
      const ot4Diff = Math.abs((Number(row.INUS_OT_4)||0) - (hrisOt.OT_4||0));

      if (ot1Diff > 0.1 || ot2Diff > 0.1 || ot3Diff > 0.1 || ot4Diff > 0.1) {
        diffCount++;
        if (differences.length < 50) {
          differences.push({
            NIK: row.EMP_CD.trim(),
            NAMA: row.EMP_NM,
            TGL: dateStr,
            IN: new Date(row.WORK_IN).toISOString().split('T')[1].substring(0, 5),
            OUT: new Date(row.WORK_OUT).toISOString().split('T')[1].substring(0, 5),
            STATUS: row.STATUS_HARI?.trim(),
            INUS: { OT1: row.INUS_OT_1, OT2: row.INUS_OT_2, TOT: inusTot },
            HRIS: { OT1: hrisOt.OT_1, OT2: hrisOt.OT_2, TOT: hrisTot },
            Beda: hrisTot - inusTot
          });
        }
      } else {
        matchCount++;
      }
    }

    return NextResponse.json({
      RINGKASAN: {
        Total_Data_Diperiksa: matchCount + diffCount,
        Cocok_Sempurna: matchCount,
        Ada_Perbedaan: diffCount,
        Kesimpulan: diffCount === 0
          ? "Luar Biasa! Perhitungan HRIS 100% sama dengan INUS."
          : "Ada perbedaan hitungan antara HRIS dan INUS. Lihat daftar di bawah."
      },
      DAFTAR_PERBEDAAN: differences
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
