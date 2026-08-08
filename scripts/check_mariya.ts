import { query } from '../lib/db';

async function check() {
  const q = `
    SELECT e.EMP_NM, a.DATE_TRANS, a.WORK_IN, a.WORK_OUT, a.JAM_KERJA, a.OT_1, a.OT_2
    FROM TR_ABSEN a
    JOIN EMP_TABLE e ON a.EMP_CD = e.EMP_CD
    WHERE e.EMP_NM LIKE '%MARIYA APRIYANTI%' AND a.DATE_TRANS = '2026-08-05'
  `;
  const data = await query(q);
  console.dir(data, { depth: null });
}

check();
