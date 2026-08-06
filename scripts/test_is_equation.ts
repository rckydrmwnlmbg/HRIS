import { query } from '../lib/db';

async function testIsEquation() {
  console.log('================================================================================');
  console.log('4. UJI HIPOTESIS PERSAMAAN TOTAL: JAM_KERJA = STDJAM + IS1 + IS2 + IS3 + T_OT');
  console.log('================================================================================\n');

  // Ambil data hari kerja dengan lembur
  const testResults = await query<any>(`
    WITH EvalEquation AS (
      SELECT 
        JAM_KERJA,
        STDJAM,
        ISNULL(IS1, 0) AS IS1,
        ISNULL(IS2, 0) AS IS2,
        ISNULL(IS3, 0) AS IS3,
        ISNULL(T_OT, 0) AS T_OT,
        (ISNULL(STDJAM, 0) + ISNULL(IS1, 0) + ISNULL(IS2, 0) + ISNULL(IS3, 0) + ISNULL(T_OT, 0)) AS TOTAL_KOMPONEN
      FROM TR_ABSEN
      WHERE STATUS_HARI = 'KERJA'
        AND JAM_KERJA > 0
    )
    SELECT 
      COUNT(*) AS TOTAL_BARIS,
      SUM(CASE WHEN JAM_KERJA = TOTAL_KOMPONEN THEN 1 ELSE 0 END) AS EXACT_MATCH,
      SUM(CASE WHEN ABS(JAM_KERJA - TOTAL_KOMPONEN) <= 0.05 THEN 1 ELSE 0 END) AS MATCH_WITH_ROUNDING,
      ROUND(SUM(CASE WHEN JAM_KERJA = TOTAL_KOMPONEN THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) AS PERSENTASE_EXACT,
      ROUND(SUM(CASE WHEN ABS(JAM_KERJA - TOTAL_KOMPONEN) <= 0.05 THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) AS PERSENTASE_ROUNDING
    FROM EvalEquation
  `);

  console.log('Hasil Uji Persamaan JAM_KERJA = STDJAM + IS1 + IS2 + IS3 + T_OT:');
  console.table(testResults);

  // Kapan IS1, IS2, IS3 diisi oleh INUS?
  // Mari cek relasi antara jam kerja / jam lembur dengan nilai IS1, IS2, IS3
  const isRules = await query<any>(`
    SELECT 
      FLOOR(JAM_KERJA) AS JAM_KERJA_INT,
      COUNT(*) AS JUMLAH_BARIS,
      AVG(ISNULL(IS1,0)) AS AVG_IS1,
      AVG(ISNULL(IS2,0)) AS AVG_IS2,
      AVG(ISNULL(IS3,0)) AS AVG_IS3,
      MAX(ISNULL(IS1,0)) AS MAX_IS1,
      MAX(ISNULL(IS2,0)) AS MAX_IS2
    FROM TR_ABSEN
    WHERE STATUS_HARI = 'KERJA' AND JAM_KERJA >= 8
    GROUP BY FLOOR(JAM_KERJA)
    ORDER BY FLOOR(JAM_KERJA) ASC
  `);
  console.log('\nDistribusi IS1, IS2, IS3 berdasarkan Rentang Total JAM_KERJA:');
  console.table(isRules);
}

testIsEquation().then(() => process.exit(0)).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
