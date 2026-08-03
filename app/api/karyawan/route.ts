import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCache, setCache } from '@/lib/cache';

// GET /api/karyawan — Fetch employee list with joined master data
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'semua'; // aktif | tidak | semua
    const sec = searchParams.get('sec') || '';
    const job = searchParams.get('job') || '';
    const jns = searchParams.get('jns') || '';
    const search = searchParams.get('q') || '';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const allIn = searchParams.get('allIn') || '';
    const cacheKey = `karyawan_${status}_${sec}_${job}_${jns}_${allIn}_${search}_${page}_${limit}`;
    const cachedData = getCache(cacheKey);
    if (cachedData) {
      return NextResponse.json(cachedData);
    }

    let whereClause = 'WHERE 1=1';
    if (status === 'aktif') {
      whereClause += ` AND e.Act_NonAct = 1 
        AND (e.DT_RSG IS NULL OR e.DT_RSG > GETDATE())`;
    }
    else if (status === 'tidak') whereClause += ' AND e.Act_NonAct = 0';
    if (sec) whereClause += ` AND e.SEC_CD = '${sec.replace(/'/g, "''")}'`;
    if (job) {
      const teamCase = `CASE   WHEN UPPER(RTRIM(s.SEC_DESC)) LIKE '%LINE%' THEN 'SEWING'   WHEN RTRIM(s.SEC_DESC) IN ('BUTTON', 'PATTERN SEAMER') THEN 'SEWING'   WHEN RTRIM(s.SEC_DESC) IN ('BANDLELING', 'CUTTING', 'GANTI BS', 'GELAR', 'GELAR INTERLINING', 'LOADING', 'MARKER', 'NUMBERING', 'PIPING', 'PRESS', 'RELAX') THEN 'CUTTING'   WHEN RTRIM(s.SEC_DESC) IN ('MEKANIK') THEN 'MECHANIC'   WHEN RTRIM(s.SEC_DESC) IN ('LAB', 'PSO', 'QA', 'QC ACCURACY') THEN 'QA'   WHEN RTRIM(s.SEC_DESC) IN ('IE') THEN 'IE'   WHEN RTRIM(s.SEC_DESC) IN ('ACCESSORIES', 'FABRIC', 'IT INVENTORY', 'MATERIAL MGMT', 'TRANSFER') THEN 'WAREHOUSE'   WHEN RTRIM(s.SEC_DESC) IN ('IRONING') THEN 'FINISHING'   WHEN RTRIM(s.SEC_DESC) IN ('PACKING', 'WAREHOUSE') THEN 'PACKING'   WHEN RTRIM(s.SEC_DESC) IN ('END LINE', 'END LINE SPARE', 'IN LINE', 'QC CUTTING', 'QC FABRIC', 'QC FINISHING', 'QC SEWING', 'QC SIZESPEC') THEN 'QC'   WHEN RTRIM(s.SEC_DESC) IN ('ORDER MGMT.') THEN 'PPIC'   WHEN RTRIM(s.SEC_DESC) IN ('CAD MARKER', 'CAD PATTERN', 'SAMPLE', 'SEWING PATTERN') THEN 'SAMPLE'   WHEN RTRIM(s.SEC_DESC) IN ('OFFICE PRODUKSI') THEN 'PROD.  OFFICE'   WHEN RTRIM(s.SEC_DESC) IN ('CLINIC', 'COMPLIANCE', 'HR') THEN 'HRC'   WHEN RTRIM(s.SEC_DESC) IN ('ACC/FIN', 'ACCOUNTING', 'FINANCE', 'PURCHASE') THEN 'ACCOUNTING'   WHEN RTRIM(s.SEC_DESC) IN ('EXIM', 'EXPORT', 'IMPORT', 'SUB-CON') THEN 'EXIM'   WHEN RTRIM(s.SEC_DESC) IN ('5 S', 'IT') THEN 'GA'   WHEN RTRIM(s.SEC_DESC) IN ('COOK', 'CS', 'DRIVER', 'SECURITY') THEN 'GA SERVICE'   WHEN RTRIM(s.SEC_DESC) IN ('UMUM', 'UTILITY') THEN 'MAINTENANCE'   ELSE RTRIM(d.DEP_DESC) END`;
      whereClause += ` AND (${teamCase}) = '${job.replace(/'/g, "''")}'`;
    }
    if (jns) whereClause += ` AND e.JNS_KRY = '${jns.replace(/'/g, "''")}'`;
    
    if (allIn === '1') {
      whereClause += ` AND (e.ALL_IN = '1' OR e.ALL_IN = 'Y' OR e.ALL_IN = 'true')`;
    }
    
    if (search) whereClause += ` AND (e.EMP_CD LIKE '%${search.replace(/'/g, "''")}%' OR e.EMP_NM LIKE '%${search.replace(/'/g, "''")}%')`;

    const offset = (page - 1) * limit;

    const [countResult, listResult] = await Promise.all([
      query<any>(`
        SELECT COUNT(*) as total 
        FROM EMP_TABLE e 
        LEFT JOIN MS_SEC s ON e.SEC_CD = s.SEC_CD
        LEFT JOIN MS_DEP d ON e.DEP_CD = d.DEP_CD
        ${whereClause}
      `),
      query<any>(`
        SELECT 
          RTRIM(e.EMP_CD) AS EMP_CD,
          RTRIM(e.EMP_NM) AS EMP_NM,
          RTRIM(e.DEP_CD) AS DEP_CD,
          RTRIM(e.SEC_CD) AS SEC_CD,
          RTRIM(e.JOB_CD) AS JOB_CD,
          RTRIM(e.JNS_KRY) AS JNS_KRY,
          e.DT_ENTRY,
          RTRIM(e.SX) AS SX,
          RTRIM(e.agama) AS agama,
          RTRIM(e.ALL_IN) AS ALL_IN,
          e.Act_NonAct,
          RTRIM(d.DEP_DESC) AS DEP_DESC,
          RTRIM(s.SEC_DESC) AS SEC_DESC,
          RTRIM(j.JOB_DESC) AS JOB_DESC,
        CASE   WHEN UPPER(RTRIM(s.SEC_DESC)) LIKE '%LINE%' THEN 'SEWING'   WHEN RTRIM(s.SEC_DESC) IN ('BUTTON', 'PATTERN SEAMER') THEN 'SEWING'   WHEN RTRIM(s.SEC_DESC) IN ('BANDLELING', 'CUTTING', 'GANTI BS', 'GELAR', 'GELAR INTERLINING', 'LOADING', 'MARKER', 'NUMBERING', 'PIPING', 'PRESS', 'RELAX') THEN 'CUTTING'   WHEN RTRIM(s.SEC_DESC) IN ('MEKANIK') THEN 'MECHANIC'   WHEN RTRIM(s.SEC_DESC) IN ('LAB', 'PSO', 'QA', 'QC ACCURACY') THEN 'QA'   WHEN RTRIM(s.SEC_DESC) IN ('IE') THEN 'IE'   WHEN RTRIM(s.SEC_DESC) IN ('ACCESSORIES', 'FABRIC', 'IT INVENTORY', 'MATERIAL MGMT', 'TRANSFER') THEN 'WAREHOUSE'   WHEN RTRIM(s.SEC_DESC) IN ('IRONING') THEN 'FINISHING'   WHEN RTRIM(s.SEC_DESC) IN ('PACKING', 'WAREHOUSE') THEN 'PACKING'   WHEN RTRIM(s.SEC_DESC) IN ('END LINE', 'END LINE SPARE', 'IN LINE', 'QC CUTTING', 'QC FABRIC', 'QC FINISHING', 'QC SEWING', 'QC SIZESPEC') THEN 'QC'   WHEN RTRIM(s.SEC_DESC) IN ('ORDER MGMT.') THEN 'PPIC'   WHEN RTRIM(s.SEC_DESC) IN ('CAD MARKER', 'CAD PATTERN', 'SAMPLE', 'SEWING PATTERN') THEN 'SAMPLE'   WHEN RTRIM(s.SEC_DESC) IN ('OFFICE PRODUKSI') THEN 'PROD.  OFFICE'   WHEN RTRIM(s.SEC_DESC) IN ('CLINIC', 'COMPLIANCE', 'HR') THEN 'HRC'   WHEN RTRIM(s.SEC_DESC) IN ('ACC/FIN', 'ACCOUNTING', 'FINANCE', 'PURCHASE') THEN 'ACCOUNTING'   WHEN RTRIM(s.SEC_DESC) IN ('EXIM', 'EXPORT', 'IMPORT', 'SUB-CON') THEN 'EXIM'   WHEN RTRIM(s.SEC_DESC) IN ('5 S', 'IT') THEN 'GA'   WHEN RTRIM(s.SEC_DESC) IN ('COOK', 'CS', 'DRIVER', 'SECURITY') THEN 'GA SERVICE'   WHEN RTRIM(s.SEC_DESC) IN ('UMUM', 'UTILITY') THEN 'MAINTENANCE'   ELSE RTRIM(d.DEP_DESC) END AS TEAM,
          RTRIM(jk.JNS_DESC) AS JNS_DESC
      FROM EMP_TABLE e
      LEFT JOIN MS_DEP d ON e.DEP_CD = d.DEP_CD
      LEFT JOIN MS_SEC s ON e.SEC_CD = s.SEC_CD
      LEFT JOIN MS_JOBS j ON e.JOB_CD = j.JOB_CD
      LEFT JOIN MSJNS_KRY jk ON e.JNS_KRY = jk.JNS_CODE
        ${whereClause}
        ORDER BY e.EMP_NM ASC
        OFFSET ${offset} ROWS
        FETCH NEXT ${limit} ROWS ONLY
      `)
    ]);

    const total = countResult[0]?.total || 0;
    const responseData = {
      data: listResult,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };

    setCache(cacheKey, responseData, 60); // Cache for 60 seconds

    return NextResponse.json(responseData);
  } catch (error: any) {
    console.error('API /karyawan error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();

    const cols = [];
    const vals = [];

    if (data.EMP_CD) { cols.push('EMP_CD'); vals.push(`'${data.EMP_CD.replace(/'/g, "''")}'`); }
    if (data.EMP_NM) { cols.push('EMP_NM'); vals.push(`'${data.EMP_NM.replace(/'/g, "''")}'`); }
    if (data.DEP_CD) { cols.push('DEP_CD'); vals.push(`'${data.DEP_CD.replace(/'/g, "''")}'`); }
    if (data.SEC_CD) { cols.push('SEC_CD'); vals.push(`'${data.SEC_CD.replace(/'/g, "''")}'`); }
    if (data.JOB_CD) { cols.push('JOB_CD'); vals.push(`'${data.JOB_CD.replace(/'/g, "''")}'`); }
    if (data.JNS_KRY) { cols.push('JNS_KRY'); vals.push(`'${data.JNS_KRY.replace(/'/g, "''")}'`); }
    if (data.DIV_CD) { cols.push('DIV_CD'); vals.push(`'${data.DIV_CD.replace(/'/g, "''")}'`); }
    if (data.ALL_IN) { cols.push('ALL_IN'); vals.push(`'${data.ALL_IN.replace(/'/g, "''")}'`); }

    cols.push('Act_NonAct'); vals.push(data.Act_NonAct !== undefined ? (data.Act_NonAct ? 1 : 0) : 1);

    if (data.DT_ENTRY) { cols.push('DT_ENTRY'); vals.push(`'${data.DT_ENTRY}'`); }
    if (data.DT_BRT) { cols.push('DT_BRT'); vals.push(`'${data.DT_BRT}'`); }

    if (data.PLC_BRT) { cols.push('PLC_BRT'); vals.push(`'${data.PLC_BRT.replace(/'/g, "''")}'`); }
    if (data.ADRR) { cols.push('ADRR'); vals.push(`'${data.ADRR.replace(/'/g, "''")}'`); }
    if (data.CT) { cols.push('CT'); vals.push(`'${data.CT.replace(/'/g, "''")}'`); }
    if (data.SX) { cols.push('SX'); vals.push(`'${data.SX.replace(/'/g, "''")}'`); }
    if (data.agama) { cols.push('agama'); vals.push(`'${data.agama.replace(/'/g, "''")}'`); }
    if (data.noktp) { cols.push('noktp'); vals.push(`'${data.noktp.replace(/'/g, "''")}'`); }
    if (data.telepon) { cols.push('telepon'); vals.push(`'${data.telepon.replace(/'/g, "''")}'`); }
    if (data.NPWP) { cols.push('NPWP'); vals.push(`'${data.NPWP.replace(/'/g, "''")}'`); }
    if (data.PTKP_ST) { cols.push('PTKP_ST'); vals.push(`'${data.PTKP_ST.replace(/'/g, "''")}'`); }
    if (data.ACC_NO) { cols.push('ACC_NO'); vals.push(`'${data.ACC_NO.replace(/'/g, "''")}'`); }

    await query(`
      INSERT INTO EMP_TABLE (${cols.join(', ')})
      VALUES (${vals.join(', ')})
    `);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('API /karyawan POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
