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

async function testSimulatedAiResponse() {
  const { getDbConnection } = await import('../lib/db');
  const pool = await getDbConnection();

  console.log('--- Simulating AI SQL Response Execution ---');
  const sampleAiResponse = `Berikut daftar 5 karyawan aktif terbaru:
\`\`\`sql
SELECT TOP 5 RTRIM(e.EMP_CD) AS EMP_CD, RTRIM(e.EMP_NM) AS EMP_NM, RTRIM(s.SEC_DESC) AS BAGIAN, CONVERT(varchar(10), e.DT_ENTRY, 120) AS TGL_MASUK
FROM EMP_TABLE e
LEFT JOIN MS_SEC s ON RTRIM(e.SEC_CD) = RTRIM(s.SEC_CD)
WHERE e.Act_NonAct = 1
ORDER BY e.DT_ENTRY DESC;
\`\`\``;

  // Extract SQL
  const match = sampleAiResponse.match(/```sql\s*([\s\S]*?)```/);
  let sql = match ? match[1].trim() : null;
  if (sql?.endsWith(';')) sql = sql.slice(0, -1).trim();

  console.log('Extracted SQL:', sql);

  if (sql) {
    const result = await pool.request().query(sql);
    const cleanedRows = (result.recordset || []).map((row: any) => {
      const cleaned: Record<string, any> = {};
      for (const [k, v] of Object.entries(row)) {
        if (typeof v === 'string') {
          cleaned[k] = v.trim();
        } else if (v instanceof Date) {
          cleaned[k] = v.toISOString().slice(0, 10);
        } else {
          cleaned[k] = v;
        }
      }
      return cleaned;
    });

    console.log('\nQuery Result Rows:');
    console.table(cleanedRows);

    const cleanText = sampleAiResponse.replace(/```sql[\s\S]*?```/g, '').trim();
    console.log('\nClean AI Text:', cleanText);
    console.log('Flow validation: SUCCESS!');
  }
}

testSimulatedAiResponse().then(() => process.exit(0)).catch(e => {
  console.error(e);
  process.exit(1);
});
