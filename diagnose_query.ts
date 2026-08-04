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

async function diagnose() {
  const { query } = await import('./lib/db');

  try {
    console.log('=== DIAGNOSE: CHECK EMP_CD 26066995 on 2026-07-02 ===');
    const qWidya = `
      SELECT 
        EMP_CD,
        CONVERT(VARCHAR(10), DATE_TRANS, 120) AS DATE_TRANS,
        CONVERT(VARCHAR(30), WORK_IN, 120) AS WORK_IN_STR,
        YEAR(WORK_IN) AS YR_IN,
        CONVERT(VARCHAR(30), WORK_OUT, 120) AS WORK_OUT_STR,
        YEAR(WORK_OUT) AS YR_OUT
      FROM TR_ABSEN
      WHERE RTRIM(EMP_CD) = '26066995' AND DATE_TRANS = '2026-07-02';
    `;
    const resWidya = await query(qWidya);
    console.log('WIDYA 2026-07-02:', JSON.stringify(resWidya, null, 2));

    console.log('\n=== DIAGNOSE: CHECK 2024-02-05 ROWS (Was 241 corrupted) ===');
    const q2024 = `
      SELECT TOP 5
        EMP_CD,
        CONVERT(VARCHAR(10), DATE_TRANS, 120) AS DATE_TRANS,
        CONVERT(VARCHAR(30), WORK_IN, 120) AS WORK_IN_STR,
        YEAR(WORK_IN) AS YR_IN,
        CONVERT(VARCHAR(30), WORK_OUT, 120) AS WORK_OUT_STR,
        YEAR(WORK_OUT) AS YR_OUT
      FROM TR_ABSEN
      WHERE DATE_TRANS = '2024-02-05';
    `;
    const res2024 = await query(q2024);
    console.log('2024-02-05 SAMPLE:', JSON.stringify(res2024, null, 2));

    console.log('\n=== DIAGNOSE: COUNT ANY ROWS WITH YEAR != 2024, 2025, 2026 ===');
    const qAllYears = `
      SELECT 
        YEAR(WORK_IN) AS Y_IN,
        COUNT(*) AS CNT
      FROM TR_ABSEN
      WHERE WORK_IN IS NOT NULL
      GROUP BY YEAR(WORK_IN)
      ORDER BY Y_IN;
    `;
    const resAllYears = await query(qAllYears);
    console.log('YEAR(WORK_IN) GROUP BY:', JSON.stringify(resAllYears, null, 2));

    const qAllYearsOut = `
      SELECT 
        YEAR(WORK_OUT) AS Y_OUT,
        COUNT(*) AS CNT
      FROM TR_ABSEN
      WHERE WORK_OUT IS NOT NULL
      GROUP BY YEAR(WORK_OUT)
      ORDER BY Y_OUT;
    `;
    const resAllYearsOut = await query(qAllYearsOut);
    console.log('YEAR(WORK_OUT) GROUP BY:', JSON.stringify(resAllYearsOut, null, 2));

  } catch (err) {
    console.error('ERROR:', err);
  } finally {
    process.exit(0);
  }
}

diagnose();
