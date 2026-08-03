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

async function runScan() {
  const { query } = await import('./lib/db');

  try {
    console.log('=== RUNNING FULL SCAN ON TR_ABSEN FOR CORRUPTED YEARS ===');
    
    // 1. Total count of corrupted rows
    const qCount = `
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
    const resCount = await query(qCount);
    console.log('SUMMARY STATS:', JSON.stringify(resCount, null, 2));

    // 2. Breakdown per DATE_TRANS (group by date)
    const qBreakdown = `
      SELECT 
        CONVERT(VARCHAR(10), DATE_TRANS, 120) AS DATE_TRANS,
        COUNT(*) AS CORRUPTED_COUNT,
        MIN(CONVERT(VARCHAR(19), WORK_IN, 120)) AS SAMPLE_WORK_IN,
        MIN(CONVERT(VARCHAR(19), WORK_OUT, 120)) AS SAMPLE_WORK_OUT
      FROM TR_ABSEN
      WHERE (WORK_IN IS NOT NULL AND (YEAR(WORK_IN) > YEAR(GETDATE()) + 1 OR YEAR(WORK_IN) < 2020))
         OR (WORK_OUT IS NOT NULL AND (YEAR(WORK_OUT) > YEAR(GETDATE()) + 1 OR YEAR(WORK_OUT) < 2020))
      GROUP BY DATE_TRANS
      ORDER BY DATE_TRANS ASC;
    `;
    const resBreakdown = await query(qBreakdown);
    console.log('BREAKDOWN PER DATE:\n', JSON.stringify(resBreakdown, null, 2));

  } catch (err) {
    console.error('ERROR SCANNING:', err);
  } finally {
    process.exit(0);
  }
}

runScan();
