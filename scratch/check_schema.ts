import { query } from '../lib/db';
import { loadEnvConfig } from '@next/env';

loadEnvConfig(process.cwd());
process.env.DATA_MODE = 'live';

async function run() {
  const result = await query(`
    SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'TR_ABSEN'
  `);
  console.log(JSON.stringify(result, null, 2));
}
run();
