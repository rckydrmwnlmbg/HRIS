import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const startDateParam = searchParams.get('startDate') || searchParams.get('date');
    const endDateParam = searchParams.get('endDate') || searchParams.get('date');

    if (!startDateParam || !endDateParam) {
      return NextResponse.json({ error: 'startDate and endDate are required' }, { status: 400 });
    }

    const startDate = new Date(startDateParam);
    const endDate = new Date(endDateParam);
    
    const sy = startDate.getFullYear();
    const sm = String(startDate.getMonth() + 1).padStart(2, '0');
    const sd = String(startDate.getDate()).padStart(2, '0');
    const startDateStr = `${sy}-${sm}-${sd}`;

    const ey = endDate.getFullYear();
    const em = String(endDate.getMonth() + 1).padStart(2, '0');
    const ed = String(endDate.getDate()).padStart(2, '0');
    const endDateStr = `${ey}-${em}-${ed}`;

    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);
    const ty = todayDate.getFullYear();
    const tm = String(todayDate.getMonth() + 1).padStart(2, '0');
    const td = String(todayDate.getDate()).padStart(2, '0');
    const todayDateStr = `${ty}-${tm}-${td}`;

    // Jika endDate adalah hari ini atau melampaui, cek apakah fingerprint hari ini sudah disinkronkan
    let todayNotSynced = false;
    if (endDateStr >= todayDateStr) {
      const syncCheck = await query<any>(`
        SELECT COUNT(*) as syncedCount
        FROM TR_ABSEN
        WHERE CONVERT(date, DATE_TRANS) = '${todayDateStr}'
          AND (WORK_IN IS NOT NULL OR WORK_OUT IS NOT NULL)
      `);
      if ((syncCheck[0]?.syncedCount || 0) === 0) {
        todayNotSynced = true;
      }
    }

    // Strategi Jam Kosong Murni: Karyawan aktif yang MEMILIKI salah satu rekaman finger (In ada tapi Out kosong, ATAU Out ada tapi In kosong)
    const rawAbsenResult = await query<any>(`
      SELECT 
        RTRIM(e.EMP_CD) as EMP_CD, 
        RTRIM(e.EMP_NM) as EMP_NM,
        RTRIM(e.SX) as SEX,
        RTRIM(ISNULL(j.JOB_DESC, '')) as JOB_DESC,
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
        CONVERT(varchar(10), a.DATE_TRANS, 120) as DATE_TRANS,
        a.WORK_IN,
        a.WORK_IN1,
        a.WORK_OUT,
        a.WORK_OUT1,
        a.EMP_CD as TR_EMP_CD
      FROM EMP_TABLE e
      LEFT JOIN MS_SEC s ON RTRIM(e.SEC_CD) = RTRIM(s.SEC_CD)
      LEFT JOIN MS_DEP dp ON RTRIM(e.DEP_CD) = RTRIM(dp.DEP_CD)
      LEFT JOIN MS_JOBS j ON RTRIM(e.JOB_CD) = RTRIM(j.JOB_CD)
      -- LEFT JOIN supaya karyawan yang TIDAK punya baris TR_ABSEN sama sekali
      -- (belum di-sync, atau memang tidak ada data) tetap muncul di daftar jam kosong.
      LEFT JOIN TR_ABSEN a ON RTRIM(e.EMP_CD) = RTRIM(a.EMP_CD) 
        AND CONVERT(date, a.DATE_TRANS) >= '${startDateStr}' AND CONVERT(date, a.DATE_TRANS) <= '${endDateStr}'
      WHERE (e.DT_ENTRY IS NULL OR CONVERT(varchar(10), e.DT_ENTRY, 120) <= '${endDateStr}')
        AND (e.DT_RSG IS NULL OR CONVERT(varchar(10), e.DT_RSG, 120) >= '${startDateStr}')
    `);

    const reasonResult = await query<any>(`SELECT RTRIM(REASON_CODE) as REASON_CODE, RTRIM(REASON_GROUP) as REASON_GROUP FROM Ms_Reason`);
    const reasonMap = new Map<string, string>();
    reasonResult.forEach((r: any) => {
      if (r.REASON_CODE) reasonMap.set(r.REASON_CODE, r.REASON_GROUP || '');
    });

    const jamKosongList = rawAbsenResult.filter((r: any) => {
      // Karyawan tanpa baris TR_ABSEN sama sekali (LEFT JOIN → DATE_TRANS null)
      // Untuk hari ini: ikuti logika waktu. Untuk tanggal lampau: selalu tampilkan.
      if (!r.DATE_TRANS) {
        if (startDateStr === todayDateStr && endDateStr === todayDateStr) {
          // Hari ini — hanya tampilkan kalau data belum sync sudah dihandle di atas
          return !todayNotSynced;
        }
        return true; // Tanggal lampau — selalu tampilkan
      }

      // Cek hari libur akhir pekan
      const rowDate = new Date(r.DATE_TRANS);
      const dayOfWeek = rowDate.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        return false;
      }

      const status = (r.STATUS_HARI || '').trim().toUpperCase();
      const reasonGroup = (reasonMap.get((r.REASON || '').trim()) || '').toUpperCase();

      // Libur nasional diabaikan
      if (status === 'L' || status === 'LIBUR') {
        return false;
      }

      // Jika ini record hari ini dan hari ini belum di-sync, skip
      if (todayNotSynced && r.DATE_TRANS === todayDateStr) {
        return false;
      }

      const hasIn = !(!r.WORK_IN || r.WORK_IN.toString().trim() === '' || r.WORK_IN.toString().includes('00:00:00')) ||
                    !(!r.WORK_IN1 || r.WORK_IN1.toString().trim() === '' || r.WORK_IN1.toString().includes('00:00:00'));

      const hasOut = !(!r.WORK_OUT || r.WORK_OUT.toString().trim() === '' || r.WORK_OUT.toString().includes('00:00:00')) ||
                     !(!r.WORK_OUT1 || r.WORK_OUT1.toString().trim() === '' || r.WORK_OUT1.toString().includes('00:00:00'));

      // Jika kedua jam sudah lengkap → bukan jam kosong
      if (hasIn && hasOut) return false;

      // ── TANGGAL LAMPAU (bukan hari ini) ──
      // Tampilkan SEMUA yang WORK_IN atau WORK_OUT kosong,
      // entah alasannya alpha, cuti, izin, sakit, atau apa pun.
      if (r.DATE_TRANS !== todayDateStr) {
        return true;
      }

      // ── HARI INI ── logika waktu
      const currentHour = new Date().getHours();
      if (hasIn && !hasOut) {
        return currentHour >= 16; // Lupa tap pulang: tampilkan setelah jam 16
      }
      if (!hasIn && !hasOut) {
        return currentHour >= 10; // Belum ada data: tampilkan setelah jam 10
      }
      // !hasIn && hasOut (Lupa tap masuk): selalu tampilkan
      return true;
    }).map((r: any) => {
      const hasIn = !(!r.WORK_IN || r.WORK_IN.toString().trim() === '' || r.WORK_IN.toString().includes('00:00:00')) ||
                    !(!r.WORK_IN1 || r.WORK_IN1.toString().trim() === '' || r.WORK_IN1.toString().includes('00:00:00'));
      const hasOut = !(!r.WORK_OUT || r.WORK_OUT.toString().trim() === '' || r.WORK_OUT.toString().includes('00:00:00')) ||
                     !(!r.WORK_OUT1 || r.WORK_OUT1.toString().trim() === '' || r.WORK_OUT1.toString().includes('00:00:00'));

      let keterangan_kosong = 'Mangkir / Tidak Absen';
      if (r.REASON) {
        const reasonDesc = (r.REASON || '').trim();
        keterangan_kosong = reasonMap.get(reasonDesc) ? `${reasonMap.get(reasonDesc)} (${reasonDesc})` : `Alasan: ${reasonDesc}`;
      } else if (hasOut && !hasIn) {
        keterangan_kosong = 'Lupa Tap Masuk';
      } else if (hasIn && !hasOut) {
        keterangan_kosong = 'Lupa Tap Pulang';
      }
      
      return {
        EMP_CD: r.EMP_CD,
        EMP_NM: r.EMP_NM,
        SEX: r.SEX || '',
        JOB_DESC: r.JOB_DESC || '',
        SEC_DESC: r.SEC_DESC,
        SEC_CD: r.SEC_CD,
        BAGIAN: r.BAGIAN,
        TEAM: r.TEAM,
        STATUS_HARI: r.STATUS_HARI,
        REASON: r.REASON,
        DATE_TRANS: r.DATE_TRANS,
        WORK_IN: r.WORK_IN ? String(r.WORK_IN).substring(0, 8) : (r.WORK_IN1 ? String(r.WORK_IN1).substring(0, 8) : null),
        WORK_OUT: r.WORK_OUT ? String(r.WORK_OUT).substring(0, 8) : (r.WORK_OUT1 ? String(r.WORK_OUT1).substring(0, 8) : null),
        keterangan_kosong
      };
    });

    return NextResponse.json({ data: jamKosongList, notSynced: todayNotSynced && startDateStr === endDateStr && endDateStr === todayDateStr });
  } catch (err: any) {
    console.error('API Error:', err);
    return NextResponse.json({ error: 'Failed to fetch jam kosong data' }, { status: 500 });
  }
}
