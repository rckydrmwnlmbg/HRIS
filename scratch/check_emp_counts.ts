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

async function checkCounts() {
  const { getDbConnection } = await import('../lib/db');
  const pool = await getDbConnection();

  const queries = [
    { label: 'Total Baris EMP_TABLE', sql: `SELECT COUNT(*) as c FROM EMP_TABLE` },
    { label: 'Act_NonAct = 1 (Semua)', sql: `SELECT COUNT(*) as c FROM EMP_TABLE WHERE Act_NonAct = 1` },
    { label: 'Act_NonAct = 0 (Semua)', sql: `SELECT COUNT(*) as c FROM EMP_TABLE WHERE Act_NonAct = 0` },
    { label: 'Act_NonAct = 1 AND DT_RSG IS NULL', sql: `SELECT COUNT(*) as c FROM EMP_TABLE WHERE Act_NonAct = 1 AND DT_RSG IS NULL` },
    { label: 'Act_NonAct = 1 AND (DT_RSG IS NULL OR DT_RSG >= GETDATE())', sql: `SELECT COUNT(*) as c FROM EMP_TABLE WHERE Act_NonAct = 1 AND (DT_RSG IS NULL OR DT_RSG >= GETDATE())` },
    { label: 'DT_RSG IS NULL (tanpa cek Act_NonAct)', sql: `SELECT COUNT(*) as c FROM EMP_TABLE WHERE DT_RSG IS NULL` },
    { label: 'DT_RSG IS NOT NULL', sql: `SELECT COUNT(*) as c FROM EMP_TABLE WHERE DT_RSG IS NOT NULL` },
    { label: 'Status per CMP_CD / Company_Code', sql: `SELECT ISNULL(Company_Code, 'NULL') as cmp, Act_NonAct, COUNT(*) as c FROM EMP_TABLE GROUP BY Company_Code, Act_NonAct` },
    { label: 'Karyawan dengan absensi di TR_ABSEN 2026', sql: `SELECT COUNT(DISTINCT a.EMP_CD) as c FROM TR_ABSEN a WHERE YEAR(a.DATE_TRANS) = 2026` },
    { label: 'Karyawan dengan absensi di TR_ABSEN Juli 2026', sql: `SELECT COUNT(DISTINCT a.EMP_CD) as c FROM TR_ABSEN a WHERE YEAR(a.DATE_TRANS) = 2026 AND MONTH(a.DATE_TRANS) = 7` },
    { label: 'Karyawan per JNS_KRY dengan Act_NonAct = 1 AND DT_RSG IS NULL', sql: `SELECT j.JNS_DESC, COUNT(*) as c FROM EMP_TABLE e LEFT JOIN MSJNS_KRY j ON e.JNS_KRY = j.JNS_CODE WHERE e.Act_NonAct = 1 AND e.DT_RSG IS NULL GROUP BY j.JNS_DESC` }
  ];

  for (const q of queries) {
    try {
      const res = await pool.request().query(q.sql);
      console.log(`\n=== ${q.label} ===`);
      console.table(res.recordset);
    } catch (e: any) {
      console.error(`Error in ${q.label}:`, e.message);
    }
  }
}

checkCounts().then(() => process.exit(0)).catch(e => {
  console.error(e);
  process.exit(1);
});
