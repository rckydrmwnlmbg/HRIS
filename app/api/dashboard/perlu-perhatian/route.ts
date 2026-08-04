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

    // Cek hari: 0=Minggu, 6=Sabtu (Sabtu/Minggu libur pabrik)
    const dayOfWeek = selectedDate.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return NextResponse.json({ data: [] });
    }

    // Ambil karyawan aktif yang memiliki jam masuk DAN jam pulang pada tanggal tersebut
    const rawAbsenResult = await query<any>(`
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
        a.JAM_KERJA
      FROM EMP_TABLE e
      LEFT JOIN MS_SEC s ON RTRIM(e.SEC_CD) = RTRIM(s.SEC_CD)
      LEFT JOIN MS_DEP dp ON RTRIM(e.DEP_CD) = RTRIM(dp.DEP_CD)
      JOIN TR_ABSEN a ON RTRIM(e.EMP_CD) = RTRIM(a.EMP_CD) 
        AND CONVERT(date, a.DATE_TRANS) = '${selectedDateStr}'
      WHERE (CONVERT(varchar(10), e.DT_ENTRY, 120) <= '${selectedDateStr}')
        AND (e.DT_RSG IS NULL OR CONVERT(varchar(10), e.DT_RSG, 120) >= '${selectedDateStr}')
        AND (
          (a.WORK_IN IS NOT NULL AND LTRIM(RTRIM(CAST(a.WORK_IN AS varchar(50)))) != '' AND CONVERT(varchar(8), a.WORK_IN, 108) != '00:00:00')
          OR (a.WORK_IN1 IS NOT NULL AND LTRIM(RTRIM(CAST(a.WORK_IN1 AS varchar(50)))) != '' AND CONVERT(varchar(8), a.WORK_IN1, 108) != '00:00:00')
        )
        AND (
          (a.WORK_OUT IS NOT NULL AND LTRIM(RTRIM(CAST(a.WORK_OUT AS varchar(50)))) != '' AND CONVERT(varchar(8), a.WORK_OUT, 108) != '00:00:00')
          OR (a.WORK_OUT1 IS NOT NULL AND LTRIM(RTRIM(CAST(a.WORK_OUT1 AS varchar(50)))) != '' AND CONVERT(varchar(8), a.WORK_OUT1, 108) != '00:00:00')
        )
    `);

    const reasonResult = await query<any>(`SELECT RTRIM(REASON_CODE) as REASON_CODE, RTRIM(REASON_GROUP) as REASON_GROUP FROM Ms_Reason`);
    const reasonMap = new Map<string, string>();
    reasonResult.forEach((r: any) => {
      if (r.REASON_CODE) reasonMap.set(r.REASON_CODE, r.REASON_GROUP || '');
    });

    const excludedStatuses = ['C', 'CUTI', 'S', 'SAKIT', 'I', 'IJIN', 'L', 'LIBUR', 'H', 'HAID', 'DL'];
    const excludedGroups = ['C', 'H', 'S', 'I'];

    const perluPerhatianList: any[] = [];

    rawAbsenResult.forEach((r: any) => {
      const status = (r.STATUS_HARI || '').trim().toUpperCase();
      const reasonGroup = (reasonMap.get((r.REASON || '').trim()) || '').toUpperCase();

      if (excludedStatuses.includes(status) || excludedGroups.includes(reasonGroup)) {
        return;
      }

      // Format time string HH:mm:ss
      const inRaw = r.WORK_IN || r.WORK_IN1;
      const outRaw = r.WORK_OUT || r.WORK_OUT1;
      if (!inRaw || !outRaw) return;

      const inStr = inRaw instanceof Date ? inRaw.toTimeString().substring(0, 8) : String(inRaw).substring(0, 8);
      const outStr = outRaw instanceof Date ? outRaw.toTimeString().substring(0, 8) : String(outRaw).substring(0, 8);

      const inParts = inStr.split(':').map(Number);
      const outParts = outStr.split(':').map(Number);
      if (inParts.length < 2 || outParts.length < 2) return;

      const inDec = inParts[0] + inParts[1] / 60 + (inParts[2] || 0) / 3600;
      const outDec = outParts[0] + outParts[1] / 60 + (outParts[2] || 0) / 3600;

      let durationHours = outDec - inDec;
      if (durationHours < 0) durationHours += 24; // Cross midnight

      // Istirahat 1 jam jika melewati jam istirahat
      let netWorkHours = durationHours;
      if (inDec < 12.0 && outDec > 13.0) {
        netWorkHours = Math.max(0, durationHours - 1.0);
      }

      const jk = Number(r.JAM_KERJA) > 0 ? Number(r.JAM_KERJA) : Math.round(netWorkHours * 10) / 10;

      // 1. Anomali Durasi Sangat Singkat (<= 30 menit / 0.5 jam)
      if (durationHours <= 0.5) {
        const diffMinutes = Math.round(durationHours * 60);
        perluPerhatianList.push({
          EMP_CD: r.EMP_CD,
          EMP_NM: r.EMP_NM,
          SEC_DESC: r.SEC_DESC,
          SEC_CD: r.SEC_CD,
          BAGIAN: r.BAGIAN,
          TEAM: r.TEAM,
          WORK_IN: inStr,
          WORK_OUT: outStr,
          jam_kerja: jk,
          jenis_anomali: 'DURASI_SINGKAT',
          keterangan: `Durasi Sangat Singkat (${diffMinutes} menit) - Kemungkinan salah tap`
        });
        return;
      }

      // 2. Anomali Pulang Lebih Awal (< 16:00 dan jam kerja < 7 jam)
      if (outDec < 16.0 && jk < 7.0) {
        const kurangJam = (7.0 - jk).toFixed(1);
        perluPerhatianList.push({
          EMP_CD: r.EMP_CD,
          EMP_NM: r.EMP_NM,
          SEC_DESC: r.SEC_DESC,
          SEC_CD: r.SEC_CD,
          BAGIAN: r.BAGIAN,
          TEAM: r.TEAM,
          WORK_IN: inStr,
          WORK_OUT: outStr,
          jam_kerja: jk,
          jenis_anomali: 'PULANG_CEPAT',
          keterangan: `Pulang Lebih Awal pukul ${outStr.substring(0, 5)} (Jam kerja ${jk} jam, kurang ${kurangJam} jam)`
        });
        return;
      }

      // 3. Anomali Terlambat (> 07:15)
      if (inDec > 7.25) {
        const telatMenit = Math.round((inDec - 7.0) * 60);
        perluPerhatianList.push({
          EMP_CD: r.EMP_CD,
          EMP_NM: r.EMP_NM,
          SEC_DESC: r.SEC_DESC,
          SEC_CD: r.SEC_CD,
          BAGIAN: r.BAGIAN,
          TEAM: r.TEAM,
          WORK_IN: inStr,
          WORK_OUT: outStr,
          jam_kerja: jk,
          jenis_anomali: 'TERLAMBAT',
          keterangan: `Terlambat Masuk pukul ${inStr.substring(0, 5)} (Telat ${telatMenit} menit)`
        });
      }
    });

    return NextResponse.json({ data: perluPerhatianList });
  } catch (err: any) {
    console.error('API Error /api/dashboard/perlu-perhatian:', err);
    return NextResponse.json({ error: 'Failed to fetch perlu perhatian data' }, { status: 500 });
  }
}
