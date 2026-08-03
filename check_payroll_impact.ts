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

async function checkPayrollImpact() {
  const { query } = await import('./lib/db');

  try {
    console.log('=== 1. LIST OF ALL TABLES IN DATABASE ===');
    const qTables = `
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_TYPE = 'BASE TABLE'
      ORDER BY TABLE_NAME;
    `;
    const tables = await query(qTables);
    console.log('TABLES:', tables?.map((t: any) => t.TABLE_NAME));

    console.log('\n=== 2. CHECK PAYROLL / GAJI RECORDS (LAST PROCESSED PERIOD) ===');
    // Check tables like TR_GAJI, TR_SALARY, or similar if exists
    for (const t of (tables || [])) {
      const name = (t as any).TABLE_NAME;
      if (name.includes('GAJI') || name.includes('PAY') || name.includes('SALARY') || name.includes('SLIP') || name.includes('OT')) {
        console.log(`Checking table: ${name}`);
        try {
          const sample = await query(`SELECT TOP 5 * FROM ${name}`);
          console.log(`Sample from ${name}:`, sample);
        } catch (err: any) {
          console.log(`Could not query ${name}:`, err.message);
        }
      }
    }

    console.log('\n=== 3. CHECK OT_1 VALUES FOR JULY 2026 IN TR_ABSEN ===');
    const qJulyOT = `
      SELECT 
        CONVERT(VARCHAR(10), DATE_TRANS, 120) AS DATE_TRANS,
        COUNT(*) AS TOTAL_ROWS,
        SUM(CASE WHEN OT_1 > 0 THEN 1 ELSE 0 END) AS ROWS_WITH_OT1_GT_0,
        SUM(ISNULL(OT_1, 0)) AS SUM_OT1,
        SUM(ISNULL(OT_2, 0)) AS SUM_OT2,
        SUM(ISNULL(OT_3, 0)) AS SUM_OT3,
        SUM(ISNULL(OT_4, 0)) AS SUM_OT4
      FROM TR_ABSEN
      WHERE DATE_TRANS BETWEEN '2026-06-25' AND '2026-07-31'
      GROUP BY DATE_TRANS
      ORDER BY DATE_TRANS;
    `;
    const julyOT = await query(qJulyOT);
    console.log('JULY 2026 OT DISTRIBUTION:\n', JSON.stringify(julyOT, null, 2));

  } catch (err) {
    console.error('ERROR:', err);
  } finally {
    process.exit(0);
  }
}

checkPayrollImpact();
