import { query } from '../lib/db';

async function checkAuthMode() {
  const mode = await query<any>(`
    SELECT SERVERPROPERTY('IsIntegratedSecurityOnly') AS IsIntegratedSecurityOnly
  `);
  console.log('IsIntegratedSecurityOnly (1 = Windows Auth Only, 0 = Mixed Mode):');
  console.table(mode);
}

checkAuthMode().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
