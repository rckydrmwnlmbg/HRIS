import { query } from '../lib/db';

async function testLibDbWithAppUser() {
  console.log('--- Test Query via lib/db.ts ---');
  const userCheck = await query<any>(`
    SELECT SUSER_SNAME() AS SYSTEM_USER_NAME, USER_NAME() AS DB_USER_NAME
  `);
  console.table(userCheck);

  // Test UPDATE WORK_IN (Allowed)
  console.log('--- Test UPDATE Allowed Column ---');
  try {
    await query(`
      UPDATE TR_ABSEN 
      SET JAM_KERJA = JAM_KERJA 
      WHERE EMP_CD = '26066995' AND DATE_TRANS = '2026-07-01'
    `);
    console.log('✅ Update JAM_KERJA berhasil!');
  } catch (err: any) {
    console.error('❌ Gagal:', err.message);
  }

  // Test UPDATE OT_1 (Should be DENIED if logged in as hris_widy_app)
  console.log('--- Test UPDATE Blocked Column (OT_1) ---');
  try {
    await query(`
      UPDATE TR_ABSEN 
      SET OT_1 = 1 
      WHERE EMP_CD = '26066995' AND DATE_TRANS = '2026-07-01'
    `);
    console.log('⚠️ PERINGATAN: Update OT_1 berhasil (User saat ini memiliki izin admin/sa/dbo).');
  } catch (err: any) {
    console.log('🛡️ BERHASIL DIBLOKIR oleh SQL Server DENY rule:', err.message);
  }
}

testLibDbWithAppUser().then(() => process.exit(0)).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
