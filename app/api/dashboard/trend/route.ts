import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCache, setCache } from '@/lib/cache';

export async function GET() {
  try {
    const cachedData = getCache('dashboard_trend');
    if (cachedData) {
      return NextResponse.json(cachedData);
    }

    const today = new Date();
    const y = today.getFullYear();
    let nextM = today.getMonth() + 2;
    let nextY = y;
    if (nextM > 12) { nextM = 1; nextY++; }
    const firstDayOfNextMonthStr = `${nextY}-${String(nextM).padStart(2, '0')}-01`;

    const past6Months = new Date(today);
    past6Months.setDate(1); // Set to 1st to prevent month rollover
    past6Months.setMonth(past6Months.getMonth() - 5);
    const p6y = past6Months.getFullYear();
    const p6m = String(past6Months.getMonth() + 1).padStart(2, '0');
    const past6MonthsStr = `${p6y}-${p6m}-01`;

    const trendResult = await query<any>(`
      SELECT 
        MONTH(a.DATE_TRANS) as m, 
        YEAR(a.DATE_TRANS) as y,
        RTRIM(a.STATUS_HARI) as STATUS_HARI,
        RTRIM(a.REASON) as REASON,
        COUNT(DISTINCT a.EMP_CD) as jumlah
      FROM TR_ABSEN a
      JOIN EMP_TABLE e ON a.EMP_CD = e.EMP_CD
      WHERE a.DATE_TRANS >= '${past6MonthsStr}' AND a.DATE_TRANS < '${firstDayOfNextMonthStr}'
        AND e.Act_NonAct = 1 
        AND (e.DT_RSG IS NULL OR e.DT_RSG > GETDATE())
      GROUP BY MONTH(a.DATE_TRANS), YEAR(a.DATE_TRANS), RTRIM(a.STATUS_HARI), RTRIM(a.REASON)
    `);

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

    const trendMap = new Map<string, any>();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(1); // Set to 1st to prevent month rollover issues on 31st
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
        else if (s === 'MANGKIR' || s === 'A') item.alpha += row.jumlah;
        else if (s === 'IZIN' || s === 'I') item.izin += row.jumlah;
        else if (s === 'CUTI' || s === 'C' || s === 'H') item.cuti += row.jumlah;
        else if (s === 'SAKIT' || s === 'S') item.sakit += row.jumlah;
      }
    });

    const trend = Array.from(trendMap.values());
    
    // Cache trend for 1 hour (3600 seconds) because it's very heavy and doesn't change significantly intraday
    setCache('dashboard_trend', trend, 3600);

    return NextResponse.json(trend);
  } catch (error: any) {
    console.error('API /dashboard/trend error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
