import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const data = await request.json();

    // Sanitasi input dasar
    const empCd = data.EMP_CD?.replace(/'/g, "''");
    // Hilangkan 'Z' agar format ISO dapat dibaca aman sebagai Local Time oleh SQL Server
    const dateTrans = data.DATE_TRANS ? data.DATE_TRANS.split('T')[0] : '';
    const workIn = data.WORK_IN ? `'${data.WORK_IN.replace('Z', '')}'` : 'NULL';
    const workOut = data.WORK_OUT ? `'${data.WORK_OUT.replace('Z', '')}'` : 'NULL';
    const statusHari = data.corrected_status?.replace(/'/g, "''") || '';
    const reason = data.corrected_reason?.replace(/'/g, "''") || '';

    // Rumus JAM_KERJA Desimal Sejati (+0.50)
    const jamKerjaExpr = data.WORK_IN && data.WORK_OUT ? `
      CASE 
        WHEN (DATEDIFF(minute, ${workIn}, ${workOut}) / 60.0) - FLOOR(DATEDIFF(minute, ${workIn}, ${workOut}) / 60.0) < 0.50 
        THEN FLOOR(DATEDIFF(minute, ${workIn}, ${workOut}) / 60.0) 
        ELSE FLOOR(DATEDIFF(minute, ${workIn}, ${workOut}) / 60.0) + 0.50 
      END
    ` : 'NULL';

    // Langsung UPDATE TR_ABSEN tanpa tabel audit (sesuai kesepakatan)
    const sqlUpdate = `
      UPDATE TR_ABSEN
      SET 
          WORK_IN = ${workIn},
          WORK_OUT = ${workOut},
          JAM_KERJA = ${jamKerjaExpr},
          STATUS_HARI = '${statusHari}',
          REASON = '${reason}'
      WHERE RTRIM(EMP_CD) = '${empCd}' AND DATE_TRANS = '${dateTrans}';
    `;

    await query(sqlUpdate);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('API /absensi/koreksi POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
