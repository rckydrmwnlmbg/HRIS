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

async function previewRecovery() {
  const { query } = await import('./lib/db');

  try {
    console.log('=== PREVIEW PEMULIHAN DATA TAHUN 2152/2153 (29 JUNI - 5 JULI 2026) ===');
    
    // In SQL Server, to cleanly fuse DATE_TRANS and TIME:
    // CAST(CONVERT(VARCHAR(10), a.DATE_TRANS, 120) + ' ' + CONVERT(VARCHAR(8), a.WORK_IN, 108) AS DATETIME)
    
    const qCount = `
      SELECT 
        COUNT(*) AS TOTAL_TARGET_ROWS,
        MIN(CONVERT(VARCHAR(10), DATE_TRANS, 120)) AS MIN_DATE,
        MAX(CONVERT(VARCHAR(10), DATE_TRANS, 120)) AS MAX_DATE
      FROM TR_ABSEN
      WHERE (YEAR(WORK_IN) > 2050 OR YEAR(WORK_OUT) > 2050)
        AND DATE_TRANS BETWEEN '2026-06-25' AND '2026-07-10';
    `;
    const resCount = await query(qCount);
    console.log('TARGET ROWS STATS:', JSON.stringify(resCount, null, 2));

    const qSample = `
      SELECT TOP 10
        a.EMP_CD,
        CONVERT(VARCHAR(10), a.DATE_TRANS, 120) AS DATE_TRANS,
        CONVERT(VARCHAR(19), a.WORK_IN, 120) AS WORK_IN_RUSAK,
        CONVERT(VARCHAR(19), 
          CASE 
            WHEN a.WORK_IN IS NOT NULL AND YEAR(a.WORK_IN) > 2050 
            THEN CAST(CONVERT(VARCHAR(10), a.DATE_TRANS, 120) + ' ' + CONVERT(VARCHAR(8), a.WORK_IN, 108) AS DATETIME)
            ELSE a.WORK_IN 
          END, 120) AS WORK_IN_PULIH,
        CONVERT(VARCHAR(19), a.WORK_OUT, 120) AS WORK_OUT_RUSAK,
        CONVERT(VARCHAR(19), 
          CASE 
            WHEN a.WORK_OUT IS NOT NULL AND YEAR(a.WORK_OUT) > 2050 
            THEN CAST(CONVERT(VARCHAR(10), a.DATE_TRANS, 120) + ' ' + CONVERT(VARCHAR(8), a.WORK_OUT, 108) AS DATETIME)
            ELSE a.WORK_OUT 
          END, 120) AS WORK_OUT_PULIH
      FROM TR_ABSEN a
      WHERE (YEAR(a.WORK_IN) > 2050 OR YEAR(a.WORK_OUT) > 2050)
        AND a.DATE_TRANS BETWEEN '2026-06-25' AND '2026-07-10'
      ORDER BY a.DATE_TRANS, a.EMP_CD;
    `;
    const resSample = await query(qSample);
    console.log('SAMPLE PREVIEW (BEFORE -> AFTER):\n', JSON.stringify(resSample, null, 2));

  } catch (err) {
    console.error('ERROR PREVIEWING RECOVERY:', err);
  } finally {
    process.exit(0);
  }
}

previewRecovery();
