import { NextResponse } from 'next/server';
import { query, withTransaction } from '@/lib/db';
import { detectSecurityShift, isSecurityJob } from '@/lib/securitySchedule';

const parseDate = (value: unknown): Date | null => {
  if (!value) return null;
  const date = new Date(String(value).replace('Z', ''));
  return Number.isNaN(date.getTime()) ? null : date;
};

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const empCd = String(data.EMP_CD || '').trim();
    const dateTrans = String(data.DATE_TRANS || '').split('T')[0];
    const statusHari = data.corrected_status == null || data.corrected_status === '' ? null : String(data.corrected_status).trim();
    const reason = data.corrected_reason == null || data.corrected_reason === '' ? null : String(data.corrected_reason).trim();
    let cleanWorkIn = data.WORK_IN ? String(data.WORK_IN).replace('Z', '') : null;
    let cleanWorkOut = data.WORK_OUT ? String(data.WORK_OUT).replace('Z', '') : null;

    if (!empCd || !/^\d{4}-\d{2}-\d{2}$/.test(dateTrans)) {
      return NextResponse.json({ error: 'EMP_CD dan DATE_TRANS wajib valid.' }, { status: 400 });
    }

    const workInDate = parseDate(cleanWorkIn);
    const workOutDate = parseDate(cleanWorkOut);
    if (cleanWorkIn && !workInDate || cleanWorkOut && !workOutDate) {
      return NextResponse.json({ error: 'WORK_IN/WORK_OUT harus berupa timestamp valid.' }, { status: 400 });
    }

    // Normalisasi hanya untuk kandidat shift sore/malam; pembalikan pendek dianggap anomali.
    if (workInDate && workOutDate && workOutDate <= workInDate) {
      const inferredMinutes = (workOutDate.getHours() * 60 + workOutDate.getMinutes()) + 1440 - (workInDate.getHours() * 60 + workInDate.getMinutes());
      const isOvernightCandidate = workInDate.getHours() >= 14 && inferredMinutes >= 4 * 60 && inferredMinutes <= 16 * 60;
      if (!isOvernightCandidate) {
        return NextResponse.json({ error: 'WORK_OUT lebih awal dari WORK_IN; periksa pasangan fingerprint.' }, { status: 400 });
      }
      workOutDate.setDate(workOutDate.getDate() + 1);
      cleanWorkOut = workOutDate.toISOString().replace('Z', '');
    }

    const empCheck = await query<any>(`
      SELECT TOP 1
        RTRIM(e.EMP_NM) AS EMP_NM,
        RTRIM(ISNULL(j.JOB_DESC, '')) AS JOB_DESC,
        RTRIM(ISNULL(s.SEC_DESC, '')) AS SEC_DESC,
        RTRIM(ISNULL(a.SHIFT, '')) AS CURRENT_SHIFT
      FROM EMP_TABLE e
      LEFT JOIN MS_JOBS j ON RTRIM(e.JOB_CD) = RTRIM(j.JOB_CD)
      LEFT JOIN MS_SEC s ON RTRIM(e.SEC_CD) = RTRIM(s.SEC_CD)
      LEFT JOIN TR_ABSEN a ON RTRIM(a.EMP_CD) = RTRIM(e.EMP_CD) AND CONVERT(date, a.DATE_TRANS) = @dateTrans
      WHERE RTRIM(e.EMP_CD) = @empCd
    `, { empCd, dateTrans });

    if (!empCheck.length) {
      return NextResponse.json({ error: 'Karyawan tidak ditemukan.' }, { status: 404 });
    }

    const employee = empCheck[0];
    const security = isSecurityJob(employee.JOB_DESC, employee.SEC_DESC);
    const detectedShift = security ? detectSecurityShift(cleanWorkIn, cleanWorkOut) : null;
    const shift = detectedShift?.code || employee.CURRENT_SHIFT || null;

    await withTransaction(async (tx) => tx(`
      UPDATE TR_ABSEN
      SET
        WORK_IN = @workIn,
        WORK_OUT = @workOut,
        JAM_KERJA = CASE
          WHEN @workIn IS NOT NULL AND @workOut IS NOT NULL
            AND CAST(@workOut AS DATETIME) > CAST(@workIn AS DATETIME)
          THEN DATEDIFF(minute, CAST(@workIn AS DATETIME), CAST(@workOut AS DATETIME)) / 60.0
          ELSE NULL
        END,
        STATUS_HARI = ISNULL(@statusHari, STATUS_HARI),
        REASON = @reason,
        SHIFT = ISNULL(@shift, SHIFT)
      WHERE RTRIM(EMP_CD) = @empCd AND CONVERT(date, DATE_TRANS) = @dateTrans;
    `, { workIn: cleanWorkIn, workOut: cleanWorkOut, statusHari, reason, shift, empCd, dateTrans }));

    return NextResponse.json({
      success: true,
      shift: detectedShift?.code || null,
      message: detectedShift ? `Koreksi berhasil. SHIFT terdeteksi: ${detectedShift.code}.` : 'Koreksi absensi berhasil disimpan.'
    });
  } catch (error: any) {
    console.error('API /absensi/koreksi POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
