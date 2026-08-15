import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(req: NextRequest) {
  // Allow bypassing if DB is not available in non-live mode, but here we assume it is
  if (process.env.DATA_MODE !== 'live') {
    return NextResponse.json({ insights: [] });
  }

  const insights: any[] = [];
  
  try {
    // 1. Cek Anomali Cuti vs Presensi Fisik (Tercatat Cuti TAPI Masuk Kerja)
    const queryAnomaliCuti = `
      SELECT DISTINCT RTRIM(e.EMP_NM) as Nama
      FROM TR_ABSEN a
      JOIN EMP_TABLE e ON a.EMP_CD = e.EMP_CD
      LEFT JOIN Ms_Reason mr ON RTRIM(a.REASON) = RTRIM(mr.REASON_CODE)
      WHERE e.Act_NonAct = 1 
      AND (e.DT_RSG IS NULL OR YEAR(e.DT_RSG) <= 1900 OR e.DT_RSG >= GETDATE())
      AND CAST(a.DATE_TRANS AS DATE) >= CAST(DATEADD(day, -3, GETDATE()) AS DATE)
      AND (RTRIM(mr.REASON_GROUP) IN ('C', 'H') OR RTRIM(a.REASON) IN ('18', '05', '13', '17'))
      AND (a.WORK_IN IS NOT NULL OR a.WORK_OUT IS NOT NULL);
    `;
    const resAnomaliCuti = await query<any>(queryAnomaliCuti);
    const totalAnomaliCuti = resAnomaliCuti.length;
    
    if (totalAnomaliCuti > 0) {
      insights.push({
        id: 'anomali-cuti',
        type: 'danger',
        text: `Terdapat **${totalAnomaliCuti} karyawan** yang di sistem statusnya sedang Cuti, tapi anehnya mesin mendeteksi absen masuk mereka. Coba cek lagi ya, barangkali mereka batal cuti agar saldonya tidak terpotong.`,
        priority: 'high',
        details: resAnomaliCuti.map(r => r.Nama)
      });
    }

    // 2. Cek Jam Kosong (Kemarin/Sebelumnya - Lupa Tap Masuk atau Lupa Tap Pulang)
    const queryJamKosong = `
      SELECT RTRIM(e.EMP_NM) as Nama, FORMAT(a.DATE_TRANS, 'dd MMM') as Tgl,
             CASE WHEN a.WORK_IN IS NOT NULL AND a.WORK_OUT IS NULL THEN 'Lupa Tap Pulang'
                  WHEN a.WORK_IN IS NULL AND a.WORK_OUT IS NOT NULL THEN 'Lupa Tap Masuk'
                  ELSE 'Tap Tidak Lengkap' END as Keterangan
      FROM TR_ABSEN a
      JOIN EMP_TABLE e ON a.EMP_CD = e.EMP_CD
      WHERE e.Act_NonAct = 1 
      AND (e.DT_RSG IS NULL OR YEAR(e.DT_RSG) <= 1900 OR e.DT_RSG >= GETDATE())
      AND CAST(a.DATE_TRANS AS DATE) < CAST(GETDATE() AS DATE)
      AND CAST(a.DATE_TRANS AS DATE) >= CAST(DATEADD(day, -3, GETDATE()) AS DATE)
      AND (
        (a.WORK_IN IS NOT NULL AND a.WORK_OUT IS NULL)
        OR (a.WORK_IN IS NULL AND a.WORK_OUT IS NOT NULL)
      );
    `;
    const resJamKosong = await query<any>(queryJamKosong);
    const totalJamKosong = resJamKosong.length;
    
    if (totalJamKosong > 0) {
      insights.push({
        id: 'jam-kosong',
        type: 'warning',
        text: `Ada **${totalJamKosong} catatan jam kosong** (lupa tap masuk/pulang) dari hari kerja sebelumnya yang perlu dikoreksi.`,
        priority: 'high',
        details: resJamKosong.map(r => `${r.Nama} (${r.Tgl} - ${r.Keterangan})`)
      });
    }

    // 3. Cek Alpha Beruntun (Mangkir)
    const queryAlpha = `
      SELECT RTRIM(MAX(e.EMP_NM)) as Nama
      FROM TR_ABSEN a
      JOIN EMP_TABLE e ON a.EMP_CD = e.EMP_CD
      WHERE e.Act_NonAct = 1 
      AND (e.DT_RSG IS NULL OR YEAR(e.DT_RSG) <= 1900 OR e.DT_RSG >= GETDATE())
      AND CAST(a.DATE_TRANS AS DATE) >= CAST(DATEADD(day, -7, GETDATE()) AS DATE)
      AND RTRIM(a.STATUS_HARI) = 'KERJA'
      AND a.WORK_IN IS NULL 
      AND a.WORK_OUT IS NULL 
      AND (a.REASON IS NULL OR RTRIM(a.REASON) = '')
      GROUP BY a.EMP_CD
      HAVING COUNT(*) >= 3;
    `;
    const resAlpha = await query<any>(queryAlpha);
    if (resAlpha.length > 0) {
      insights.push({
        id: 'alpha-beruntun',
        type: 'danger',
        text: `Gawat, ada **${resAlpha.length} karyawan** yang terdeteksi mangkir (Alpha murni) selama 3 hari berturut-turut. Ini waktunya kamu buat ngecek ke SPV mereka atau memproses SP.`,
        priority: 'high',
        details: resAlpha.map(r => r.Nama)
      });
    }

    // 4. Terlambat Hari Ini (sinkron dengan kriteria Box Perlu Perhatian: lewat 07:15 / telat > 15 menit)
    const queryTerlambat = `
      SELECT RTRIM(e.EMP_NM) as Nama,
             CONVERT(varchar(8), a.WORK_IN, 108) as JamMasuk
      FROM TR_ABSEN a
      JOIN EMP_TABLE e ON a.EMP_CD = e.EMP_CD
      WHERE e.Act_NonAct = 1 
      AND (e.DT_RSG IS NULL OR YEAR(e.DT_RSG) <= 1900 OR e.DT_RSG >= GETDATE())
      AND CAST(a.DATE_TRANS AS DATE) = CAST(GETDATE() AS DATE)
      AND (
        a.Time_Late > 15
        OR (
          a.WORK_IN IS NOT NULL 
          AND CONVERT(varchar(8), a.WORK_IN, 108) > '07:15:00'
          AND CONVERT(varchar(8), a.WORK_IN, 108) < '12:00:00'
        )
      );
    `;
    const resTerlambat = await query<any>(queryTerlambat);
    const totalTerlambat = resTerlambat.length;
    
    if (totalTerlambat > 0) {
      insights.push({
        id: 'terlambat-hari-ini',
        type: 'warning',
        text: `Terdapat **${totalTerlambat} karyawan** yang terlambat masuk kerja hari ini (masuk lewat pukul 07:15).`,
        priority: 'low',
        details: resTerlambat.map((r: any) => `${r.Nama} (${r.JamMasuk ? r.JamMasuk.substring(0, 5) : 'Telat'})`)
      });
    }

    // 5. Pulang Cepat / Pulang Lebih Awal Hari Ini (sinkron dengan Perlu Perhatian)
    const queryPulangCepat = `
      SELECT RTRIM(e.EMP_NM) as Nama,
             CONVERT(varchar(8), a.WORK_OUT, 108) as JamPulang
      FROM TR_ABSEN a
      JOIN EMP_TABLE e ON a.EMP_CD = e.EMP_CD
      WHERE e.Act_NonAct = 1 
      AND (e.DT_RSG IS NULL OR YEAR(e.DT_RSG) <= 1900 OR e.DT_RSG >= GETDATE())
      AND CAST(a.DATE_TRANS AS DATE) = CAST(GETDATE() AS DATE)
      AND a.WORK_OUT IS NOT NULL
      AND CONVERT(varchar(8), a.WORK_OUT, 108) < '16:00:00'
      AND (a.JAM_KERJA IS NOT NULL AND CAST(a.JAM_KERJA as float) < 7.0);
    `;
    const resPulangCepat = await query<any>(queryPulangCepat);
    if (resPulangCepat.length > 0) {
      insights.push({
        id: 'pulang-cepat-hari-ini',
        type: 'warning',
        text: `Terdapat **${resPulangCepat.length} karyawan** yang pulang lebih awal (sebelum jam 16:00) hari ini.`,
        priority: 'low',
        details: resPulangCepat.map((r: any) => `${r.Nama} (Pulang ${r.JamPulang ? r.JamPulang.substring(0, 5) : '-'})`)
      });
    }

    return NextResponse.json({ insights });
  } catch (error: any) {
    console.error('API Briefing Error:', error);
    // Return empty insights on error to avoid breaking dashboard
    return NextResponse.json({ insights: [] });
  }
}
