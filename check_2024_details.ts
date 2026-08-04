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

async function check2024Details() {
  const { query } = await import('./lib/db');

  try {
    console.log('=== CHECK 2024-01-02 IN TR_ABSEN ===');
    const q1 = `
      SELECT TOP 10
        EMP_CD,
        DATE_TRANS,
        CONVERT(VARCHAR(30), WORK_IN, 120) AS WORK_IN,
        CONVERT(VARCHAR(30), WORK_OUT, 120) AS WORK_OUT,
        CONVERT(VARCHAR(30), WORK_IN1, 120) AS WORK_IN1,
        CONVERT(VARCHAR(30), WORK_OUT1, 120) AS WORK_OUT1,
        CONVERT(VARCHAR(30), JAM_MASUK, 120) AS JAM_MASUK,
        CONVERT(VARCHAR(30), JAM_PULANG, 120) AS JAM_PULANG
      FROM TR_ABSEN
      WHERE DATE_TRANS = '2024-01-02';
    `;
    const res1 = await query(q1);
    console.log('2024-01-02 SAMPLE:', JSON.stringify(res1, null, 2));

    console.log('\n=== RUN SCAN_CORRUPTED QUERY AGAIN ===');
    const qScan = `
      SELECT 
        COUNT(*) AS TOTAL_CORRUPTED_ROWS,
        MIN(CONVERT(VARCHAR(10), DATE_TRANS, 120)) AS MIN_DATE_TRANS,
        MAX(CONVERT(VARCHAR(10), DATE_TRANS, 120)) AS MAX_DATE_TRANS,
        MIN(YEAR(WORK_IN)) AS MIN_YEAR_IN,
        MAX(YEAR(WORK_IN)) AS MAX_YEAR_IN,
        MIN(YEAR(WORK_OUT)) AS MIN_YEAR_OUT,
        MAX(YEAR(WORK_OUT)) AS MAX_YEAR_OUT
      FROM TR_ABSEN
      WHERE (WORK_IN IS NOT NULL AND (YEAR(WORK_IN) > YEAR(GETDATE()) + 1 OR YEAR(WORK_IN) < 2020))
         OR (WORK_OUT IS NOT NULL AND (YEAR(WORK_OUT) > YEAR(GETDATE()) + 1 OR YEAR(WORK_OUT) < 2020));
    `;
    const resScan = await query(qScan);
    console.log('SCAN_CORRUPTED RESULT NOW:', JSON.stringify(resScan, null, 2));

  } catch (err) {
    console.error('ERROR:', err);
  } finally {
    process.exit(0);
  }
}

check2024Details();
