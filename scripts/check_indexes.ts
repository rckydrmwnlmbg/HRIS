import { query } from '../lib/db';

async function checkIndexes() {
  const indexes = await query<any>(`
    SELECT 
      i.name AS INDEX_NAME,
      i.type_desc AS INDEX_TYPE,
      is_unique,
      is_primary_key,
      STRING_AGG(c.name, ', ') WITHIN GROUP (ORDER BY ic.key_ordinal) AS COLUMNS
    FROM sys.indexes i
    JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
    JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
    WHERE i.object_id = OBJECT_ID('TR_ABSEN')
    GROUP BY i.name, i.type_desc, is_unique, is_primary_key
  `);
  console.table(indexes);
}

checkIndexes().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
