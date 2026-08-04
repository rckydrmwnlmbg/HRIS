import fs from 'fs';
import path from 'path';

process.env.NODE_ENV = 'development';
process.env.DATA_MODE = 'live';

try {
  const envContent = fs.readFileSync(path.resolve('.env.local'), 'utf-8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const [key, ...vals] = trimmed.split('=');
      process.env[key.trim()] = vals.join('=').trim();
    }
  });
} catch (e) {}

process.env.NODE_ENV = 'development';
process.env.DATA_MODE = 'live';

async function runExactUserQuery() {
  const { query } = await import('./lib/db');

  try {
    console.log('=== QUERY 1: EXACT USER QUERY ON TR_ABSEN ===');
    const q1 = `
      SELECT 
        COUNT(*) AS TOTAL_ROWS,
        SUM(CASE WHEN WORK_IN IS NOT NULL AND (YEAR(WORK_IN) > 2027 OR YEAR(WORK_IN) < 2020) THEN 1 ELSE 0 END) AS WORK_IN_RUSAK,
        SUM(CASE WHEN WORK_OUT IS NOT NULL AND (YEAR(WORK_OUT) > 2027 OR YEAR(WORK_OUT) < 2020) THEN 1 ELSE 0 END) AS WORK_OUT_RUSAK,
        SUM(CASE WHEN (WORK_IN IS NOT NULL AND (YEAR(WORK_IN) > 2027 OR YEAR(WORK_IN) < 2020))
                  OR (WORK_OUT IS NOT NULL AND (YEAR(WORK_OUT) > 2027 OR YEAR(WORK_OUT) < 2020)) THEN 1 ELSE 0 END) AS TOTAL_BARIS_RUSAK
      FROM TR_ABSEN;
    `;
    const res1 = await query(q1);
    console.log('HASIL QUERY 1 (TR_ABSEN):', JSON.stringify(res1, null, 2));

    console.log('\n=== QUERY 2: CHECK COLUMN TYPES OF TR_ABSEN ===');
    const qTypes = `
      SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'TR_ABSEN'
        AND COLUMN_NAME IN ('WORK_IN', 'WORK_OUT', 'WORK_IN1', 'WORK_OUT1', 'DATE_TRANS', 'DATE_IN', 'DATE_OUT', 'JAM_MASUK', 'JAM_PULANG')
      ORDER BY COLUMN_NAME;
    `;
    const resTypes = await query(qTypes);
    console.log('DATA TYPES:', JSON.stringify(resTypes, null, 2));

    console.log('\n=== QUERY 3: CHECK JULY 2026 SPECIFICALLY (29 JUNI - 5 JULI 2026) ===');
    const qJuly = `
      SELECT 
        CONVERT(VARCHAR(10), DATE_TRANS, 120) AS TGL,
        COUNT(*) AS TOTAL_BARIS,
        SUM(CASE WHEN YEAR(WORK_IN) > 2027 THEN 1 ELSE 0 END) AS IN_GT_2027,
        SUM(CASE WHEN YEAR(WORK_IN) < 2020 THEN 1 ELSE 0 END) AS IN_LT_2020,
        SUM(CASE WHEN YEAR(WORK_OUT) > 2027 THEN 1 ELSE 0 END) AS OUT_GT_2027,
        SUM(CASE WHEN YEAR(WORK_OUT) < 2020 THEN 1 ELSE 0 END) AS OUT_LT_2020
      FROM TR_ABSEN
      WHERE DATE_TRANS BETWEEN '2026-06-25' AND '2026-07-10'
      GROUP BY DATE_TRANS
      ORDER BY DATE_TRANS;
    `;
    const resJuly = await query(qJuly);
    console.log('HASIL PER TANGGAL JULI 2026:', JSON.stringify(resJuly, null, 2));

  } catch (err) {
    console.error('ERROR:', err);
  } finally {
    process.exit(0);
  }
}

runExactUserQuery();
