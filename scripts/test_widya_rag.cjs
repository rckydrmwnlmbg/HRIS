const sql = require('mssql/msnodesqlv8');

const config = {
  connectionString: 'Driver={ODBC Driver 17 for SQL Server};Server=.\\SQLEXPRESS;Database=PayrollSys;Trusted_Connection=yes;',
  driver: 'msnodesqlv8'
};

async function testRAG(userQuery) {
  const pool = await new sql.ConnectionPool(config).connect();

  console.log('Query:', userQuery);
  // Extract potential full name phrases or keywords
  const cleanTokens = userQuery.replace(/[^a-zA-Z0-9\s]/g, ' ').split(/\s+/).filter(t => t.length >= 3);
  const stopWords = ['siapa', 'berapa', 'tampilkan', 'daftar', 'karyawan', 'bulan', 'hari', 'ini', 'yang', 'pada', 'total', 'data', 'rekap', 'gaji', 'juni', '2026', 'tolong'];
  const nameKeywords = cleanTokens.filter(t => !stopWords.includes(t.toLowerCase()));

  console.log('Name keywords:', nameKeywords);

  let filter = '';
  if (nameKeywords.length >= 2) {
    // Try combination first: "WIDYA" AND "ETIKA"
    const comb = nameKeywords.map(k => `e.EMP_NM LIKE '%${k}%'`).join(' AND ');
    filter = `(${comb}) OR (${nameKeywords.map(k => `e.EMP_NM LIKE '%${k}%' OR e.EMP_CD LIKE '%${k}%'`).join(' OR ')})`;
  } else if (nameKeywords.length === 1) {
    filter = `e.EMP_NM LIKE '%${nameKeywords[0]}%' OR e.EMP_CD LIKE '%${nameKeywords[0]}%'`;
  }

  const emps = await pool.request().query(`
    SELECT TOP 5 
      RTRIM(e.EMP_CD) as EMP_CD, 
      RTRIM(e.EMP_NM) as EMP_NM, 
      RTRIM(s.SEC_DESC) as SEC_DESC,
      RTRIM(j.JOB_DESC) as JOB_DESC,
      e.BS_SLR,
      CASE WHEN RTRIM(e.ALL_IN) = '1' OR RTRIM(e.ALL_IN) = 'Y' THEN 'ALL IN (Staf/Tunjangan Tetap)' ELSE 'HARIAN (Lembur Jam)' END as KATEGORI_LEMBUR,
      CASE WHEN RTRIM(e.JNS_KRY) = '100' THEN 'Tetap (PKWTT)' WHEN RTRIM(e.JNS_KRY) = '101' THEN 'Kontrak (PKWT)' ELSE 'Training' END as STATUS_KERJA,
      e.Act_NonAct, 
      e.DT_RSG,
      e.DT_ENTRY,
      ISNULL(e.T1, 0) as T1_JABATAN,
      ISNULL(e.T3, 0) as T3_PRESTASI,
      ISNULL(e.T5, 0) as T5_LEMBUR_ALLIN
    FROM EMP_TABLE e
    LEFT JOIN MS_SEC s ON RTRIM(e.SEC_CD) = RTRIM(s.SEC_CD)
    LEFT JOIN MS_JOBS j ON RTRIM(e.JOB_CD) = RTRIM(j.JOB_CD)
    WHERE ${filter}
    ORDER BY 
      CASE WHEN e.Act_NonAct = 1 AND (e.DT_RSG IS NULL OR e.DT_RSG >= GETDATE()) THEN 0 ELSE 1 END,
      e.DT_ENTRY DESC
  `);

  console.log('Result Candidates:');
  console.log(JSON.stringify(emps.recordset, null, 2));

  process.exit(0);
}

testRAG('Berapa gaji karyawan Widya Etika dibulan Juni ?');
