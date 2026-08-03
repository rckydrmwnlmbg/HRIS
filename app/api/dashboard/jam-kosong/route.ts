import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('date');

    if (!dateParam) {
      return NextResponse.json({ error: 'Date is required' }, { status: 400 });
    }

    const selectedDate = new Date(dateParam);
    const y = selectedDate.getFullYear();
    const m = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const d = String(selectedDate.getDate()).padStart(2, '0');
    const selectedDateStr = `${y}-${m}-${d}`;

    // Cek hari: 0=Minggu, 6=Sabtu
    const dayOfWeek = selectedDate.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return NextResponse.json({ data: [] }); // Hari libur, tidak ada yang perlu dicek
    }

    // Cek apakah tanggal yang dipilih adalah hari lampau (sebelum hari ini)
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);
    const ty = todayDate.getFullYear();
    const tm = String(todayDate.getMonth() + 1).padStart(2, '0');
    const td = String(todayDate.getDate()).padStart(2, '0');
    const todayDateStr = `${ty}-${tm}-${td}`;

    const checkDate = new Date(selectedDate);
    checkDate.setHours(0, 0, 0, 0);
    const isPastDay = checkDate < todayDate;
    const isToday = selectedDateStr === todayDateStr;

    // Jika hari ini, cek apakah fingerprint sudah disinkronkan
    if (isToday) {
      const syncCheck = await query<any>(`
        SELECT COUNT(*) as syncedCount
        FROM TR_ABSEN
        WHERE CONVERT(date, DATE_TRANS) = '${todayDateStr}'
          AND (WORK_IN IS NOT NULL OR WORK_OUT IS NOT NULL)
      `);
      if ((syncCheck[0]?.syncedCount || 0) === 0) {
        return NextResponse.json({ data: [], notSynced: true });
      }
    }

    // Strategi: Mulai dari SEMUA karyawan aktif pada tanggal tersebut, lalu LEFT JOIN ke TR_ABSEN
    const jamKosongListResult = await query<any>(`
      SELECT 
        RTRIM(e.EMP_CD) as EMP_CD, 
        RTRIM(e.EMP_NM) as EMP_NM, 
        RTRIM(s.SEC_DESC) as SEC_DESC, 
        RTRIM(e.SEC_CD) as SEC_CD,
        RTRIM(s.SEC_DESC) as BAGIAN,
        CASE WHEN UPPER(RTRIM(s.SEC_DESC)) LIKE '%LINE%' THEN 'SEWING' 
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
             ELSE RTRIM(dp.DEP_DESC) END AS TEAM,
        RTRIM(a.STATUS_HARI) as STATUS_HARI,
        RTRIM(a.REASON) as REASON,
        a.WORK_IN,
        a.WORK_IN1,
        a.WORK_OUT,
        a.WORK_OUT1,
        a.EMP_CD as TR_EMP_CD
      FROM EMP_TABLE e
      LEFT JOIN MS_SEC s ON RTRIM(e.SEC_CD) = RTRIM(s.SEC_CD)
      LEFT JOIN MS_DEP dp ON RTRIM(e.DEP_CD) = RTRIM(dp.DEP_CD)
      LEFT JOIN TR_ABSEN a ON RTRIM(e.EMP_CD) = RTRIM(a.EMP_CD) 
        AND CONVERT(date, a.DATE_TRANS) = '${selectedDateStr}'
      WHERE (CONVERT(varchar(10), e.DT_ENTRY, 120) <= '${selectedDateStr}')
        AND (e.DT_RSG IS NULL OR CONVERT(varchar(10), e.DT_RSG, 120) >= '${selectedDateStr}')
        AND (
          a.EMP_CD IS NULL 
          OR (
            (a.WORK_IN IS NULL OR LTRIM(RTRIM(CAST(a.WORK_IN AS varchar(50)))) = '' OR CONVERT(varchar(8), a.WORK_IN, 108) = '00:00:00')
            AND
            (a.WORK_IN1 IS NULL OR LTRIM(RTRIM(CAST(a.WORK_IN1 AS varchar(50)))) = '' OR CONVERT(varchar(8), a.WORK_IN1, 108) = '00:00:00')
          )
        )
    `);

    // Filter: hanya tampilkan yang berstatus KERJA / belum ada record
    // Kecualikan yang sudah tercatat Cuti, Sakit, Ijin, dll
    const reasonResult = await query<any>(`SELECT RTRIM(REASON_CODE) as REASON_CODE, RTRIM(REASON_GROUP) as REASON_GROUP FROM Ms_Reason`);
    const reasonMap = new Map<string, string>();
    reasonResult.forEach((r: any) => {
      if (r.REASON_CODE) reasonMap.set(r.REASON_CODE, r.REASON_GROUP || '');
    });

    const jamKosongList = jamKosongListResult.filter((r: any) => {
      // Jika karyawan belum ada record TR_ABSEN sama sekali, tampilkan (jam kosong!)
      if (!r.STATUS_HARI && !r.REASON && !r.TR_EMP_CD) return true;

      const status = (r.STATUS_HARI || '').trim().toUpperCase();
      const reasonGroup = reasonMap.get((r.REASON || '').trim()) || '';
      
      // Kecualikan yang sudah tercatat cuti/sakit/ijin/libur/dinas (Alpha tidak dikecualikan karena memang jam kosong)
      const excludedStatuses = ['C', 'CUTI', 'S', 'SAKIT', 'I', 'IJIN', 'L', 'LIBUR', 'H', 'HAID', 'DL'];
      const excludedGroups = ['C', 'H', 'S', 'I'];
      
      // Serta kecualikan karyawan yang SUDAH diberi REASON oleh HR yang sifatnya BUKAN Alpha (misal sudah fix Cuti)
      // JIKA HARI INI: abaikan REASON 'A' atau 'Alpha' (karena INUS suka otomatis mengisi ini, tetap anggap Jam Kosong)
      // JIKA HARI LAMPAU: percayai REASON 'A' atau 'Alpha' (sudah sah jadi Alpha, keluarkan dari Jam Kosong)
      const reasonLower = (r.REASON || '').trim().toLowerCase();
      
      const isUnverifiedAlphaToday = !isPastDay && (reasonLower === 'a' || reasonLower === 'alpha');
      const hasVerifiedReason = !!r.REASON && r.REASON.trim() !== '' && !isUnverifiedAlphaToday;
      
      if (excludedStatuses.includes(status)) return false;
      if (excludedGroups.includes(reasonGroup.toUpperCase())) return false;
      if (hasVerifiedReason) return false;

      return true;
    }).map((r: any) => {
      const hasOut = !!(r.WORK_OUT || r.WORK_OUT1) && !r.WORK_OUT?.toString().includes('00:00:00');
      const hasIn = !(!r.WORK_IN || r.WORK_IN.toString().trim() === '' || r.WORK_IN.toString().includes('00:00:00')) ||
                    !(!r.WORK_IN1 || r.WORK_IN1.toString().trim() === '' || r.WORK_IN1.toString().includes('00:00:00'));

      let keterangan_kosong = 'Belum Ada Rekaman Absen';
      if (r.TR_EMP_CD && hasOut && !hasIn) {
        keterangan_kosong = 'Lupa Tap Masuk';
      } else {
        keterangan_kosong = 'Belum Ada Rekaman Absen';
      }
      
      return {
        EMP_CD: r.EMP_CD,
        EMP_NM: r.EMP_NM,
        SEC_DESC: r.SEC_DESC,
        SEC_CD: r.SEC_CD,
        BAGIAN: r.BAGIAN,
        TEAM: r.TEAM,
        STATUS_HARI: r.STATUS_HARI,
        REASON: r.REASON,
        WORK_IN: r.WORK_IN || r.WORK_IN1 || null,
        WORK_OUT: r.WORK_OUT || null,
        keterangan_kosong
      };
    });

    return NextResponse.json({ data: jamKosongList });
  } catch (err: any) {
    console.error('API Error:', err);
    return NextResponse.json({ error: 'Failed to fetch jam kosong data' }, { status: 500 });
  }
}
