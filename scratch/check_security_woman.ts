import * as fs from 'fs';
import * as path from 'path';

const envContent = fs.readFileSync(path.join(__dirname, '../.env.local'), 'utf8');
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
    const idx = trimmed.indexOf('=');
    const key = trimmed.substring(0, idx).trim();
    const val = trimmed.substring(idx + 1).trim().replace(/^["']|["']$/g, '');
    process.env[key] = val;
  }
}
process.env.NODE_ENV = 'development';
process.env.DATA_MODE = 'live';
process.env.DB_ODBC_DRIVER = process.env.DB_ODBC_DRIVER || 'SQL Server';

async function main() {
  const { query } = await import('../lib/db');

  const rows = await query<any>(`
    SELECT 
      a.EMP_CD,
      a.EMP_NM,
      a.DATE_TRANS,
      a.SHIFT,
      a.STATUS_HARI,
      CONVERT(varchar(19), a.WORK_IN, 120) AS WORK_IN,
      CONVERT(varchar(19), a.WORK_OUT, 120) AS WORK_OUT,
      a.JAM_KERJA,
      a.OT_1,
      a.OT_2,
      a.OT_3,
      a.OT_4,
      a.T_OT,
      a.FLAG_ABSEN,
      j.JOB_DESC,
      s.SEC_DESC
    FROM TR_ABSEN a
    LEFT JOIN EMP_TABLE e ON RTRIM(a.EMP_CD) = RTRIM(e.EMP_CD)
    LEFT JOIN MS_JOBS j ON RTRIM(e.JOB_CD) = RTRIM(j.JOB_CD)
    LEFT JOIN MS_SEC s ON RTRIM(e.SEC_CD) = RTRIM(s.SEC_CD)
    WHERE CONVERT(varchar(10), a.DATE_TRANS, 120) = '2026-08-03'
      AND (a.SHIFT LIKE '%2S%' OR CONVERT(varchar(8), a.WORK_IN, 108) LIKE '11:21%')
  `);

  console.log('Query result:', JSON.stringify(rows, null, 2));
}

main().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
