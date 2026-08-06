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
} catch {}

const { query } = await import('./lib/db');

async function bench(label: string, sql: string, params?: any) {
  const t0 = Date.now();
  try {
    const r = await query(sql, params);
    const ms = Date.now() - t0;
    console.log(`[${ms.toString().padStart(5)}ms] ${label} -> ${r.length} rows`);
    return { ms, rows: r.length };
  } catch (e: any) {
    console.log(`[ERR ] ${label}: ${e.message}`);
    return { ms: -1, rows: 0 };
  }
}

async function main() {
  console.log('\n=== TABLE SIZES ===');
  await bench(
    'EMP_TABLE count',
    `SELECT 'EMP_TABLE' AS t, COUNT(*) AS n FROM EMP_TABLE`
  );
  await bench(
    'TR_ABSEN count',
    `SELECT 'TR_ABSEN' AS t, COUNT(*) AS n FROM TR_ABSEN`
  );
  await bench(
    'tblCUTI count',
    `SELECT 'tblCUTI' AS t, COUNT(*) AS n FROM tblCUTI`
  );
  await bench(
    'tbldetcuti count',
    `SELECT 'tbldetcuti' AS t, COUNT(*) AS n FROM tbldetcuti`
  );
  await bench(
    'TR_LEMBUR_ALLIN count',
    `SELECT 'TR_LEMBUR_ALLIN' AS t, COUNT(*) AS n FROM TR_LEMBUR_ALLIN`
  );

  console.log('\n=== INDEXES ===');
  await query(`
    SELECT t.name AS tbl, i.name AS idx, i.type_desc
    FROM sys.indexes i
    JOIN sys.tables t ON i.object_id = t.object_id
    WHERE i.is_hypothetical = 0
      AND t.name IN ('EMP_TABLE','TR_ABSEN','tblCUTI','tbldetcuti','TR_LEMBUR_ALLIN','TR_SPL')
    ORDER BY t.name, i.name
  `).then((r: any) => {
    r.forEach((row: any) => console.log(`  ${row.tbl.padEnd(20)} ${row.idx?.padEnd(30)} ${row.type_desc}`));
  });

  console.log('\n=== CRITICAL QUERY PROFILES ===');

  await bench(
    'karyawan: list default aktif',
    `SELECT RTRIM(e.EMP_CD) AS EMP_CD, RTRIM(e.EMP_NM) AS EMP_NM, RTRIM(e.DEP_CD) AS DEP_CD, RTRIM(e.SEC_CD) AS SEC_CD, RTRIM(e.JOB_CD) AS JOB_CD, RTRIM(e.JNS_KRY) AS JNS_KRY
     FROM EMP_TABLE e
     WHERE e.Act_NonAct = 1
       AND (e.DT_ENTRY IS NULL OR CONVERT(varchar(10), e.DT_ENTRY, 120) <= CONVERT(varchar(10), GETDATE(), 120))
       AND (e.DT_RSG IS NULL OR CONVERT(varchar(10), e.DT_RSG, 120) >= CONVERT(varchar(10), GETDATE(), 120))
     ORDER BY e.EMP_NM ASC`
  );

  await bench(
    'karyawan: full payload w/ joins',
    `SELECT TOP 50 RTRIM(e.EMP_CD) AS EMP_CD, RTRIM(e.EMP_NM) AS EMP_NM, RTRIM(d.DEP_DESC) AS DEP_DESC, RTRIM(s.SEC_DESC) AS SEC_DESC
     FROM EMP_TABLE e
     LEFT JOIN MS_DEP d ON e.DEP_CD = d.DEP_CD
     LEFT JOIN MS_SEC s ON e.SEC_CD = s.SEC_CD
     LEFT JOIN MS_JOBS j ON e.JOB_CD = j.JOB_CD
     LEFT JOIN MSJNS_KRY jk ON e.JNS_KRY = jk.JNS_CODE
     WHERE e.Act_NonAct = 1
     ORDER BY e.EMP_NM ASC`
  );

  await bench(
    'karyawan: full payload LIMIT 10000',
    `SELECT TOP 10000 RTRIM(e.EMP_CD) AS EMP_CD, RTRIM(e.EMP_NM) AS EMP_NM, RTRIM(d.DEP_DESC) AS DEP_DESC, RTRIM(s.SEC_DESC) AS SEC_DESC
     FROM EMP_TABLE e
     LEFT JOIN MS_DEP d ON e.DEP_CD = d.DEP_CD
     LEFT JOIN MS_SEC s ON e.SEC_CD = s.SEC_CD
     LEFT JOIN MS_JOBS j ON e.JOB_CD = j.JOB_CD
     LEFT JOIN MSJNS_KRY jk ON e.JNS_KRY = jk.JNS_CODE
     WHERE e.Act_NonAct = 1
     ORDER BY e.EMP_NM ASC`
  );

  await bench(
    'karyawan: search LIKE with 4 LEFT JOINs',
    `SELECT TOP 50 RTRIM(e.EMP_CD) AS EMP_CD, RTRIM(e.EMP_NM) AS EMP_NM
     FROM EMP_TABLE e
     LEFT JOIN MS_DEP d ON e.DEP_CD = d.DEP_CD
     LEFT JOIN MS_SEC s ON e.SEC_CD = s.SEC_CD
     LEFT JOIN MS_JOBS j ON e.JOB_CD = j.JOB_CD
     LEFT JOIN MSJNS_KRY jk ON e.JNS_KRY = jk.JNS_CODE
     WHERE e.Act_NonAct = 1
       AND (e.EMP_CD LIKE '%a%' OR e.EMP_NM LIKE '%a%')`
  );

  await bench(
    'karyawan: status=tidak with DT_ENTRY check',
    `SELECT COUNT(*) as total FROM EMP_TABLE e WHERE e.Act_NonAct = 0`
  );

  await bench(
    'absensi: per employee per month',
    `SELECT CONVERT(varchar(10), a.DATE_TRANS, 120) AS DATE_TRANS,
            RTRIM(a.SHIFT) AS SHIFT, RTRIM(a.EMP_CD) AS EMP_CD,
            RTRIM(a.EMP_NM) AS EMP_NM, a.WORK_IN, a.WORK_OUT,
            a.JAM_KERJA, RTRIM(a.REASON) AS REASON, RTRIM(a.STATUS_HARI) AS STATUS_HARI
     FROM TR_ABSEN a
     LEFT JOIN Ms_Reason mr ON RTRIM(a.REASON) = RTRIM(mr.REASON_CODE)
     WHERE RTRIM(a.EMP_CD) = '26001001'
       AND MONTH(a.DATE_TRANS) = 7
       AND YEAR(a.DATE_TRANS) = 2026
     ORDER BY a.DATE_TRANS ASC`
  );

  await bench(
    'dashboard: today full join',
    `SELECT COUNT(*) FROM EMP_TABLE e
     LEFT JOIN TR_ABSEN a ON RTRIM(e.EMP_CD) = RTRIM(a.EMP_CD)
                          AND a.DATE_TRANS >= CONVERT(varchar(10), GETDATE(), 120)
                          AND a.DATE_TRANS < DATEADD(day, 1, CONVERT(varchar(10), GETDATE(), 120))
     LEFT JOIN MS_SEC s ON e.SEC_CD = s.SEC_CD
     LEFT JOIN MS_DEP d ON e.DEP_CD = d.DEP_CD
     WHERE e.Act_NonAct = 1`
  );

  await bench(
    'dashboard: trend 6mo GROUP',
    `SELECT MONTH(a.DATE_TRANS) as m, YEAR(a.DATE_TRANS) as y,
            RTRIM(a.STATUS_HARI) as STATUS_HARI, RTRIM(a.REASON) as REASON,
            COUNT(DISTINCT a.EMP_CD) as jumlah
     FROM TR_ABSEN a JOIN EMP_TABLE e ON a.EMP_CD = e.EMP_CD
     WHERE a.DATE_TRANS >= DATEADD(month, -5, DATEADD(day, 1-DAY(GETDATE()), GETDATE()))
     GROUP BY MONTH(a.DATE_TRANS), YEAR(a.DATE_TRANS), RTRIM(a.STATUS_HARI), RTRIM(a.REASON)`
  );

  console.log('\n=== DONE ===');
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => process.exit(0));
