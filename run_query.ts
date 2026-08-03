import fs from 'fs';
import path from 'path';

// Set NODE_ENV and DATA_MODE before loading db
process.env.NODE_ENV = 'development';
process.env.DATA_MODE = 'live';

// Parse .env.local manually
try {
  const envContent = fs.readFileSync(path.resolve('.env.local'), 'utf-8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const [key, ...vals] = trimmed.split('=');
      process.env[key.trim()] = vals.join('=').trim();
    }
  });
} catch (e) {
  console.log('No .env.local or error reading it');
}

// Force environment
process.env.NODE_ENV = 'development';
process.env.DATA_MODE = 'live';

async function run() {
  const { query } = await import('./lib/db');

  try {
    console.log('=== QUERY 1: KARYAWAN 2 JULI 2026 ===');
    const q1 = `
      SELECT 
          a.EMP_CD,
          e.EMP_NM,
          CONVERT(VARCHAR(10), a.DATE_TRANS, 120) AS DATE_TRANS,
          a.STATUS_HARI,
          CONVERT(VARCHAR(19), a.WORK_IN1, 120)   AS WORK_IN1_MENTAH,
          CONVERT(VARCHAR(19), a.WORK_IN, 120)    AS WORK_IN_DB,
          CONVERT(VARCHAR(19), a.WORK_OUT1, 120)  AS WORK_OUT1_MENTAH,
          CONVERT(VARCHAR(19), a.WORK_OUT, 120)   AS WORK_OUT_DB,
          CONVERT(VARCHAR(8), a.JAM_MASUK, 108)   AS JAM_MASUK,
          CONVERT(VARCHAR(8), a.JAM_PULANG, 108)  AS JAM_PULANG,
          a.JAM_KERJA,
          a.OT_1
      FROM TR_ABSEN a
      LEFT JOIN EMP_TABLE e ON RTRIM(a.EMP_CD) = RTRIM(e.EMP_CD)
      WHERE a.DATE_TRANS = '2026-07-02'
        AND (
            CAST(a.WORK_OUT1 AS TIME) = '23:43:22' 
            OR CAST(a.WORK_OUT AS TIME) = '23:43:22'
            OR CAST(a.WORK_IN1 AS TIME) = '06:37:09'
            OR CAST(a.WORK_IN AS TIME) = '06:37:09'
        );
    `;
    const res1 = await query(q1);
    console.log('QUERY 1 RESULT:', JSON.stringify(res1, null, 2));

    console.log('\n=== QUERY 3: AUDIT JAM MASUK 00:00 - 05:00 (NON-SECURITY) ===');
    const q3 = `
      SELECT 
          a.EMP_CD, 
          e.EMP_NM, 
          CONVERT(VARCHAR(10), a.DATE_TRANS, 120) AS DATE_TRANS, 
          a.STATUS_HARI, 
          CONVERT(VARCHAR(19), a.WORK_IN1, 120) AS WORK_IN1,
          CONVERT(VARCHAR(19), a.WORK_IN, 120)  AS WORK_IN, 
          CONVERT(VARCHAR(19), a.WORK_OUT1, 120) AS WORK_OUT1,
          CONVERT(VARCHAR(19), a.WORK_OUT, 120) AS WORK_OUT,
          a.JAM_KERJA,
          a.OT_1
      FROM TR_ABSEN a
      LEFT JOIN EMP_TABLE e ON RTRIM(a.EMP_CD) = RTRIM(e.EMP_CD)
      LEFT JOIN MS_JOBS j ON RTRIM(e.JOB_CD) = RTRIM(j.JOB_CD)
      WHERE a.STATUS_HARI = 'KERJA'
        AND a.WORK_IN IS NOT NULL
        AND DATEPART(HOUR, a.WORK_IN) BETWEEN 0 AND 5
        AND ISNULL(RTRIM(j.JOB_DESC), '') <> 'SECURITY'
      ORDER BY a.DATE_TRANS DESC;
    `;
    const res3 = await query(q3);
    console.log(`QUERY 3 RESULT (Total: ${res3 ? res3.length : 0}):`, JSON.stringify(res3, null, 2));

    if (res1 && res1.length > 0) {
      const empCd = (res1[0] as any).EMP_CD;
      console.log(`\n=== DETAIL RAW TR_ABSEN FOR ${empCd} (1-3 JULI 2026) ===`);
      const qDetail = `
        SELECT 
          CONVERT(VARCHAR(10), a.DATE_TRANS, 120) AS DATE_TRANS,
          CONVERT(VARCHAR(19), a.WORK_IN1, 120) AS WORK_IN1_ASLI,
          CONVERT(VARCHAR(19), a.WORK_IN, 120) AS WORK_IN_DB,
          CONVERT(VARCHAR(19), a.WORK_OUT1, 120) AS WORK_OUT1_ASLI,
          CONVERT(VARCHAR(19), a.WORK_OUT, 120) AS WORK_OUT_DB,
          CONVERT(VARCHAR(8), a.JAM_MASUK, 108) AS JAM_MASUK,
          CONVERT(VARCHAR(8), a.JAM_PULANG, 108) AS JAM_PULANG,
          a.JAM_KERJA, a.OT_1
        FROM TR_ABSEN a
        WHERE RTRIM(a.EMP_CD) = '${empCd}' AND a.DATE_TRANS BETWEEN '2026-07-01' AND '2026-07-03'
        ORDER BY a.DATE_TRANS;
      `;
      const resDetail = await query(qDetail);
      console.log(JSON.stringify(resDetail, null, 2));
    }
  } catch (err) {
    console.error('ERROR:', err);
  } finally {
    process.exit(0);
  }
}

run();
