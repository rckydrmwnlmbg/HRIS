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

async function dumpMasters() {
  const { getDbConnection } = await import('../lib/db');
  const pool = await getDbConnection();

  console.log('--- MS_DEP ---');
  const deps = await pool.request().query('SELECT * FROM MS_DEP');
  console.log(deps.recordset);

  console.log('--- MSJNS_KRY ---');
  const jns = await pool.request().query('SELECT * FROM MSJNS_KRY');
  console.log(jns.recordset);

  console.log('--- Ms_Reason ---');
  const reasons = await pool.request().query('SELECT * FROM Ms_Reason ORDER BY REASON_CODE');
  console.log(reasons.recordset);

  console.log('--- MS_JOBS (sample top 15) ---');
  const jobs = await pool.request().query('SELECT TOP 15 * FROM MS_JOBS');
  console.log(jobs.recordset);

  console.log('--- MS_SEC (sample top 20) ---');
  const secs = await pool.request().query('SELECT TOP 20 * FROM MS_SEC');
  console.log(secs.recordset);

  console.log('--- Ms_WorkTime / msSHIFT ---');
  try {
    const wt = await pool.request().query('SELECT TOP 10 * FROM Ms_WorkTime');
    console.log('Ms_WorkTime:', wt.recordset);
  } catch (e: any) { console.log('Ms_WorkTime err:', e.message); }

  try {
    const sh = await pool.request().query('SELECT TOP 10 * FROM msSHIFT');
    console.log('msSHIFT:', sh.recordset);
  } catch (e: any) { console.log('msSHIFT err:', e.message); }
}

dumpMasters().then(() => process.exit(0)).catch(e => {
  console.error(e);
  process.exit(1);
});
