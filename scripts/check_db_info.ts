import { query } from '../lib/db';

async function checkDbInfo() {
  const info = await query<any>(`
    SELECT 
      @@SERVERNAME AS SERVER_NAME,
      DB_NAME() AS CURRENT_DATABASE,
      SUSER_SNAME() AS SYSTEM_USER_NAME,
      USER_NAME() AS DB_USER_NAME,
      @@VERSION AS SQL_VERSION
  `);
  console.table(info);
}

checkDbInfo().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
