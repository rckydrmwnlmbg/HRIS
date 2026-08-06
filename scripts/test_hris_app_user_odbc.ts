import sql from 'mssql/msnodesqlv8';

async function testHrisAppUserOdbc() {
  const cs = `Driver={ODBC Driver 18 for SQL Server};Server=localhost\\SQLEXPRESS;Database=PayrollSys;UID=hris_widy_app;PWD=HrisWidyApp@2026!Secure;TrustServerCertificate=yes;`;

  console.log('--- Menguji Koneksi sebagai hris_widy_app via ODBC ---');
  const pool = await sql.connect(cs);
  console.log('✅ Berhasil connect ke SQL Server menggunakan user [hris_widy_app]!');

  // Test 1: SELECT TR_ABSEN (Harus Berhasil)
  console.log('\n--- Test 1: SELECT TR_ABSEN ---');
  const selRes = await pool.request().query('SELECT TOP 1 EMP_CD, DATE_TRANS, WORK_IN, OT_1 FROM TR_ABSEN');
  console.log('✅ SELECT berhasil. Sample:', selRes.recordset[0]);

  // Test 2: UPDATE WORK_IN (Harus Berhasil)
  console.log('\n--- Test 2: UPDATE WORK_IN & JAM_KERJA (Kolom yang Diizinkan) ---');
  try {
    await pool.request().query(`
      UPDATE TR_ABSEN 
      SET JAM_KERJA = JAM_KERJA 
      WHERE EMP_CD = '26066995' AND DATE_TRANS = '2026-07-01'
    `);
    console.log('✅ UPDATE JAM_KERJA berhasil diizinkan.');
  } catch (err: any) {
    console.error('❌ Gagal update kolom yang diizinkan:', err.message);
  }

  // Test 3: UPDATE OT_1 / T_OT (Harus DITOLAK / DENIED oleh SQL Server)
  console.log('\n--- Test 3: UPDATE OT_1 (Harus DITOLAK oleh SQL Server) ---');
  try {
    await pool.request().query(`
      UPDATE TR_ABSEN 
      SET OT_1 = 1 
      WHERE EMP_CD = '26066995' AND DATE_TRANS = '2026-07-01'
    `);
    console.log('❌ BAHAYA: UPDATE OT_1 berhasil (seharusnya ditolak)!');
  } catch (err: any) {
    console.log('🛡️ BERHASIL DIBLOKIR: SQL Server menolak update ke OT_1:', err.message);
  }

  await pool.close();
}

testHrisAppUserOdbc().then(() => process.exit(0)).catch(err => {
  console.error('Test gagal:', err);
  process.exit(1);
});
