import fs from 'fs';
import path from 'path';

process.env.NODE_ENV = 'development';

const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [key, ...vals] = trimmed.split('=');
    const val = vals.join('=').split('#')[0].trim();
    if (key && val) {
      process.env[key.trim()] = val;
    }
  }
}

async function testRealQueries() {
  const { getDbConnection } = await import('../lib/db');
  const pool = await getDbConnection();

  console.log('Testing Real Context Query...');
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

  const ctxQuery = `
    SELECT
      (SELECT COUNT(*) FROM TR_ABSEN WHERE CONVERT(varchar(10), DATE_TRANS, 120) = '${today}' AND WORK_IN IS NULL AND (REASON IS NULL OR REASON = '' OR REASON = '0')) AS alpha_today,
      (SELECT COUNT(*) FROM TR_ABSEN WHERE DATE_TRANS >= '${monthStart}' AND (ISNULL(OT_1,0) > 0 OR ISNULL(OT_2,0) > 0 OR ISNULL(OT_3,0) > 0 OR ISNULL(OT_4,0) > 0)) AS ot_month,
      (SELECT COUNT(*) FROM EMP_TABLE WHERE Act_NonAct = 1) AS total_active_emp
  `;
  const ctxRes = await pool.request().query(ctxQuery);
  console.log('Context Result:', ctxRes.recordset[0]);

  console.log('\nTesting Sample AI SQL: Top 5 Karyawan Aktif');
  const empQuery = `
    SELECT TOP 5 RTRIM(e.EMP_CD) AS EMP_CD, RTRIM(e.EMP_NM) AS EMP_NM, RTRIM(s.SEC_DESC) AS BAGIAN, RTRIM(d.DEP_DESC) AS DEPARTEMEN
    FROM EMP_TABLE e
    LEFT JOIN MS_SEC s ON RTRIM(e.SEC_CD) = RTRIM(s.SEC_CD)
    LEFT JOIN MS_DEP d ON RTRIM(e.DEP_CD) = RTRIM(d.DEP_CD)
    WHERE e.Act_NonAct = 1
    ORDER BY e.EMP_NM ASC
  `;
  const empRes = await pool.request().query(empQuery);
  console.table(empRes.recordset);

  console.log('\nTesting Sample AI SQL: Rekap Lembur Bulan Ini');
  const otQuery = `
    SELECT TOP 5 RTRIM(a.EMP_CD) AS EMP_CD, RTRIM(a.EMP_NM) AS EMP_NM, CONVERT(varchar(10), a.DATE_TRANS, 120) AS TANGGAL,
           ISNULL(a.OT_1,0) AS OT1, ISNULL(a.OT_2,0) AS OT2, ISNULL(a.T_OT,0) AS TOTAL_OT
    FROM TR_ABSEN a
    WHERE a.DATE_TRANS >= '${monthStart}' AND (ISNULL(a.OT_1,0) > 0 OR ISNULL(a.OT_2,0) > 0)
    ORDER BY a.DATE_TRANS DESC
  `;
  const otRes = await pool.request().query(otQuery);
  console.table(otRes.recordset);
}

testRealQueries().then(() => process.exit(0)).catch(e => {
  console.error(e);
  process.exit(1);
});
