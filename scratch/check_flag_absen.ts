import { query } from '../lib/db';

async function main() {
  try {
    const flags = await query<any>('SELECT DISTINCT FLAG_ABSEN, COUNT(*) as cnt FROM TR_ABSEN GROUP BY FLAG_ABSEN');
    console.log('DISTINCT FLAG_ABSEN in TR_ABSEN:', flags);

    const checkDiff = await query<any>(`
      SELECT TOP 5 
        EMP_CD, 
        CONVERT(varchar(10), DATE_TRANS, 120) as DATE_TRANS, 
        CONVERT(varchar(19), WORK_IN, 120) as WORK_IN, 
        CONVERT(varchar(19), WORK_IN1, 120) as WORK_IN1, 
        FLAG_ABSEN, 
        REASON 
      FROM TR_ABSEN 
      WHERE WORK_IN != WORK_IN1
    `);
    console.log('Sample rows where WORK_IN != WORK_IN1:', checkDiff);

    const checkReason = await query<any>(`
      SELECT TOP 5 
        EMP_CD, 
        CONVERT(varchar(10), DATE_TRANS, 120) as DATE_TRANS, 
        FLAG_ABSEN, 
        REASON 
      FROM TR_ABSEN 
      WHERE REASON IS NOT NULL AND REASON != ''
    `);
    console.log('Sample rows with REASON:', checkReason);

    const pmsStrings = await query<any>(`
      SELECT TOP 10 
        EMP_CD, 
        CONVERT(varchar(10), DATE_TRANS, 120) as DATE_TRANS, 
        FLAG_ABSEN 
      FROM TR_ABSEN 
      WHERE FLAG_ABSEN IS NOT NULL
    `);
    console.log('Sample rows:', pmsStrings);
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

main();
