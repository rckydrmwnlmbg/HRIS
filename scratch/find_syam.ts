import { query } from '../lib/db';

async function findName() {
  const emp = await query<any>(`
    SELECT TOP 10
      RTRIM(e.EMP_CD) AS EMP_CD,
      RTRIM(e.EMP_NM) AS EMP_NM,
      RTRIM(e.SEC_CD) AS SEC_CD,
      RTRIM(s.SEC_DESC) AS SEC_DESC,
      RTRIM(j.JOB_DESC) AS JOB_DESC,
      e.ALL_IN
    FROM EMP_TABLE e
    LEFT JOIN MS_SEC s ON RTRIM(e.SEC_CD) = RTRIM(s.SEC_CD)
    LEFT JOIN MS_JOBS j ON RTRIM(e.JOB_CD) = RTRIM(j.JOB_CD)
    WHERE e.EMP_NM LIKE '%SYAM%' OR e.EMP_NM LIKE '%SIAM%' OR e.EMP_NM LIKE '%SYAMS%'
  `);
  console.table(emp);
}

findName().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
