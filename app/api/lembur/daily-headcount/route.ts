import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const dateStr = searchParams.get('date');

    if (!dateStr) {
      return NextResponse.json({ error: 'Date is required' }, { status: 400 });
    }

    const sql = `
      SELECT 
        s.SEC_CD,
        s.SEC_DESC as LINE_NAME,
        SUM(CASE WHEN j.JOB_DESC LIKE '%MOR%' OR j.JOB_DESC LIKE '%MANDOR%' OR j.JOB_DESC LIKE '%MANAGER%' OR j.JOB_DESC = 'KOMANDAN' THEN 1 ELSE 0 END) as TOTAL_MOR,
        SUM(CASE WHEN j.JOB_DESC LIKE '%CHIEF%' OR j.JOB_DESC LIKE '%LEADER%' THEN 1 ELSE 0 END) as TOTAL_CHIEF,
        SUM(CASE WHEN j.JOB_DESC LIKE '%SPV%' OR j.JOB_DESC LIKE '%SUPERVISOR%' OR j.JOB_DESC LIKE '%ASST. MANAGER%' THEN 1 ELSE 0 END) as TOTAL_SPV,
        SUM(CASE WHEN j.JOB_DESC LIKE '%ASST%' AND j.JOB_DESC NOT LIKE '%ASST. MANAGER%' THEN 1 ELSE 0 END) as TOTAL_ASST,
        SUM(CASE WHEN j.JOB_DESC LIKE '%ADM%' OR j.JOB_DESC LIKE '%ADMIN%' OR j.JOB_DESC LIKE '%STAFF%' OR j.JOB_DESC LIKE '%CS%' OR j.JOB_DESC LIKE '%UMUM%' THEN 1 ELSE 0 END) as TOTAL_ADM,
        SUM(CASE WHEN j.JOB_DESC LIKE '%OPR%' OR j.JOB_DESC LIKE '%OPERATOR%' OR j.JOB_DESC LIKE '%SEWING%' OR j.JOB_DESC LIKE '%IRONING%' OR j.JOB_DESC LIKE '%OBRAS%' OR j.JOB_DESC LIKE '%PIPING%' THEN 1 ELSE 0 END) as TOTAL_OPR,
        SUM(CASE WHEN j.JOB_DESC LIKE '%HLP%' OR j.JOB_DESC LIKE '%HELPER%' OR j.JOB_DESC LIKE '%ANGGOTA%' THEN 1 ELSE 0 END) as TOTAL_HLP,
        SUM(CASE WHEN j.JOB_DESC LIKE '%PLANTER%' OR j.JOB_DESC LIKE '%PATTERN%' THEN 1 ELSE 0 END) as TOTAL_PLANTER,
        SUM(CASE WHEN j.JOB_DESC NOT LIKE '%MOR%' AND j.JOB_DESC NOT LIKE '%MANDOR%' AND j.JOB_DESC NOT LIKE '%MANAGER%' AND j.JOB_DESC != 'KOMANDAN'
                  AND j.JOB_DESC NOT LIKE '%CHIEF%' AND j.JOB_DESC NOT LIKE '%LEADER%'
                  AND j.JOB_DESC NOT LIKE '%SPV%' AND j.JOB_DESC NOT LIKE '%SUPERVISOR%' AND j.JOB_DESC NOT LIKE '%ASST. MANAGER%'
                  AND (j.JOB_DESC NOT LIKE '%ASST%' OR j.JOB_DESC LIKE '%ASST. MANAGER%')
                  AND j.JOB_DESC NOT LIKE '%ADM%' AND j.JOB_DESC NOT LIKE '%ADMIN%' AND j.JOB_DESC NOT LIKE '%STAFF%' AND j.JOB_DESC NOT LIKE '%CS%' AND j.JOB_DESC NOT LIKE '%UMUM%'
                  AND j.JOB_DESC NOT LIKE '%OPR%' AND j.JOB_DESC NOT LIKE '%OPERATOR%' AND j.JOB_DESC NOT LIKE '%SEWING%' AND j.JOB_DESC NOT LIKE '%IRONING%' AND j.JOB_DESC NOT LIKE '%OBRAS%' AND j.JOB_DESC NOT LIKE '%PIPING%'
                  AND j.JOB_DESC NOT LIKE '%HLP%' AND j.JOB_DESC NOT LIKE '%HELPER%' AND j.JOB_DESC NOT LIKE '%ANGGOTA%'
                  AND j.JOB_DESC NOT LIKE '%PLANTER%' AND j.JOB_DESC NOT LIKE '%PATTERN%'
             THEN 1 ELSE 0 END) as TOTAL_SPECIAL,
        COUNT(e.EMP_CD) as TOTAL_WORKERS
      FROM TR_ABSEN a
      JOIN EMP_TABLE e ON RTRIM(a.EMP_CD) = RTRIM(e.EMP_CD)
      LEFT JOIN MS_SEC s ON e.SEC_CD = s.SEC_CD
      LEFT JOIN MS_JOBS j ON e.JOB_CD = j.JOB_CD
      WHERE CONVERT(date, a.DATE_TRANS) = '${dateStr}'
      GROUP BY s.SEC_CD, s.SEC_DESC
      ORDER BY TRY_CAST(s.SEC_CD AS INT), s.SEC_CD
    `;

    const result = await query(sql);
    
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
