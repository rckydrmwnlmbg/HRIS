import { query } from './lib/db';

async function analyze() {
  try {
    // 1. U_MAKAN Analysis
    console.log('--- U_MAKAN Analysis ---');
    const uMakanValues = await query(`
      SELECT DISTINCT U_MAKAN 
      FROM TR_ABSEN 
      WHERE DATE_TRANS >= '2024-01-01' AND U_MAKAN IS NOT NULL
    `);
    console.log('Distinct U_MAKAN amounts:', JSON.stringify(uMakanValues, null, 2));

    const uMakanExamples = await query(`
      SELECT TOP 5 EMP_CD, DATE_TRANS, WORK_IN, WORK_OUT, JAM_KERJA, STATUS_HARI, SHIFT, U_MAKAN
      FROM TR_ABSEN
      WHERE U_MAKAN > 0 
      ORDER BY DATE_TRANS DESC
    `);
    console.log('Example rows with U_MAKAN > 0:', JSON.stringify(uMakanExamples, null, 2));

    const noUMakanExamples = await query(`
      SELECT TOP 5 EMP_CD, DATE_TRANS, WORK_IN, WORK_OUT, JAM_KERJA, STATUS_HARI, SHIFT, U_MAKAN
      FROM TR_ABSEN
      WHERE (U_MAKAN = 0 OR U_MAKAN IS NULL) AND WORK_IN IS NOT NULL
      ORDER BY DATE_TRANS DESC
    `);
    console.log('Example rows with U_MAKAN = 0 but present:', JSON.stringify(noUMakanExamples, null, 2));

    // 2. Time_Late Analysis
    console.log('\\n--- Time_Late Analysis ---');
    const lateExamples = await query(`
      SELECT TOP 10 
        SHIFT, 
        CONVERT(varchar(5), WORK_IN, 108) as JamMasuk, 
        Time_Late 
      FROM TR_ABSEN 
      WHERE Time_Late > 0 AND DATE_TRANS >= '2024-01-01'
      ORDER BY DATE_TRANS DESC
    `);
    console.log('Example Late rows:', JSON.stringify(lateExamples, null, 2));

    // Get min time late for each shift
    const shiftStarts = await query(`
      SELECT 
        SHIFT, 
        MIN(CONVERT(varchar(5), DATEADD(MINUTE, -Time_Late, WORK_IN), 108)) as DeductedStartTime
      FROM TR_ABSEN
      WHERE Time_Late > 0 AND SHIFT IN ('1', '2S', '3S', '4S')
      GROUP BY SHIFT
    `);
    console.log('Deducted Shift Starts (WORK_IN - Time_Late):', JSON.stringify(shiftStarts, null, 2));

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

analyze();
