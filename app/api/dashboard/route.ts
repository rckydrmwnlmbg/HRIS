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
    const fingerprintSyncResult = await query<any>(`
      SELECT COUNT(*) as syncedCount
      FROM TR_ABSEN
      WHERE DATE_TRANS >= '${todayStr}' AND DATE_TRANS < '${tomorrowStr}'
        AND (WORK_IN IS NOT NULL OR WORK_OUT IS NOT NULL)
    `);
    const isFingerprintIntegrated = (fingerprintSyncResult[0]?.syncedCount || 0) > 0;

    // Ambil data absensi seluruh karyawan aktif hari ini
    const rawAbsenHariIni = await query<any>(`
      SELECT 
        RTRIM(e.EMP_CD) as EMP_CD, 
        RTRIM(e.EMP_NM) as EMP_NM, 
        RTRIM(s.SEC_DESC) as SEC_DESC, 
        RTRIM(e.SEC_CD) as SEC_CD,
        RTRIM(s.SEC_DESC) as BAGIAN,
        CASE WHEN UPPER(RTRIM(s.SEC_DESC)) LIKE '%LINE%' THEN 'SEWING' ELSE RTRIM(d.DEP_DESC) END AS TEAM,
        RTRIM(a.STATUS_HARI) as STATUS_HARI, 
        RTRIM(a.REASON) as REASON, 
        a.WORK_IN, a.WORK_IN1, a.WORK_OUT, a.WORK_OUT1,
        a.JAM_KERJA,
        a.EMP_CD as TR_EMP_CD
      FROM EMP_TABLE e
      LEFT JOIN TR_ABSEN a ON RTRIM(e.EMP_CD) = RTRIM(a.EMP_CD) AND a.DATE_TRANS >= '${todayStr}' AND a.DATE_TRANS < '${tomorrowStr}'
      LEFT JOIN MS_SEC s ON RTRIM(e.SEC_CD) = RTRIM(s.SEC_CD)
      LEFT JOIN MS_DEP d ON RTRIM(e.DEP_CD) = RTRIM(d.DEP_CD)
      WHERE (CONVERT(varchar(10), e.DT_ENTRY, 120) <= '${todayStr}')
        AND (e.DT_RSG IS NULL OR CONVERT(varchar(10), e.DT_RSG, 120) >= '${todayStr}')
    `);

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
    const jamKosongList: any[] = [];
    const perluPerhatianList: any[] = [];

    const currentHour = new Date().getHours();

    rawAbsenHariIni.forEach((row: any) => {
      const s = getStatus(row.STATUS_HARI, row.REASON);
      const reasonGroup = (reasonMap.get((row.REASON || '').trim()) || '').toUpperCase();

      const isCuti = s === 'CUTI' || s === 'C' || s === 'H' || reasonGroup === 'C' || reasonGroup === 'H';
      const isSakit = s === 'SAKIT' || s === 'S' || reasonGroup === 'S';
      const isIzin = s === 'IJIN' || s === 'I' || reasonGroup === 'I';
      const isLibur = s === 'LIBUR' || s === 'L';

      if (isCuti) { cutiHariIni++; return; }
      if (isSakit) { sakitHariIni++; return; }
      if (isIzin) { izinHariIni++; return; }
      if (isLibur) { return; }

      const inRaw = row.WORK_IN || row.WORK_IN1;
      const outRaw = row.WORK_OUT || row.WORK_OUT1;

      const hasIn = !(!inRaw || inRaw.toString().trim() === '' || inRaw.toString().includes('00:00:00'));
      const hasOut = !(!outRaw || outRaw.toString().trim() === '' || outRaw.toString().includes('00:00:00'));

      const inStr = inRaw instanceof Date ? inRaw.toTimeString().substring(0, 8) : (inRaw ? String(inRaw).substring(0, 8) : null);
      const outStr = outRaw instanceof Date ? outRaw.toTimeString().substring(0, 8) : (outRaw ? String(outRaw).substring(0, 8) : null);

      // KASUS 1: Tidak ada In dan Tidak ada Out -> ALPHA (Tidak Masuk Kerja)
      if (!hasIn && !hasOut) {
        if (isFingerprintIntegrated) {
          alphaHariIni++;
        }
        return;
      }

      // KASUS 2: JAM KOSONG MURNI (Salah satu ada, salah satu kosong)
      if (hasOut && !hasIn) {
        hadirHariIni++;
        jamKosongList.push({
          EMP_CD: row.EMP_CD,
          EMP_NM: row.EMP_NM,
          SEC_DESC: row.SEC_DESC,
          SEC_CD: row.SEC_CD,
          BAGIAN: row.BAGIAN,
          TEAM: row.TEAM,
          WORK_IN: null,
          WORK_OUT: outStr,
          keterangan_kosong: 'Lupa Tap Masuk'
        });
        return;
      }

      if (hasIn && !hasOut) {
        hadirHariIni++;
        // Hanya masukkan ke Jam Kosong jika sudah sore (>= 16:00)
        if (currentHour >= 16) {
          jamKosongList.push({
            EMP_CD: row.EMP_CD,
            EMP_NM: row.EMP_NM,
            SEC_DESC: row.SEC_DESC,
            SEC_CD: row.SEC_CD,
            BAGIAN: row.BAGIAN,
            TEAM: row.TEAM,
            WORK_IN: inStr,
            WORK_OUT: null,
            keterangan_kosong: 'Lupa Tap Pulang'
          });
        }
        return;
      }

      // KASUS 3: HADIR LENGKAP (hasIn && hasOut) -> Evaluasi Perlu Perhatian (Exceptions)
      hadirHariIni++;

      if (inStr && outStr) {
        const inParts = inStr.split(':').map(Number);
        const outParts = outStr.split(':').map(Number);
        if (inParts.length >= 2 && outParts.length >= 2) {
          const inDec = inParts[0] + inParts[1] / 60 + (inParts[2] || 0) / 3600;
          const outDec = outParts[0] + outParts[1] / 60 + (outParts[2] || 0) / 3600;

          let durationHours = outDec - inDec;
          if (durationHours < 0) durationHours += 24;

          let netWorkHours = durationHours;
          if (inDec < 12.0 && outDec > 13.0) {
            netWorkHours = Math.max(0, durationHours - 1.0);
          }
          const jk = Number(row.JAM_KERJA) > 0 ? Number(row.JAM_KERJA) : Math.round(netWorkHours * 10) / 10;

          if (durationHours <= 0.5) {
            const diffMinutes = Math.round(durationHours * 60);
            perluPerhatianList.push({
              EMP_CD: row.EMP_CD,
              EMP_NM: row.EMP_NM,
              SEC_DESC: row.SEC_DESC,
              SEC_CD: row.SEC_CD,
              BAGIAN: row.BAGIAN,
              TEAM: row.TEAM,
              WORK_IN: inStr,
              WORK_OUT: outStr,
              jam_kerja: jk,
              jenis_anomali: 'DURASI_SINGKAT',
              keterangan: `Durasi Sangat Singkat (${diffMinutes} menit)`
            });
          } else if (outDec < 16.0 && jk < 7.0) {
            const kurangJam = (7.0 - jk).toFixed(1);
            perluPerhatianList.push({
              EMP_CD: row.EMP_CD,
              EMP_NM: row.EMP_NM,
              SEC_DESC: row.SEC_DESC,
              SEC_CD: row.SEC_CD,
              BAGIAN: row.BAGIAN,
              TEAM: row.TEAM,
              WORK_IN: inStr,
              WORK_OUT: outStr,
              jam_kerja: jk,
              jenis_anomali: 'PULANG_CEPAT',
              keterangan: `Pulang Lebih Awal (${outStr.substring(0, 5)} / Kurang ${kurangJam} Jam)`
            });
          } else if (inDec > 7.25) {
            const telatMenit = Math.round((inDec - 7.0) * 60);
            perluPerhatianList.push({
              EMP_CD: row.EMP_CD,
              EMP_NM: row.EMP_NM,
              SEC_DESC: row.SEC_DESC,
              SEC_CD: row.SEC_CD,
              BAGIAN: row.BAGIAN,
              TEAM: row.TEAM,
              WORK_IN: inStr,
              WORK_OUT: outStr,
              jam_kerja: jk,
              jenis_anomali: 'TERLAMBAT',
              keterangan: `Terlambat Masuk (${inStr.substring(0, 5)} / Telat ${telatMenit} Menit)`
            });
          }
        }
      }
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
      perluPerhatianHariIni: perluPerhatianList.length,
      perluPerhatianList,
      lemburBulanIni: lemburResult[0]?.total || 0,
      isFingerprintIntegrated,
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
