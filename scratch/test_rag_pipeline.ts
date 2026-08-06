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

async function testRAG() {
  const { getDbConnection } = await import('../lib/db');
  const pool = await getDbConnection();

  const userQuery = "Siapa saja karyawan di bagian Cutting?";

  console.log('--- Testing Query-Aware Master RAG ---');
  // Match sections
  const secRes = await pool.request().query(`
    SELECT TOP 5 RTRIM(SEC_CD) as SEC_CD, RTRIM(SEC_DESC) as SEC_DESC
    FROM MS_SEC
    WHERE SEC_DESC LIKE '%Cutting%' OR SEC_DESC LIKE '%Sewing%'
  `);
  console.log('Matched Sections:', secRes.recordset);

  // Match reasons
  const reasonRes = await pool.request().query(`
    SELECT RTRIM(REASON_CODE) as REASON_CODE, RTRIM(REASON_DESC) as REASON_DESC, RTRIM(REASON_GROUP) as REASON_GROUP
    FROM Ms_Reason
  `);
  console.log('Reasons Count:', reasonRes.recordset.length);

  // Match live summary stats
  const statsRes = await pool.request().query(`
    SELECT
      (SELECT COUNT(*) FROM EMP_TABLE WHERE Act_NonAct = 1 AND (DT_RSG IS NULL OR DT_RSG >= GETDATE())) as total_aktif,
      (SELECT COUNT(*) FROM EMP_TABLE WHERE Act_NonAct = 1 AND (DT_RSG IS NULL OR DT_RSG >= GETDATE()) AND RTRIM(JNS_KRY) = '101') as total_kontrak,
      (SELECT COUNT(*) FROM EMP_TABLE WHERE Act_NonAct = 1 AND (DT_RSG IS NULL OR DT_RSG >= GETDATE()) AND RTRIM(JNS_KRY) = '100') as total_tetap,
      (SELECT COUNT(*) FROM EMP_TABLE WHERE Act_NonAct = 1 AND (DT_RSG IS NULL OR DT_RSG >= GETDATE()) AND RTRIM(SX) = 'L') as total_pria,
      (SELECT COUNT(*) FROM EMP_TABLE WHERE Act_NonAct = 1 AND (DT_RSG IS NULL OR DT_RSG >= GETDATE()) AND RTRIM(SX) = 'P') as total_wanita
  `);
  console.log('Live Active Employee Stats RAG:', statsRes.recordset[0]);
}

testRAG().then(() => process.exit(0)).catch(e => {
  console.error(e);
  process.exit(1);
});
