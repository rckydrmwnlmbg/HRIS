import { query } from './lib/db';

async function run() {
  console.log("Checking future TR_ABSEN records...");
  const data = await query(`
    SELECT TOP 20 EMP_CD, DATE_TRANS, WORK_IN, WORK_OUT, STATUS_HARI, REASON 
    FROM TR_ABSEN 
    WHERE DATE_TRANS >= '2026-08-10' 
    ORDER BY DATE_TRANS ASC
  `);
  console.log(data);
  process.exit(0);
}

run().catch(console.error);
