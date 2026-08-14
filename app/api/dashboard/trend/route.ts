import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCache, setCache } from '@/lib/cache';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const range = searchParams.get('range') || '6m'; // '30d' | '3m' | '6m'

    const cacheKey = `dashboard_trend_${range}`;
    const cachedData = getCache(cacheKey);
    if (cachedData) {
      return NextResponse.json(cachedData);
    }

    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    const todayStr = `${y}-${m}-${d}`;

    const reasonResult = await query<any>(`SELECT RTRIM(REASON_CODE) as REASON_CODE, RTRIM(REASON_GROUP) as REASON_GROUP FROM Ms_Reason`);
    const reasonMap = new Map<string, string>();
    reasonResult.forEach((r: any) => {
      if (r.REASON_CODE) reasonMap.set(r.REASON_CODE.toUpperCase().trim(), r.REASON_GROUP || '');
    });

    const getStatus = (statusHari: string, reasonCode: string) => {
      const mapped = reasonCode ? reasonMap.get(reasonCode.toUpperCase().trim()) : null;
      if (mapped) return mapped.toUpperCase().trim();
      return statusHari ? statusHari.toUpperCase().trim() : '';
    };

    if (range === '30d') {
      // 30 Hari Terakhir (Harian)
      const startDate = new Date(today);
      startDate.setDate(startDate.getDate() - 29);
      const sy = startDate.getFullYear();
      const sm = String(startDate.getMonth() + 1).padStart(2, '0');
      const sd = String(startDate.getDate()).padStart(2, '0');
      const startDateStr = `${sy}-${sm}-${sd}`;

      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const ty = tomorrow.getFullYear();
      const tm = String(tomorrow.getMonth() + 1).padStart(2, '0');
      const td = String(tomorrow.getDate()).padStart(2, '0');
      const tomorrowStr = `${ty}-${tm}-${td}`;

      const dailyResult = await query<any>(`
        SELECT 
          CONVERT(varchar(10), a.DATE_TRANS, 120) as tgl,
          RTRIM(a.STATUS_HARI) as STATUS_HARI,
          RTRIM(a.REASON) as REASON,
          COUNT(DISTINCT a.EMP_CD) as jumlah
        FROM TR_ABSEN a
        JOIN EMP_TABLE e ON a.EMP_CD = e.EMP_CD
        WHERE a.DATE_TRANS >= '${startDateStr}' AND a.DATE_TRANS < '${tomorrowStr}'
          AND e.Act_NonAct = 1 
          AND (e.DT_RSG IS NULL OR YEAR(e.DT_RSG) <= 1900 OR e.DT_RSG >= GETDATE())
        GROUP BY CONVERT(varchar(10), a.DATE_TRANS, 120), RTRIM(a.STATUS_HARI), RTRIM(a.REASON)
      `);

      const dailyMap = new Map<string, any>();
      for (let i = 29; i >= 0; i--) {
        const curr = new Date(today);
        curr.setDate(today.getDate() - i);
        const cy = curr.getFullYear();
        const cm = String(curr.getMonth() + 1).padStart(2, '0');
        const cd = String(curr.getDate()).padStart(2, '0');
        const key = `${cy}-${cm}-${cd}`;
        dailyMap.set(key, {
          name: `${cd}/${cm}`,
          date: key,
          hadir: 0,
          alpha: 0,
          izin: 0,
          cuti: 0,
          sakit: 0
        });
      }

      dailyResult.forEach((row: any) => {
        const key = row.tgl;
        if (dailyMap.has(key)) {
          const item = dailyMap.get(key);
          const s = getStatus(row.STATUS_HARI, row.REASON);
          if (s === 'KERJA' || s === 'O') item.hadir += row.jumlah;
          else if (s === 'MANGKIR' || s === 'A' || s === 'ALPHA') item.alpha += row.jumlah;
          else if (s === 'IZIN' || s === 'I') item.izin += row.jumlah;
          else if (s === 'CUTI' || s === 'C' || s === 'H') item.cuti += row.jumlah;
          else if (s === 'SAKIT' || s === 'S') item.sakit += row.jumlah;
        }
      });

      const trend = Array.from(dailyMap.values());
      setCache(cacheKey, trend, 600); // 10 menit
      return NextResponse.json(trend);
    }

    // Bulanan (3m atau 6m)
    const monthCount = range === '3m' ? 3 : 6;
    let nextM = today.getMonth() + 2;
    let nextY = y;
    if (nextM > 12) { nextM = 1; nextY++; }
    const firstDayOfNextMonthStr = `${nextY}-${String(nextM).padStart(2, '0')}-01`;

    const pastMonths = new Date(today);
    pastMonths.setDate(1);
    pastMonths.setMonth(pastMonths.getMonth() - (monthCount - 1));
    const pmy = pastMonths.getFullYear();
    const pmm = String(pastMonths.getMonth() + 1).padStart(2, '0');
    const pastMonthsStr = `${pmy}-${pmm}-01`;

    const trendResult = await query<any>(`
      SELECT 
        MONTH(a.DATE_TRANS) as m, 
        YEAR(a.DATE_TRANS) as y,
        RTRIM(a.STATUS_HARI) as STATUS_HARI,
        RTRIM(a.REASON) as REASON,
        COUNT(DISTINCT a.EMP_CD) as jumlah
      FROM TR_ABSEN a
      JOIN EMP_TABLE e ON a.EMP_CD = e.EMP_CD
      WHERE a.DATE_TRANS >= '${pastMonthsStr}' AND a.DATE_TRANS < '${firstDayOfNextMonthStr}'
        AND e.Act_NonAct = 1 
        AND (e.DT_RSG IS NULL OR YEAR(e.DT_RSG) <= 1900 OR e.DT_RSG >= GETDATE())
      GROUP BY MONTH(a.DATE_TRANS), YEAR(a.DATE_TRANS), RTRIM(a.STATUS_HARI), RTRIM(a.REASON)
    `);

    const trendMap = new Map<string, any>();
    for (let i = monthCount - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(1);
      d.setMonth(today.getMonth() - i);
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yy = d.getFullYear();
      const monthName = d.toLocaleDateString('id-ID', { month: 'short' });
      trendMap.set(`${yy}-${mm}`, { name: `${monthName}`, hadir: 0, alpha: 0, izin: 0, cuti: 0, sakit: 0 });
    }

    trendResult.forEach((row: any) => {
      const mm = String(row.m).padStart(2, '0');
      const key = `${row.y}-${mm}`;
      if (trendMap.has(key)) {
        const item = trendMap.get(key);
        const s = getStatus(row.STATUS_HARI, row.REASON);
        if (s === 'KERJA' || s === 'O') item.hadir += row.jumlah;
        else if (s === 'MANGKIR' || s === 'A' || s === 'ALPHA') item.alpha += row.jumlah;
        else if (s === 'IZIN' || s === 'I') item.izin += row.jumlah;
        else if (s === 'CUTI' || s === 'C' || s === 'H') item.cuti += row.jumlah;
        else if (s === 'SAKIT' || s === 'S') item.sakit += row.jumlah;
      }
    });

    const trend = Array.from(trendMap.values());
    setCache(cacheKey, trend, 1800);
    return NextResponse.json(trend);
  } catch (error: any) {
    console.error('API /dashboard/trend error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
