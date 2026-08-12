import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());
process.env.DATA_MODE = 'live';

import { query } from './lib/db';
import { calculateAttendanceAndOt } from './lib/otCalculator';

async function validateOt() {
  console.log('--- Memulai Validasi Perhitungan OT (INUS vs Widy HRIS) ---');
  
  try {
    // 1. Ambil 500 data absen yang memiliki OT dari INUS
    const absensiData = await query(`
      SELECT TOP 500 
        a.EMP_CD, a.DATE_TRANS, a.WORK_IN, a.WORK_OUT, a.STATUS_HARI, a.SHIFT,
        a.OT_1 as INUS_OT_1, a.OT_2 as INUS_OT_2, a.OT_3 as INUS_OT_3, a.OT_4 as INUS_OT_4, a.T_OT as INUS_T_OT,
        e.JOB_CD, j.JOB_DESC, e.SEC_CD, s.SEC_DESC
      FROM TR_ABSEN a
      JOIN EMP_TABLE e ON RTRIM(a.EMP_CD) = RTRIM(e.EMP_CD)
      LEFT JOIN MS_JOBS j ON RTRIM(e.JOB_CD) = RTRIM(j.JOB_CD)
      LEFT JOIN MS_SEC s ON RTRIM(e.SEC_CD) = RTRIM(s.SEC_CD)
      WHERE a.DATE_TRANS >= '2024-01-01' AND (a.OT_1 > 0 OR a.OT_2 > 0 OR a.T_OT > 0)
      ORDER BY a.DATE_TRANS DESC
    `);
    
    console.log(`Berhasil mengambil ${absensiData.length} data absen dari database.`);
    
    let diffCount = 0;
    let matchCount = 0;
    const differences = [];

    for (const row of absensiData) {
      if (!row.WORK_IN || !row.WORK_OUT) continue;
      
      const dateStr = new Date(row.DATE_TRANS).toISOString().split('T')[0];
      
      // Jalankan rumus HRIS
      const hrisOt = calculateAttendanceAndOt(
        dateStr,
        new Date(row.WORK_IN),
        new Date(row.WORK_OUT),
        row.JOB_DESC || '',
        row.SEC_DESC || '',
        row.STATUS_HARI || '',
        row.SHIFT || ''
      );
      
      const inusTot = Number(row.INUS_T_OT) || 0;
      const hrisTot = Number(hrisOt.T_OT) || 0;
      
      // Jika selisih T_OT lebih dari 0.1, anggap beda
      if (Math.abs(inusTot - hrisTot) > 0.1) {
        diffCount++;
        if (differences.length < 5) {
          differences.push({
            NIK: row.EMP_CD.trim(),
            Tgl: dateStr,
            In: new Date(row.WORK_IN).toISOString().split('T')[1].substring(0,5),
            Out: new Date(row.WORK_OUT).toISOString().split('T')[1].substring(0,5),
            Status: row.STATUS_HARI?.trim(),
            Shift: row.SHIFT?.trim(),
            Job: (row.JOB_DESC || row.JOB_CD)?.trim(),
            INUS: { OT1: row.INUS_OT_1, OT2: row.INUS_OT_2, TOT: inusTot },
            HRIS: { OT1: hrisOt.OT_1, OT2: hrisOt.OT_2, TOT: hrisTot }
          });
        }
      } else {
        matchCount++;
      }
    }
    
    console.log('\\n--- HASIL VALIDASI ---');
    console.log(`Total Data Dievaluasi: ${matchCount + diffCount}`);
    console.log(`✅ Sesuai (HRIS == INUS): ${matchCount}`);
    console.log(`❌ Berbeda (HRIS != INUS): ${diffCount}`);
    
    if (diffCount > 0) {
      console.log('\\nContoh perbedaan (Max 5):');
      console.log(JSON.stringify(differences, null, 2));
    }
    
  } catch (error) {
    console.error('Error saat validasi:', error);
  }
  process.exit(0);
}

validateOt();
