import { query } from '../lib/db';
import { loadEnvConfig } from '@next/env';
import fs from 'fs';

loadEnvConfig(process.cwd());
process.env.DATA_MODE = 'live';

async function run() {
  try {
    const result = await query(`SELECT TOP 1 * FROM TR_ABSEN`);
    fs.writeFileSync('scratch/cols.json', JSON.stringify(result[0], null, 2));
    console.log("Done");
  } catch(e) {
    console.error(e);
  }
  process.exit(0);
}
run();
