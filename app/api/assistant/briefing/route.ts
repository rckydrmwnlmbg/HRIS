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
      WHERE e.Act_NonAct = 1 
      AND (e.DT_RSG IS NULL OR YEAR(e.DT_RSG) <= 1900 OR e.DT_RSG >= GETDATE())
      AND CAST(a.DATE_TRANS AS DATE) >= CAST(DATEADD(day, -3, GETDATE()) AS DATE)
      AND RTRIM(a.REASON) IN ('18', '05') -- Kode Cuti
      AND a.WORK_IN IS NOT NULL; -- Tapi masuk (ada tap mesin)
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

    // 2. Cek Jam Kosong (Kemarin/Sebelumnya)
    const queryJamKosong = `
      SELECT RTRIM(e.EMP_NM) as Nama, FORMAT(a.DATE_TRANS, 'dd MMM') as Tgl
      FROM TR_ABSEN a
      JOIN EMP_TABLE e ON a.EMP_CD = e.EMP_CD
      WHERE e.Act_NonAct = 1 
      AND (e.DT_RSG IS NULL OR YEAR(e.DT_RSG) <= 1900 OR e.DT_RSG >= GETDATE())
      AND CAST(a.DATE_TRANS AS DATE) < CAST(GETDATE() AS DATE)
      AND CAST(a.DATE_TRANS AS DATE) >= CAST(DATEADD(day, -3, GETDATE()) AS DATE)
      AND a.WORK_IN IS NOT NULL 
      AND a.WORK_OUT IS NULL;
    `;
    const resJamKosong = await query<any>(queryJamKosong);
    const totalJamKosong = resJamKosong.length;
    
    if (totalJamKosong > 0) {
      insights.push({
        id: 'jam-kosong',
        type: 'warning',
        text: `Kemarin ada **${totalJamKosong} karyawan** yang absen masuk tapi lupa tap pulang (Jam Kosong). Yuk koreksi manual sekarang supaya perhitungan jam kerjanya tidak bermasalah saat tutup buku.`,
        priority: 'high',
        details: resJamKosong.map(r => `${r.Nama} (${r.Tgl})`)
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
      AND RTRIM(a.STATUS_HARI) = 'ALPHA'
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

    // 4. Terlambat Parah Hari Ini (jika data absen hari ini sudah ditarik sebagian)
    const queryTerlambat = `
      SELECT COUNT(*) as TotalTerlambat
      FROM TR_ABSEN a
      JOIN EMP_TABLE e ON a.EMP_CD = e.EMP_CD
      WHERE e.Act_NonAct = 1 
      AND (e.DT_RSG IS NULL OR YEAR(e.DT_RSG) <= 1900 OR e.DT_RSG >= GETDATE())
      AND CAST(a.DATE_TRANS AS DATE) = CAST(GETDATE() AS DATE)
      AND a.Time_Late > 30;
    `;
    const resTerlambat = await query<any>(queryTerlambat);
    const totalTerlambat = resTerlambat[0]?.TotalTerlambat || 0;
    
    if (totalTerlambat > 0) {
      insights.push({
        id: 'terlambat-parah',
        type: 'warning',
        text: `${totalTerlambat} karyawan tercatat terlambat lebih dari 30 menit hari ini.`,
        priority: 'low'
      });
    }

    return NextResponse.json({ insights });
  } catch (error: any) {
    console.error('API Briefing Error:', error);
    // Return empty insights on error to avoid breaking dashboard
    return NextResponse.json({ insights: [] });
  }
}
