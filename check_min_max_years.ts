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

async function checkMinMaxYears() {
  const { query } = await import('./lib/db');

  try {
    console.log('=== MIN MAX YEARS IN TR_ABSEN ===');
    const q = `
      SELECT 
        MIN(YEAR(DATE_TRANS)) AS MIN_YR_TRANS,
        MAX(YEAR(DATE_TRANS)) AS MAX_YR_TRANS,
        MIN(YEAR(WORK_IN)) AS MIN_YR_WORK_IN,
        MAX(YEAR(WORK_IN)) AS MAX_YR_WORK_IN,
        MIN(YEAR(WORK_OUT)) AS MIN_YR_WORK_OUT,
        MAX(YEAR(WORK_OUT)) AS MAX_YR_WORK_OUT,
        MIN(YEAR(WORK_IN1)) AS MIN_YR_WORK_IN1,
        MAX(YEAR(WORK_IN1)) AS MAX_YR_WORK_IN1,
        MIN(YEAR(WORK_OUT1)) AS MIN_YR_WORK_OUT1,
        MAX(YEAR(WORK_OUT1)) AS MAX_YR_WORK_OUT1
      FROM TR_ABSEN;
    `;
    const res = await query(q);
    console.log(JSON.stringify(res, null, 2));

    const qYears = `
      SELECT DISTINCT YEAR(WORK_IN) AS YR_IN, COUNT(*) AS CNT
      FROM TR_ABSEN
      GROUP BY YEAR(WORK_IN)
      ORDER BY YR_IN;
    `;
    const resYears = await query(qYears);
    console.log('DISTINCT WORK_IN YEARS:\n', JSON.stringify(resYears, null, 2));

    const qYearsOut = `
      SELECT DISTINCT YEAR(WORK_OUT) AS YR_OUT, COUNT(*) AS CNT
      FROM TR_ABSEN
      GROUP BY YEAR(WORK_OUT)
      ORDER BY YR_OUT;
    `;
    const resYearsOut = await query(qYearsOut);
    console.log('DISTINCT WORK_OUT YEARS:\n', JSON.stringify(resYearsOut, null, 2));

  } catch (err) {
    console.error('ERROR:', err);
  } finally {
    process.exit(0);
  }
}

checkMinMaxYears();
