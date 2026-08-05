import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

// GET /api/absensi?emp=xxx&bulan=7&tahun=2026
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const emp = searchParams.get('emp') || '';
    const bulan = parseInt(searchParams.get('bulan') || String(new Date().getMonth() + 1));
    const tahun = parseInt(searchParams.get('tahun') || String(new Date().getFullYear()));

    if (!emp) {
      return NextResponse.json({ error: 'emp parameter required' }, { status: 400 });
    }

    const result = await query<any>(`
      SELECT 
        CONVERT(varchar(10), a.DATE_TRANS, 120) AS DATE_TRANS,
        RTRIM(a.SHIFT) AS SHIFT,
        RTRIM(a.EMP_CD) AS EMP_CD,
        RTRIM(a.EMP_NM) AS EMP_NM,
        CONVERT(varchar(19), a.DATE_IN, 120) AS DATE_IN_STR,
        a.DATE_IN,
        CONVERT(varchar(19), a.WORK_IN1, 120) AS WORK_IN1_STR,
        a.WORK_IN1,
        CONVERT(varchar(19), a.WORK_IN, 120) AS WORK_IN_STR,
        a.WORK_IN,
        CONVERT(varchar(19), a.DATE_OUT, 120) AS DATE_OUT_STR,
        a.DATE_OUT,
        CONVERT(varchar(19), a.WORK_OUT1, 120) AS WORK_OUT1_STR,
        a.WORK_OUT1,
        CONVERT(varchar(19), a.WORK_OUT, 120) AS WORK_OUT_STR,
        a.WORK_OUT,
        a.JAM_KERJA,
        RTRIM(a.REASON) AS REASON,
        RTRIM(mr.REASON_GROUP) AS REASON_GROUP,
        RTRIM(a.STATUS_HARI) AS STATUS_HARI,
        CAST(ISNULL(a.OT_1, 0) AS INT) AS OT1,
        CAST(ISNULL(a.OT_2, 0) AS INT) AS OT2,
        CAST(ISNULL(a.OT_3, 0) AS INT) AS OT3,
        CAST(ISNULL(a.OT_4, 0) AS INT) AS OT4,
        CAST(ISNULL(a.T_OT, 0) AS INT) AS T_OT,
        RTRIM(a.SEC_CD) AS SEC_CD,
        a.Time_Late
      FROM TR_ABSEN a
      LEFT JOIN Ms_Reason mr ON RTRIM(a.REASON) = RTRIM(mr.REASON_CODE)
      WHERE RTRIM(a.EMP_CD) = '${emp.replace(/'/g, "''")}'
        AND MONTH(a.DATE_TRANS) = ${bulan}
        AND YEAR(a.DATE_TRANS) = ${tahun}
      ORDER BY a.DATE_TRANS ASC
    `);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('API /absensi error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
