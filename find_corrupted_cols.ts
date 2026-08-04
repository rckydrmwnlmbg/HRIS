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

async function findCorruptedColumns() {
  const { query } = await import('./lib/db');

  try {
    console.log('=== INSPECT ALL DATE/TIME COLUMNS IN TR_ABSEN ===');
    const cols = ['DATE_TRANS', 'DATE_IN', 'DATE_OUT', 'WORK_IN', 'WORK_OUT', 'WORK_IN1', 'WORK_OUT1', 'JAM_MASUK', 'JAM_PULANG'];
    
    for (const c of cols) {
      const q = `
        SELECT 
          '${c}' AS COL_NAME,
          MIN(YEAR(CAST(${c} AS DATETIME))) AS MIN_YR,
          MAX(YEAR(CAST(${c} AS DATETIME))) AS MAX_YR,
          SUM(CASE WHEN YEAR(CAST(${c} AS DATETIME)) < 2020 THEN 1 ELSE 0 END) AS CNT_LT_2020,
          SUM(CASE WHEN YEAR(CAST(${c} AS DATETIME)) > 2028 THEN 1 ELSE 0 END) AS CNT_GT_2028
        FROM TR_ABSEN
        WHERE ${c} IS NOT NULL;
      `;
      const res = await query(q);
      console.log(JSON.stringify(res, null, 2));
    }

  } catch (err) {
    console.error('ERROR:', err);
  } finally {
    process.exit(0);
  }
}

findCorruptedColumns();
