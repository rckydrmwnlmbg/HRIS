import { query } from '../lib/db';
import { loadEnvConfig } from '@next/env';
import fs from 'fs';

loadEnvConfig(process.cwd());
process.env.DATA_MODE = 'live';

async function run() {
  try {
    const result = await query(`
      SELECT DATE_TRANS, DATE_IN, DATE_OUT, WORK_IN, WORK_OUT, WORK_IN1, WORK_OUT1, JAM_MASUK, JAM_PULANG, JAM_KERJA
      FROM TR_ABSEN 
      WHERE DATE_TRANS = '2026-08-10' AND EMP_CD = '25076179'
    `);
    fs.writeFileSync('scratch/aug10_row.json', JSON.stringify(result, null, 2));
    
    const schema = await query(`
      SELECT COLUMN_NAME, DATA_TYPE 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'TR_ABSEN'
    `);
    fs.writeFileSync('scratch/schema.json', JSON.stringify(schema, null, 2));

    console.log("Done");
  } catch(e) {
    console.error(e);
  }
  process.exit(0);
}
run();
