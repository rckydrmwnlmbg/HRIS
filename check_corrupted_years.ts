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

async function checkCorruptedYears() {
  const { query } = await import('./lib/db');

  try {
    console.log('=== DISTRIBUSI KERUSAKAN TAHUN DI TR_ABSEN ===');
    const q = `
      SELECT 
        YEAR(WORK_IN) AS YEAR_IN,
        YEAR(WORK_OUT) AS YEAR_OUT,
        MIN(CONVERT(VARCHAR(10), DATE_TRANS, 120)) AS MIN_DATE,
        MAX(CONVERT(VARCHAR(10), DATE_TRANS, 120)) AS MAX_DATE,
        COUNT(*) AS TOTAL_ROWS
      FROM TR_ABSEN
      WHERE (WORK_IN IS NOT NULL AND (YEAR(WORK_IN) < 2020 OR YEAR(WORK_IN) > 2028))
         OR (WORK_OUT IS NOT NULL AND (YEAR(WORK_OUT) < 2020 OR YEAR(WORK_OUT) > 2028))
      GROUP BY YEAR(WORK_IN), YEAR(WORK_OUT)
      ORDER BY TOTAL_ROWS DESC;
    `;
    const res = await query(q);
    console.log(JSON.stringify(res, null, 2));

  } catch (err) {
    console.error('ERROR:', err);
  } finally {
    process.exit(0);
  }
}

checkCorruptedYears();
