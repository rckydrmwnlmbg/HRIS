import { NextResponse } from 'next/server';
import { query, withTransaction } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const data = await request.json();

    const empCd = (data.EMP_CD || '').trim();
    const dateTrans = data.DATE_TRANS ? data.DATE_TRANS.split('T')[0] : '';
    const cleanWorkIn = data.WORK_IN ? data.WORK_IN.replace('Z', '') : null;
    const cleanWorkOut = data.WORK_OUT ? data.WORK_OUT.replace('Z', '') : null;
    const statusHari = data.corrected_status?.trim() || null;
    const reason = data.corrected_reason?.trim() || null;

    if (!empCd || !dateTrans) {
      return NextResponse.json({ error: 'EMP_CD dan DATE_TRANS wajib diisi.' }, { status: 400 });
    }

    // 1. Pengecekan Proteksi Khusus SECURITY / SATPAM
    const empCheck = await query<any>(`
      SELECT 
        RTRIM(e.EMP_CD) AS EMP_CD, 
        RTRIM(e.EMP_NM) AS EMP_NM, 
        RTRIM(ISNULL(j.JOB_DESC, '')) AS JOB_DESC, 
        RTRIM(ISNULL(s.SEC_DESC, '')) AS SEC_DESC
      FROM EMP_TABLE e
      LEFT JOIN MS_JOBS j ON RTRIM(e.JOB_CD) = RTRIM(j.JOB_CD)
      LEFT JOIN MS_SEC s ON RTRIM(e.SEC_CD) = RTRIM(s.SEC_CD)
      WHERE RTRIM(e.EMP_CD) = @empCd
    `, { empCd });

    if (empCheck && empCheck.length > 0) {
      const jobDesc = (empCheck[0].JOB_DESC || '').toUpperCase();
      const secDesc = (empCheck[0].SEC_DESC || '').toUpperCase();
      if (jobDesc.includes('SECURITY') || jobDesc.includes('SATPAM') || secDesc.includes('SECURITY') || secDesc.includes('SATPAM')) {
        return NextResponse.json({ 
          error: `Koreksi jam untuk ${empCheck[0].EMP_NM} (Divisi SECURITY/SATPAM) dinonaktifkan demi perlindungan data (menunggu modul Import Jadwal Resmi).` 
        }, { status: 403 });
      }
    }

    // 2. Eksekusi UPDATE dengan Parameterized Query & Transaction
    await withTransaction(async (tx) => {
      await tx(`
        UPDATE TR_ABSEN
        SET 
            WORK_IN = @workIn,
            WORK_OUT = @workOut,
            JAM_KERJA = CASE 
              WHEN @workIn IS NOT NULL AND @workOut IS NOT NULL AND CAST(@workOut AS DATETIME) > CAST(@workIn AS DATETIME)
              THEN 
                CASE 
                  WHEN (DATEDIFF(minute, CAST(@workIn AS DATETIME), CAST(@workOut AS DATETIME)) / 60.0) - FLOOR(DATEDIFF(minute, CAST(@workIn AS DATETIME), CAST(@workOut AS DATETIME)) / 60.0) < 0.50 
                  THEN FLOOR(DATEDIFF(minute, CAST(@workIn AS DATETIME), CAST(@workOut AS DATETIME)) / 60.0) 
                  ELSE FLOOR(DATEDIFF(minute, CAST(@workIn AS DATETIME), CAST(@workOut AS DATETIME)) / 60.0) + 0.50 
                END
              ELSE NULL
            END,
            STATUS_HARI = ISNULL(@statusHari, STATUS_HARI),
            REASON = @reason
        WHERE RTRIM(EMP_CD) = @empCd AND DATE_TRANS = @dateTrans;
      `, {
        workIn: cleanWorkIn,
        workOut: cleanWorkOut,
        statusHari,
        reason,
        empCd,
        dateTrans
      });
    });

    return NextResponse.json({ success: true, message: 'Koreksi absensi berhasil disimpan.' });
  } catch (error: any) {
    console.error('API /absensi/koreksi POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
