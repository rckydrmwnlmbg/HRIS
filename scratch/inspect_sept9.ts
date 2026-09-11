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

async function main() {
  const { query } = await import('../lib/db');
  
  // Find employee with Jam Masuk around 06:56:20 on 2026-09-09
  const rows = await query<any>(`
    SELECT 
      RTRIM(a.EMP_CD) as EMP_CD,
      e.EMP_NM,
      e.FLAG_OT,
      e.ALL_IN,
      e.SEC_CD,
      e.JOB_CD,
      CONVERT(varchar(10), a.DATE_TRANS, 120) as dateStr,
      CONVERT(varchar(19), a.WORK_IN, 120) as WORK_IN,
      CONVERT(varchar(19), a.WORK_OUT, 120) as WORK_OUT,
      CONVERT(varchar(19), a.JAM_MASUK, 120) as JAM_MASUK,
      CONVERT(varchar(19), a.JAM_PULANG, 120) as JAM_PULANG,
      a.JAM_KERJA,
      a.STATUS_HARI,
      a.SHIFT,
      a.REASON,
      a.OT_1,
      a.OT_2,
      a.OT_3,
      a.OT_4,
      a.T_OT,
      a.OT_ACC,
      a.SPL,
      a.FLAG_OT as ABSEN_FLAG_OT
    FROM TR_ABSEN a WITH (NOLOCK)
    LEFT JOIN EMP_TABLE e ON RTRIM(a.EMP_CD) = RTRIM(e.EMP_CD)
    WHERE a.DATE_TRANS = '2026-09-09'
      AND CONVERT(varchar(8), a.WORK_IN, 108) LIKE '06:56%'
  `);

  console.log('Result for 2026-09-09 06:56:');
  console.log(JSON.stringify(rows, null, 2));

  if (rows.length > 0) {
    const empCd = rows[0].EMP_CD;
    console.log('\nAll September records for', empCd, rows[0].EMP_NM);
    const allSept = await query<any>(`
      SELECT 
        CONVERT(varchar(10), a.DATE_TRANS, 120) as dateStr,
        CONVERT(varchar(8), a.WORK_IN, 108) as win,
        CONVERT(varchar(8), a.WORK_OUT, 108) as wout,
        a.SHIFT,
        a.STATUS_HARI,
        a.REASON,
        a.SPL,
        a.OT_ACC,
        a.OT_1,
        a.OT_2,
        a.OT_3,
        a.OT_4,
        a.T_OT,
        a.FLAG_OT
      FROM TR_ABSEN a WITH (NOLOCK)
      WHERE a.EMP_CD = '${empCd}'
        AND a.DATE_TRANS >= '2026-09-01' AND a.DATE_TRANS <= '2026-09-10'
      ORDER BY a.DATE_TRANS
    `);
    console.table(allSept);
  }

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
