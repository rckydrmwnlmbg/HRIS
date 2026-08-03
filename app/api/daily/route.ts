import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

// GET /api/daily?date=2026-07-19
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];

    const result = await query<any>(`
      SELECT 
        RTRIM(a.EMP_CD) AS EMP_CD,
        RTRIM(a.EMP_NM) AS EMP_NM,
        a.WORK_IN,
        a.WORK_OUT,
        RTRIM(a.STATUS_HARI) AS STATUS_HARI,
        RTRIM(a.REASON) AS REASON,
        RTRIM(a.SEC_CD) AS SEC_CD,
        RTRIM(e.DEP_CD) AS DEP_CD,
        RTRIM(d.DEP_DESC) AS DEP_DESC,
        a.Time_Late
      FROM TR_ABSEN a
      LEFT JOIN EMP_TABLE e ON RTRIM(a.EMP_CD) = RTRIM(e.EMP_CD)
      LEFT JOIN MS_DEP d ON e.DEP_CD = d.DEP_CD
      WHERE CONVERT(date, a.DATE_TRANS) = '${date.replace(/'/g, "''")}'
      ORDER BY a.EMP_NM ASC
    `);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('API /daily error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
