import { query } from '../lib/db';
import { loadEnvConfig } from '@next/env';

loadEnvConfig(process.cwd());
process.env.DATA_MODE = 'live';

async function run() {
  const result = await query(`
    SELECT EMP_CD, DATE_TRANS, WORK_IN, WORK_OUT, WORK_IN1, WORK_OUT1, JAM_KERJA, T_OT 
    FROM TR_ABSEN 
    WHERE EMP_CD IN ('25076179', '25035303', '25015292', '24094728') 
    AND DATE_TRANS = '2026-08-10'
  `);
  console.log(result);
}
run();
