import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

// GET /api/master — Fetch all master data tables in one call
export async function GET() {
  try {
    const [departemen, seksi, jabatan, divisi, jenisKaryawan, reasons, teams] = await Promise.all([
      query<any>('SELECT DEP_CD, DEP_DESC FROM MS_DEP ORDER BY DEP_DESC'),
      query<any>('SELECT SEC_CD, SEC_DESC, GRP_CD FROM MS_SEC ORDER BY SEC_DESC'),
      query<any>('SELECT JOB_CD, JOB_DESC FROM MS_JOBS ORDER BY JOB_DESC'),
      query<any>('SELECT DIV_CD, DIV_DESC FROM MS_DIV ORDER BY DIV_DESC'),
      query<any>('SELECT JNS_CODE, JNS_DESC FROM MSJNS_KRY ORDER BY JNS_CODE'),
      query<any>('SELECT REASON_CODE, REASON_DESC, REASON_GROUP FROM Ms_Reason ORDER BY REASON_CODE'),
      query<any>(`
        SELECT DISTINCT 
          CASE   
            WHEN UPPER(RTRIM(s.SEC_DESC)) LIKE '%LINE%' THEN 'SEWING'   
            WHEN RTRIM(s.SEC_DESC) IN ('BUTTON', 'PATTERN SEAMER') THEN 'SEWING'   
            WHEN RTRIM(s.SEC_DESC) IN ('BANDLELING', 'CUTTING', 'GANTI BS', 'GELAR', 'GELAR INTERLINING', 'LOADING', 'MARKER', 'NUMBERING', 'PIPING', 'PRESS', 'RELAX') THEN 'CUTTING'   
            WHEN RTRIM(s.SEC_DESC) IN ('MEKANIK') THEN 'MECHANIC'   
            WHEN RTRIM(s.SEC_DESC) IN ('LAB', 'PSO', 'QA', 'QC ACCURACY') THEN 'QA'   
            WHEN RTRIM(s.SEC_DESC) IN ('IE') THEN 'IE'   
            WHEN RTRIM(s.SEC_DESC) IN ('ACCESSORIES', 'FABRIC', 'IT INVENTORY', 'MATERIAL MGMT', 'TRANSFER') THEN 'WAREHOUSE'   
            WHEN RTRIM(s.SEC_DESC) IN ('IRONING') THEN 'FINISHING'   
            WHEN RTRIM(s.SEC_DESC) IN ('PACKING', 'WAREHOUSE') THEN 'PACKING'   
            WHEN RTRIM(s.SEC_DESC) IN ('END LINE', 'END LINE SPARE', 'IN LINE', 'QC CUTTING', 'QC FABRIC', 'QC FINISHING', 'QC SEWING', 'QC SIZESPEC') THEN 'QC'   
            WHEN RTRIM(s.SEC_DESC) IN ('ORDER MGMT.') THEN 'PPIC'   
            WHEN RTRIM(s.SEC_DESC) IN ('CAD MARKER', 'CAD PATTERN', 'SAMPLE', 'SEWING PATTERN') THEN 'SAMPLE'   
            WHEN RTRIM(s.SEC_DESC) IN ('OFFICE PRODUKSI') THEN 'PROD.  OFFICE'   
            WHEN RTRIM(s.SEC_DESC) IN ('CLINIC', 'COMPLIANCE', 'HR') THEN 'HRC'   
            WHEN RTRIM(s.SEC_DESC) IN ('ACC/FIN', 'ACCOUNTING', 'FINANCE', 'PURCHASE') THEN 'ACCOUNTING'   
            WHEN RTRIM(s.SEC_DESC) IN ('EXIM', 'EXPORT', 'IMPORT', 'SUB-CON') THEN 'EXIM'   
            WHEN RTRIM(s.SEC_DESC) IN ('5 S', 'IT') THEN 'GA'   
            WHEN RTRIM(s.SEC_DESC) IN ('COOK', 'CS', 'DRIVER', 'SECURITY') THEN 'GA SERVICE'   
            WHEN RTRIM(s.SEC_DESC) IN ('UMUM', 'UTILITY') THEN 'MAINTENANCE'   
            ELSE RTRIM(d.DEP_DESC) 
          END AS TEAM_NAME
        FROM EMP_TABLE e
        LEFT JOIN MS_SEC s ON e.SEC_CD = s.SEC_CD
        LEFT JOIN MS_DEP d ON e.DEP_CD = d.DEP_CD
        WHERE e.Act_NonAct = 1 AND e.SEC_CD IS NOT NULL
        ORDER BY TEAM_NAME
      `),
    ]);

    return NextResponse.json({
      departemen: departemen.map((d: any) => ({ DEP_CD: d.DEP_CD?.trim(), DEP_DESC: d.DEP_DESC?.trim() })),
      seksi: seksi.map((s: any) => ({ SEC_CD: s.SEC_CD?.trim(), SEC_DESC: s.SEC_DESC?.trim(), GRP_CD: s.GRP_CD?.trim() })),
      jabatan: jabatan.map((j: any) => ({ JOB_CD: j.JOB_CD?.trim(), JOB_DESC: j.JOB_DESC?.trim() })),
      divisi: divisi.map((d: any) => ({ DIV_CD: d.DIV_CD?.trim(), DIV_DESC: d.DIV_DESC?.trim() })),
      jenisKaryawan: jenisKaryawan.map((j: any) => ({ JNS_CODE: j.JNS_CODE?.trim(), JNS_DESC: j.JNS_DESC?.trim() })),
      reasons: reasons.map((r: any) => ({ REASON_CODE: r.REASON_CODE?.trim(), REASON_DESC: r.REASON_DESC?.trim(), REASON_GROUP: r.REASON_GROUP?.trim() })),
      teams: teams.map((t: any) => t.TEAM_NAME?.trim()).filter(Boolean),
    });
  } catch (error: any) {
    console.error('API /master error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
