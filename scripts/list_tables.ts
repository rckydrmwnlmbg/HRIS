import { query } from '../lib/db';

async function listTables() {
  const tables = await query<any>(`
    SELECT TABLE_NAME, TABLE_TYPE 
    FROM INFORMATION_SCHEMA.TABLES 
    ORDER BY TABLE_TYPE, TABLE_NAME
  `);
  console.log('Semua tabel di database:');
  console.table(tables);
}

listTables().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
