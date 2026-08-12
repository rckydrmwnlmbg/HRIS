import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());
process.env.DATA_MODE = 'live';

const { query } = require('./lib/db.ts');

async function analyzeInusLogic() {
  console.log('--- Analisis Perilaku INUS Terhadap Koreksi Manual ---');
  
  try {
    // Cari data di mana WORK_IN atau WORK_OUT berbeda dengan WORK_IN1 atau WORK_OUT1
    const manualEdits = await query(`
      SELECT TOP 20
        EMP_CD, 
        DATE_TRANS, 
        CONVERT(varchar(19), WORK_IN, 120) as EDIT_IN, 
        CONVERT(varchar(19), WORK_IN1, 120) as RAW_IN, 
        CONVERT(varchar(19), WORK_OUT, 120) as EDIT_OUT, 
        CONVERT(varchar(19), WORK_OUT1, 120) as RAW_OUT,
        FLAG_ABSEN,
        STATUS_HARI
      FROM TR_ABSEN
      WHERE DATE_TRANS >= '2024-01-01' 
        AND (
          (WORK_IN IS NOT NULL AND WORK_IN1 IS NOT NULL AND WORK_IN <> WORK_IN1)
          OR 
          (WORK_OUT IS NOT NULL AND WORK_OUT1 IS NOT NULL AND WORK_OUT <> WORK_OUT1)
        )
      ORDER BY DATE_TRANS DESC
    `);
    
    console.log(`Menemukan ${manualEdits.length} sampel data yang pernah dikoreksi secara manual.`);
    console.log(JSON.stringify(manualEdits, null, 2));

    // Cek macam-macam nilai FLAG_ABSEN
    const flagAbsenDist = await query(`
      SELECT FLAG_ABSEN, COUNT(*) as JUMLAH
      FROM TR_ABSEN
      WHERE DATE_TRANS >= '2024-01-01'
      GROUP BY FLAG_ABSEN
    `);
    
    console.log('\\nDistribusi FLAG_ABSEN di database:');
    console.log(JSON.stringify(flagAbsenDist, null, 2));
    
  } catch (err) {
    console.error(err);
  }
  process.exit(0);
}

analyzeInusLogic();
