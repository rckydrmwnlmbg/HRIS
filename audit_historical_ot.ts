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

async function auditHistoricalOT() {
  const { query } = await import('./lib/db');

  try {
    console.log('=== AUDIT DISTRIBUSI BULANAN OT (2024 - 2026) ===');
    const qMonthly = `
      SELECT 
        LEFT(CONVERT(VARCHAR(10), DATE_TRANS, 120), 7) AS MONTH_TRANS,
        COUNT(*) AS TOTAL_ABSEN_ROWS,
        SUM(CASE WHEN OT_1 > 0 THEN 1 ELSE 0 END) AS ROWS_WITH_OT1,
        SUM(ISNULL(OT_1, 0)) AS TOTAL_OT1,
        SUM(CASE WHEN OT_2 > 0 THEN 1 ELSE 0 END) AS ROWS_WITH_OT2,
        SUM(ISNULL(OT_2, 0)) AS TOTAL_OT2,
        SUM(ISNULL(OT_3, 0)) AS TOTAL_OT3,
        SUM(ISNULL(OT_4, 0)) AS TOTAL_OT4
      FROM TR_ABSEN
      GROUP BY LEFT(CONVERT(VARCHAR(10), DATE_TRANS, 120), 7)
      ORDER BY MONTH_TRANS ASC;
    `;
    const resMonthly = await query(qMonthly);
    console.log(JSON.stringify(resMonthly, null, 2));

  } catch (err) {
    console.error('ERROR AUDITING OT:', err);
  } finally {
    process.exit(0);
  }
}

auditHistoricalOT();
