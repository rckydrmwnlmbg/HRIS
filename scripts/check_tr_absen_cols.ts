import { query } from '../lib/db';

async function checkTrAbsenColumns() {
  const cols = await query<any>(`
    SELECT 
      COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'TR_ABSEN'
    ORDER BY ORDINAL_POSITION
  `);
  console.table(cols);
}

checkTrAbsenColumns().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
