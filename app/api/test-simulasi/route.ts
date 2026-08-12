import { NextResponse } from 'next/server';
import { calculateAttendanceAndOt } from '@/lib/otCalculator';

export async function GET() {
  const dates = [
    '2026-08-10T17:00:00',
    '2026-08-10T18:00:00',
    '2026-08-10T19:00:00',
    '2026-08-10T20:30:00',
    '2026-08-10T21:00:00',
    '2026-08-10T22:00:00',
    '2026-08-10T23:00:00',
    '2026-08-11T00:00:00'
  ];

  const simulationResults = [];

  for (const outStr of dates) {
    const inDate = new Date('2026-08-10T07:00:00');
    const outDate = new Date(outStr);
    
    // Asumsi jam pulang standar 16:00
    const scheduleOut = new Date('2026-08-10T16:00:00');
    const diffMinutes = (outDate.getTime() - scheduleOut.getTime()) / 60000;
    
    const result = calculateAttendanceAndOt(
      '2026-08-10',
      inDate,
      outDate,
      'Operator', // Non-security
      '',
      'KERJA',
      '1'
    );

    const breakMins = diffMinutes >= 210 ? 30 : 0;
    const timeStr = outStr.split('T')[1].substring(0, 5);
    
    simulationResults.push({
      'Jam Pulang': timeStr,
      'Menit Lewat': diffMinutes,
      'Jam Kotor': parseFloat((diffMinutes / 60).toFixed(1)),
      'Potongan Istirahat (menit)': breakMins,
      'Total Lembur Bersih (Jam)': result.OT_1 + result.OT_2,
      'OT_1': result.OT_1,
      'OT_2': result.OT_2,
      'Total_OT (T_OT)': result.T_OT
    });
  }

  return NextResponse.json({
    KETERANGAN: "Simulasi Perhitungan OT untuk Karyawan Umum (Non-Security). Jam Pulang Standar = 16:00.",
    HASIL_SIMULASI: simulationResults
  });
}
