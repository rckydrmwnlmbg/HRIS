import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const bulan = searchParams.get('bulan') || new Date().getMonth() + 1;
    const tahun = searchParams.get('tahun') || new Date().getFullYear();

    // Mengambil data lembur SPL
    const result = await query<any>(`
      SELECT 
        s.ID,
        s.SPL_NO,
        s.EMP_CD,
        e.EMP_NM,
        CONVERT(varchar(10), s.DATE_TRANS, 120) AS DATE_TRANS,
        s.PLAN_OT,
        s.CATATAN,
        j.JOB_DESC,
        sec.SEC_DESC
      FROM TR_SPL s
      LEFT JOIN EMP_TABLE e ON RTRIM(s.EMP_CD) = RTRIM(e.EMP_CD)
      LEFT JOIN MS_JOBS j ON e.JOB_CD = j.JOB_CD
      LEFT JOIN MS_SEC sec ON e.SEC_CD = sec.SEC_CD
      WHERE MONTH(s.DATE_TRANS) = ${bulan} 
        AND YEAR(s.DATE_TRANS) = ${tahun}
      ORDER BY s.DATE_TRANS DESC, s.CREATED_AT DESC
    `);

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { splNo, empCd, dateTrans, planOt, catatan } = body;

    if (!empCd || !dateTrans || planOt === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    await query(`
      INSERT INTO TR_SPL (SPL_NO, EMP_CD, DATE_TRANS, PLAN_OT, CATATAN)
      VALUES (
        '${splNo || ''}', 
        '${empCd}', 
        '${dateTrans}', 
        ${planOt}, 
        '${catatan || ''}'
      )
    `);

    return NextResponse.json({ message: 'SPL created successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
