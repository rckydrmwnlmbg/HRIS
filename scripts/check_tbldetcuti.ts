import { query } from '../lib/db';

async function checkTbldetcuti() {
  const cols = await query<any>(`
    SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'tbldetcuti'
  `);
  console.log('Kolom tbldetcuti:');
  console.table(cols);

  const tblCutiCount = await query<any>(`SELECT COUNT(*) AS CNT_TBLCUTI FROM tblCUTI`);
  console.log('Jumlah di tblCUTI:');
  console.table(tblCutiCount);

  const detCutiCount = await query<any>(`SELECT COUNT(*) AS CNT_TBLDETCUTI FROM tbldetcuti`);
  console.log('Jumlah di tbldetcuti:');
  console.table(detCutiCount);

  const sampleCuti = await query<any>(`SELECT TOP 5 * FROM tblCUTI ORDER BY AWAL_CUTI DESC`);
  console.log('Sample tblCUTI:');
  console.table(sampleCuti);
}

checkTbldetcuti().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
