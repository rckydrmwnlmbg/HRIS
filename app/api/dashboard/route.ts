import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCache, setCache } from '@/lib/cache';

// GET /api/dashboard — Fetch dashboard statistics
export async function GET() {
  try {
    const cachedData = getCache('dashboard_stats');
    if (cachedData) {
      return NextResponse.json(cachedData);
    }

    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    const todayStr = `${y}-${m}-${d}`;

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const ty = tomorrow.getFullYear();
    const tm = String(tomorrow.getMonth() + 1).padStart(2, '0');
    const td = String(tomorrow.getDate()).padStart(2, '0');
    const tomorrowStr = `${ty}-${tm}-${td}`;

    const firstDayOfMonthStr = `${y}-${m}-01`;
    let nextM = today.getMonth() + 2;
    let nextY = y;
    if (nextM > 12) { nextM = 1; nextY++; }
    const firstDayOfNextMonthStr = `${nextY}-${String(nextM).padStart(2, '0')}-01`;

    const past6Months = new Date(today);
    past6Months.setMonth(past6Months.getMonth() - 5);
    const p6y = past6Months.getFullYear();
    const p6m = String(past6Months.getMonth() + 1).padStart(2, '0');
    const past6MonthsStr = `${p6y}-${p6m}-01`;

    const totalResult = await query<any>(`SELECT COUNT(*) as total FROM EMP_TABLE`);
    const aktifResult = await query<any>(`
      SELECT COUNT(*) as total 
      FROM EMP_TABLE e 
      WHERE (CONVERT(varchar(10), e.DT_ENTRY, 120) <= '${todayStr}')
        AND (e.DT_RSG IS NULL OR CONVERT(varchar(10), e.DT_RSG, 120) >= '${todayStr}')
    `);
    const absensiHariIni = await query<any>(`
      SELECT 
        RTRIM(a.STATUS_HARI) AS STATUS_HARI,
        RTRIM(a.REASON) AS REASON,
        a.WORK_IN,
        a.WORK_IN1
      FROM TR_ABSEN a
      JOIN EMP_TABLE e ON RTRIM(a.EMP_CD) = RTRIM(e.EMP_CD)
      WHERE a.DATE_TRANS >= '${todayStr}' AND a.DATE_TRANS < '${tomorrowStr}'
        AND (CONVERT(varchar(10), e.DT_ENTRY, 120) <= '${todayStr}')
        AND (e.DT_RSG IS NULL OR CONVERT(varchar(10), e.DT_RSG, 120) >= '${todayStr}')
    `);
    const jamKosongListResult = await query<any>(`
      SELECT RTRIM(e.EMP_CD) as EMP_CD, RTRIM(e.EMP_NM) as EMP_NM, RTRIM(s.SEC_DESC) as SEC_DESC, RTRIM(e.SEC_CD) as SEC_CD, 
             RTRIM(a.STATUS_HARI) as STATUS_HARI, RTRIM(a.REASON) as REASON, a.WORK_IN, a.WORK_IN1, a.WORK_OUT, a.WORK_OUT1,
             a.EMP_CD as TR_EMP_CD,
             RTRIM(s.SEC_DESC) as BAGIAN, CASE WHEN UPPER(RTRIM(s.SEC_DESC)) LIKE '%LINE%' THEN 'SEWING' ELSE RTRIM(d.DEP_DESC) END AS TEAM
      FROM EMP_TABLE e
      LEFT JOIN TR_ABSEN a ON RTRIM(e.EMP_CD) = RTRIM(a.EMP_CD) AND a.DATE_TRANS >= '${todayStr}' AND a.DATE_TRANS < '${tomorrowStr}'
      LEFT JOIN MS_SEC s ON RTRIM(e.SEC_CD) = RTRIM(s.SEC_CD)
      LEFT JOIN MS_DEP d ON RTRIM(e.DEP_CD) = RTRIM(d.DEP_CD)
      LEFT JOIN MS_JOBS j ON RTRIM(e.JOB_CD) = RTRIM(j.JOB_CD)
      WHERE (CONVERT(varchar(10), e.DT_ENTRY, 120) <= '${todayStr}')
        AND (e.DT_RSG IS NULL OR CONVERT(varchar(10), e.DT_RSG, 120) >= '${todayStr}')
        AND (
          a.EMP_CD IS NULL 
          OR (
            (a.WORK_IN IS NULL OR LTRIM(RTRIM(CAST(a.WORK_IN AS varchar(50)))) = '' OR CONVERT(varchar(8), a.WORK_IN, 108) = '00:00:00')
            AND
            (a.WORK_IN1 IS NULL OR LTRIM(RTRIM(CAST(a.WORK_IN1 AS varchar(50)))) = '' OR CONVERT(varchar(8), a.WORK_IN1, 108) = '00:00:00')
          )
        )
    `);
    const fingerprintSyncResult = await query<any>(`
      SELECT COUNT(*) as syncedCount
      FROM TR_ABSEN
      WHERE DATE_TRANS >= '${todayStr}' AND DATE_TRANS < '${tomorrowStr}'
        AND (WORK_IN IS NOT NULL OR WORK_OUT IS NOT NULL)
    `);
    const isFingerprintIntegrated = (fingerprintSyncResult[0]?.syncedCount || 0) > 0;

    const lemburResult = await query<any>(`
      SELECT COUNT(*) as total
      FROM TR_ABSEN
      WHERE DATE_TRANS >= '${firstDayOfMonthStr}' AND DATE_TRANS < '${firstDayOfNextMonthStr}'
        AND (OT_1 > 0 OR OT_2 > 0 OR OT_3 > 0 OR OT_4 > 0)
    `);

    const demografiResult = await query<any>(`
      SELECT 
        SUM(CASE WHEN RTRIM(ALL_IN) IN ('1','Y','TRUE') THEN 1 ELSE 0 END) as totalAllIn,
        SUM(CASE WHEN RTRIM(ALL_IN) NOT IN ('1','Y','TRUE') THEN 1 ELSE 0 END) as totalHarian,
        SUM(CASE WHEN RTRIM(SX) = 'L' THEN 1 ELSE 0 END) as totalPria,
        SUM(CASE WHEN RTRIM(SX) = 'P' THEN 1 ELSE 0 END) as totalWanita
      FROM EMP_TABLE e
      WHERE (CONVERT(varchar(10), e.DT_ENTRY, 120) <= '${todayStr}')
        AND (e.DT_RSG IS NULL OR CONVERT(varchar(10), e.DT_RSG, 120) >= '${todayStr}')
    `);

    const topLemburResult = await query<any>(`
      SELECT TOP 5
        RTRIM(s.SEC_DESC) AS BAGIAN,
        COUNT(*) as totalOT
      FROM TR_ABSEN a
      JOIN MS_SEC s ON RTRIM(a.SEC_CD) = RTRIM(s.SEC_CD)
      WHERE a.DATE_TRANS >= '${firstDayOfMonthStr}' AND a.DATE_TRANS < '${firstDayOfNextMonthStr}'
        AND (a.OT_1 > 0 OR a.OT_2 > 0 OR a.OT_3 > 0 OR a.OT_4 > 0)
      GROUP BY RTRIM(s.SEC_DESC)
      ORDER BY totalOT DESC
    `);
    const reasonResult = await query<any>(`SELECT RTRIM(REASON_CODE) as REASON_CODE, RTRIM(REASON_GROUP) as REASON_GROUP FROM Ms_Reason`);

    const reasonMap = new Map<string, string>();
    reasonResult.forEach((r: any) => {
      if (r.REASON_CODE) reasonMap.set(r.REASON_CODE, r.REASON_GROUP || '');
    });

    const getStatus = (statusHari: string, reasonCode: string) => {
      const mapped = reasonMap.get(reasonCode);
      return (mapped || statusHari || '').trim().toUpperCase();
    };

    let hadirHariIni = 0, alphaHariIni = 0, izinHariIni = 0, cutiHariIni = 0, sakitHariIni = 0;

    absensiHariIni.forEach((row: any) => {
      const s = getStatus(row.STATUS_HARI, row.REASON);
      
      const missingIn = !row.WORK_IN || row.WORK_IN.toString().trim() === '' || row.WORK_IN.toString().includes('00:00:00');
      const missingIn1 = !row.WORK_IN1 || row.WORK_IN1.toString().trim() === '' || row.WORK_IN1.toString().includes('00:00:00');
      const isJamKosong = missingIn && missingIn1;

      // Jika dia Jam Kosong, dan status akhirnya (s) adalah Alpha/Kerja/Kosong,
      // JANGAN hitung dia sebagai Alpha/Hadir karena untuk HARI INI dia masih butuh verifikasi (Jam Kosong).
      const isUnverifiedAlpha = isJamKosong && (s === 'A' || s === 'ALPHA' || s === '' || s === 'KERJA' || s === 'O');

      if (isUnverifiedAlpha) {
        return; 
      }

      if (s === 'KERJA' || s === 'O') hadirHariIni++;
      else if (s === 'ALPHA' || s === 'A') alphaHariIni++;
      else if (s === 'IJIN' || s === 'I') izinHariIni++;
      else if (s === 'CUTI' || s === 'C' || s === 'H') cutiHariIni++;
      else if (s === 'SAKIT' || s === 'S') sakitHariIni++;
    });

    const jamKosongList = !isFingerprintIntegrated ? [] : jamKosongListResult.filter((r: any) => {
      // Jika belum ada record absen hari ini
      if (!r.STATUS_HARI && !r.REASON && !r.TR_EMP_CD) return true;

      const s = getStatus(r.STATUS_HARI, r.REASON);
      const reasonLower = (r.REASON || '').trim().toLowerCase();
      const statusLower = (r.STATUS_HARI || '').trim().toLowerCase();
      
      // Yang dikecualikan dari jam kosong: Cuti, Sakit, Izin, Dinas Luar, Libur, Haid
      const hasVerifiedReason = !!r.REASON && r.REASON.trim() !== '' && 
                                reasonLower !== 'a' && reasonLower !== 'alpha';

      const isExcluded = ['dl', 'dinas', 'luar', 'cuti', 'ijin', 'izin', 'sakit', 'libur', 'haid'].some(w => reasonLower.includes(w) || statusLower.includes(w)) || 
                         reasonLower === 'c' || reasonLower === 'i' || reasonLower === 's' || reasonLower === 'l' || reasonLower === 'h' ||
                         s === 'CUTI' || s === 'SAKIT' || s === 'IJIN' || s === 'LIBUR' || hasVerifiedReason;
      
      return !isExcluded;
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
        WORK_IN: r.WORK_IN || r.WORK_IN1 || null,
        WORK_OUT: r.WORK_OUT || null,
        keterangan_kosong
      };
    });

    const responseData = {
      totalKaryawan: totalResult[0]?.total || 0,
      karyawanAktif: aktifResult[0]?.total || 0,
      hadirHariIni,
      alphaHariIni,
      izinHariIni: izinHariIni + cutiHariIni + sakitHariIni,
      cutiHariIni,
      sakitHariIni,
      jamKosongHariIni: jamKosongList.length,
      jamKosongList,
      lemburBulanIni: lemburResult[0]?.total || 0,
      isFingerprintIntegrated: (fingerprintSyncResult[0]?.syncedCount || 0) > 0,
      demografi: {
        allIn: demografiResult[0]?.totalAllIn || 0,
        harian: demografiResult[0]?.totalHarian || 0,
        pria: demografiResult[0]?.totalPria || 0,
        wanita: demografiResult[0]?.totalWanita || 0,
      },
      topLembur: topLemburResult.map((r: any) => ({
        bagian: r.BAGIAN || 'Unknown',
        total: r.totalOT || 0,
      })),
    };

    setCache('dashboard_stats', responseData, 300); // 5 minutes cache to improve load speed

    return NextResponse.json(responseData);
  } catch (error: any) {
    console.error('API /dashboard error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
