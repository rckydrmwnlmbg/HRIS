import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { clearCache } from '@/lib/cache';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const result = await query<any>(`
      SELECT 
        RTRIM(e.EMP_CD) AS EMP_CD,
        RTRIM(e.EMP_NM) AS EMP_NM,
        e.DT_ENTRY, e.DT_PROB, e.DT_BRT,
        RTRIM(e.PLC_BRT) AS PLC_BRT,
        RTRIM(e.ADRR) AS ADRR,
        RTRIM(e.CT) AS CT,
        RTRIM(e.SX) AS SX,
        RTRIM(e.NPWP) AS NPWP,
        RTRIM(e.PTKP_ST) AS PTKP_ST,
        RTRIM(e.noktp) AS noktp,
        RTRIM(e.agama) AS agama,
        RTRIM(e.telepon) AS telepon,
        RTRIM(e.ACC_NO) AS ACC_NO,
        RTRIM(e.DEP_CD) AS DEP_CD,
        RTRIM(e.SEC_CD) AS SEC_CD,
        RTRIM(e.JOB_CD) AS JOB_CD,
        RTRIM(e.DIV_CD) AS DIV_CD,
        RTRIM(e.JNS_KRY) AS JNS_KRY,
        e.Act_NonAct,
        e.DT_RSG,
        RTRIM(e.Status_Pekerjaan) AS Status_Pekerjaan,
        RTRIM(e.FLAG_OT) AS FLAG_OT,
        RTRIM(e.ALL_IN) AS ALL_IN,
        RTRIM(e.SPSI_NO) AS SPSI_NO,
        RTRIM(e.IMG_NM) AS IMG_NM,
        RTRIM(e.No_Reg) AS No_Reg,
        e.BS_SLR,
        RTRIM(e.OUT_CD) AS OUT_CD,
        RTRIM(d.DEP_DESC) AS DEP_DESC,
        RTRIM(s.SEC_DESC) AS SEC_DESC,
        RTRIM(j.JOB_DESC) AS JOB_DESC,
        CASE   WHEN UPPER(RTRIM(s.SEC_DESC)) LIKE '%LINE%' THEN 'SEWING'   WHEN RTRIM(s.SEC_DESC) IN ('BUTTON', 'PATTERN SEAMER') THEN 'SEWING'   WHEN RTRIM(s.SEC_DESC) IN ('BANDLELING', 'CUTTING', 'GANTI BS', 'GELAR', 'GELAR INTERLINING', 'LOADING', 'MARKER', 'NUMBERING', 'PIPING', 'PRESS', 'RELAX') THEN 'CUTTING'   WHEN RTRIM(s.SEC_DESC) IN ('MEKANIK') THEN 'MECHANIC'   WHEN RTRIM(s.SEC_DESC) IN ('LAB', 'PSO', 'QA', 'QC ACCURACY') THEN 'QA'   WHEN RTRIM(s.SEC_DESC) IN ('IE') THEN 'IE'   WHEN RTRIM(s.SEC_DESC) IN ('ACCESSORIES', 'FABRIC', 'IT INVENTORY', 'MATERIAL MGMT', 'TRANSFER') THEN 'WAREHOUSE'   WHEN RTRIM(s.SEC_DESC) IN ('IRONING') THEN 'FINISHING'   WHEN RTRIM(s.SEC_DESC) IN ('PACKING', 'WAREHOUSE') THEN 'PACKING'   WHEN RTRIM(s.SEC_DESC) IN ('END LINE', 'END LINE SPARE', 'IN LINE', 'QC CUTTING', 'QC FABRIC', 'QC FINISHING', 'QC SEWING', 'QC SIZESPEC') THEN 'QC'   WHEN RTRIM(s.SEC_DESC) IN ('ORDER MGMT.') THEN 'PPIC'   WHEN RTRIM(s.SEC_DESC) IN ('CAD MARKER', 'CAD PATTERN', 'SAMPLE', 'SEWING PATTERN') THEN 'SAMPLE'   WHEN RTRIM(s.SEC_DESC) IN ('OFFICE PRODUKSI') THEN 'PROD.  OFFICE'   WHEN RTRIM(s.SEC_DESC) IN ('CLINIC', 'COMPLIANCE', 'HR') THEN 'HRC'   WHEN RTRIM(s.SEC_DESC) IN ('ACC/FIN', 'ACCOUNTING', 'FINANCE', 'PURCHASE') THEN 'ACCOUNTING'   WHEN RTRIM(s.SEC_DESC) IN ('EXIM', 'EXPORT', 'IMPORT', 'SUB-CON') THEN 'EXIM'   WHEN RTRIM(s.SEC_DESC) IN ('5 S', 'IT') THEN 'GA'   WHEN RTRIM(s.SEC_DESC) IN ('COOK', 'CS', 'DRIVER', 'SECURITY') THEN 'GA SERVICE'   WHEN RTRIM(s.SEC_DESC) IN ('UMUM', 'UTILITY') THEN 'MAINTENANCE'   ELSE RTRIM(d.DEP_DESC) END AS TEAM,
        RTRIM(jk.JNS_DESC) AS JNS_DESC,
        RTRIM(dv.DIV_DESC) AS DIV_DESC
      FROM EMP_TABLE e
      LEFT JOIN MS_DEP d ON e.DEP_CD = d.DEP_CD
      LEFT JOIN MS_SEC s ON e.SEC_CD = s.SEC_CD
      LEFT JOIN MS_JOBS j ON e.JOB_CD = j.JOB_CD
      LEFT JOIN MSJNS_KRY jk ON e.JNS_KRY = jk.JNS_CODE
      LEFT JOIN MS_DIV dv ON e.DIV_CD = dv.DIV_CD
      WHERE e.EMP_CD = '${id.replace(/'/g, "''")}'
    `);

    if (result.length === 0) {
      return NextResponse.json({ error: 'Karyawan tidak ditemukan' }, { status: 404 });
    }

    return NextResponse.json(result[0]);
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const employeeId = String(id || '').trim();
    const data = await request.json();
    if (!employeeId) return NextResponse.json({ error: 'ID karyawan wajib diisi.' }, { status: 400 });

    const updates: string[] = [];
    const values: Record<string, any> = { employeeId };
    const stringFields = [
      'EMP_NM', 'DEP_CD', 'SEC_CD', 'JOB_CD', 'JNS_KRY', 'DIV_CD', 'PLC_BRT', 'ADRR', 'CT',
      'SX', 'agama', 'noktp', 'telepon', 'NPWP', 'PTKP_ST', 'ACC_NO', 'FLAG_OT', 'ALL_IN'
    ];
    const dateFields = ['DT_ENTRY', 'DT_RSG', 'DT_BRT'];

    for (const field of stringFields) {
      if (data[field] !== undefined) {
        if (data[field] !== null && typeof data[field] !== 'string') {
          return NextResponse.json({ error: `${field} harus berupa teks atau null.` }, { status: 400 });
        }
        if (typeof data[field] === 'string' && data[field].length > 255) {
          return NextResponse.json({ error: `${field} terlalu panjang.` }, { status: 400 });
        }
        updates.push(`${field} = @${field}`);
        values[field] = data[field];
      }
    }

    for (const field of dateFields) {
      if (data[field] !== undefined) {
        if (data[field] !== null && (typeof data[field] !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(data[field]))) {
          return NextResponse.json({ error: `${field} harus berformat YYYY-MM-DD atau null.` }, { status: 400 });
        }
        updates.push(`${field} = @${field}`);
        values[field] = data[field] || null;
      }
    }

    if (data.Act_NonAct !== undefined) {
      if (![0, 1, true, false].includes(data.Act_NonAct)) {
        return NextResponse.json({ error: 'Act_NonAct harus bernilai 0, 1, true, atau false.' }, { status: 400 });
      }
      updates.push('Act_NonAct = @Act_NonAct');
      values.Act_NonAct = data.Act_NonAct ? 1 : 0;
    }

    if (!updates.length) return NextResponse.json({ error: 'Tidak ada field yang dapat diubah.' }, { status: 400 });

    const existing = await query<any>(
      'SELECT TOP 1 EMP_CD FROM EMP_TABLE WHERE RTRIM(EMP_CD) = @employeeId',
      { employeeId }
    );
    if (!existing.length) return NextResponse.json({ error: 'Karyawan tidak ditemukan.' }, { status: 404 });

    await query(
      `UPDATE EMP_TABLE SET ${updates.join(', ')} WHERE RTRIM(EMP_CD) = @employeeId`,
      values
    );
    clearCache('karyawan_');

    return NextResponse.json({ success: true, message: 'Data karyawan berhasil diperbarui.' });
  } catch (error: any) {
    console.error('API /karyawan/[id] PUT error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
