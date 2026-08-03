import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const bulan = searchParams.get('bulan') || new Date().getMonth() + 1;
    const tahun = searchParams.get('tahun') || new Date().getFullYear();

    const result = await query<any>(`
      SELECT 
        l.ID,
        CONVERT(varchar(10), l.DATE_TRANS, 120) AS DATE_TRANS,
        RTRIM(l.EMP_CD) AS EMP_CD,
        RTRIM(e.EMP_NM) AS EMP_NM,
        l.JAM_MULAI,
        l.JAM_SELESAI,
        l.NOMINAL,
        CONVERT(varchar(19), l.CREATED_AT, 120) AS CREATED_AT,
        RTRIM(l.CREATED_BY) AS CREATED_BY,
        RTRIM(j.JOB_DESC) AS JOB_DESC,
        CASE   WHEN UPPER(RTRIM(sec.SEC_DESC)) LIKE '%LINE%' THEN 'SEWING'   WHEN RTRIM(sec.SEC_DESC) IN ('BUTTON', 'PATTERN SEAMER') THEN 'SEWING'   WHEN RTRIM(sec.SEC_DESC) IN ('BANDLELING', 'CUTTING', 'GANTI BS', 'GELAR', 'GELAR INTERLINING', 'LOADING', 'MARKER', 'NUMBERING', 'PIPING', 'PRESS', 'RELAX') THEN 'CUTTING'   WHEN RTRIM(sec.SEC_DESC) IN ('MEKANIK') THEN 'MECHANIC'   WHEN RTRIM(sec.SEC_DESC) IN ('LAB', 'PSO', 'QA', 'QC ACCURACY') THEN 'QA'   WHEN RTRIM(sec.SEC_DESC) IN ('IE') THEN 'IE'   WHEN RTRIM(sec.SEC_DESC) IN ('ACCESSORIES', 'FABRIC', 'IT INVENTORY', 'MATERIAL MGMT', 'TRANSFER') THEN 'WAREHOUSE'   WHEN RTRIM(sec.SEC_DESC) IN ('IRONING') THEN 'FINISHING'   WHEN RTRIM(sec.SEC_DESC) IN ('PACKING', 'WAREHOUSE') THEN 'PACKING'   WHEN RTRIM(sec.SEC_DESC) IN ('END LINE', 'END LINE SPARE', 'IN LINE', 'QC CUTTING', 'QC FABRIC', 'QC FINISHING', 'QC SEWING', 'QC SIZESPEC') THEN 'QC'   WHEN RTRIM(sec.SEC_DESC) IN ('ORDER MGMT.') THEN 'PPIC'   WHEN RTRIM(sec.SEC_DESC) IN ('CAD MARKER', 'CAD PATTERN', 'SAMPLE', 'SEWING PATTERN') THEN 'SAMPLE'   WHEN RTRIM(sec.SEC_DESC) IN ('OFFICE PRODUKSI') THEN 'PROD.  OFFICE'   WHEN RTRIM(sec.SEC_DESC) IN ('CLINIC', 'COMPLIANCE', 'HR') THEN 'HRC'   WHEN RTRIM(sec.SEC_DESC) IN ('ACC/FIN', 'ACCOUNTING', 'FINANCE', 'PURCHASE') THEN 'ACCOUNTING'   WHEN RTRIM(sec.SEC_DESC) IN ('EXIM', 'EXPORT', 'IMPORT', 'SUB-CON') THEN 'EXIM'   WHEN RTRIM(sec.SEC_DESC) IN ('5 S', 'IT') THEN 'GA'   WHEN RTRIM(sec.SEC_DESC) IN ('COOK', 'CS', 'DRIVER', 'SECURITY') THEN 'GA SERVICE'   WHEN RTRIM(sec.SEC_DESC) IN ('UMUM', 'UTILITY') THEN 'MAINTENANCE'   ELSE RTRIM(d.DEP_DESC) END AS TEAM,
        RTRIM(sec.SEC_DESC) AS SEC_DESC,
        RTRIM(d.DEP_DESC) AS DEP_DESC
      FROM TR_LEMBUR_ALLIN l
      LEFT JOIN EMP_TABLE e ON RTRIM(l.EMP_CD) = RTRIM(e.EMP_CD)
      LEFT JOIN MS_JOBS j ON RTRIM(e.JOB_CD) = RTRIM(j.JOB_CD)
      LEFT JOIN MS_SEC sec ON RTRIM(e.SEC_CD) = RTRIM(sec.SEC_CD)
      LEFT JOIN MS_DEP d ON RTRIM(e.DEP_CD) = RTRIM(d.DEP_CD)
      WHERE MONTH(l.DATE_TRANS) = ${bulan} 
        AND YEAR(l.DATE_TRANS) = ${tahun}
      ORDER BY l.DATE_TRANS DESC, l.CREATED_AT DESC
    `);

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { empCd, dateTrans, jamMulai, jamSelesai, nominal, createdBy } = body;

    if (!empCd || !dateTrans || !jamMulai || !jamSelesai || nominal === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    await query(`
      INSERT INTO TR_LEMBUR_ALLIN (DATE_TRANS, EMP_CD, JAM_MULAI, JAM_SELESAI, NOMINAL, CREATED_BY)
      VALUES (
        '${dateTrans}', 
        '${empCd?.replace(/'/g, "''")}', 
        '${jamMulai}', 
        '${jamSelesai}', 
        ${nominal}, 
        '${(createdBy || 'Admin').replace(/'/g, "''")}'
      )
    `);

    return NextResponse.json({ message: 'Data lembur ALL IN berhasil disimpan' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    await query(`DELETE FROM TR_LEMBUR_ALLIN WHERE ID = ${id}`);
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
