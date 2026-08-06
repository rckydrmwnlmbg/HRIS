import { query } from '../lib/db';
import * as fs from 'fs';
import * as path from 'path';

async function setupAppUser() {
  console.log('--- 1. Menyiapkan Login & Hak Akses hris_widy_app ---');
  
  // 1. Create Login in Master
  await query(`
    IF NOT EXISTS (SELECT name FROM sys.sql_logins WHERE name = 'hris_widy_app')
    BEGIN
        CREATE LOGIN [hris_widy_app] WITH PASSWORD = N'HrisWidyApp@2026!Secure', 
        DEFAULT_DATABASE = [PayrollSys], 
        CHECK_EXPIRATION = OFF, 
        CHECK_POLICY = OFF;
    END
    ELSE
    BEGIN
        ALTER LOGIN [hris_widy_app] WITH PASSWORD = N'HrisWidyApp@2026!Secure';
    END
  `);

  // 2. Create User in PayrollSys
  await query(`
    IF NOT EXISTS (SELECT name FROM sys.database_principals WHERE name = 'hris_widy_app')
    BEGIN
        CREATE USER [hris_widy_app] FOR LOGIN [hris_widy_app];
        PRINT 'User [hris_widy_app] berhasil dibuat di PayrollSys.';
    END
  `);

  // 3. Grant Schema dbo SELECT
  await query(`GRANT SELECT ON SCHEMA::dbo TO [hris_widy_app];`);

  // 4. Create TR_AUDIT_ABSEN if not exists
  await query(`
    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'TR_AUDIT_ABSEN')
    BEGIN
        CREATE TABLE dbo.TR_AUDIT_ABSEN (
            AUDIT_ID INT IDENTITY(1,1) PRIMARY KEY,
            EMP_CD NVARCHAR(20) NOT NULL,
            DATE_TRANS DATETIME NOT NULL,
            ACTION_TYPE NVARCHAR(50) NOT NULL,
            OLD_VALUE NVARCHAR(MAX) NULL,
            NEW_VALUE NVARCHAR(MAX) NULL,
            REASON NVARCHAR(255) NULL,
            CREATED_BY NVARCHAR(100) DEFAULT SUSER_SNAME(),
            CREATED_AT DATETIME DEFAULT GETDATE()
        );
    END
  `);

  // 5. Grant Table Level Permissions
  await query(`GRANT INSERT, UPDATE, DELETE ON dbo.tblCUTI TO [hris_widy_app];`);
  await query(`GRANT INSERT, UPDATE, DELETE ON dbo.tbldetcuti TO [hris_widy_app];`);
  await query(`GRANT INSERT, UPDATE, DELETE ON dbo.EMP_TABLE TO [hris_widy_app];`);
  await query(`GRANT INSERT, UPDATE, DELETE ON dbo.TR_LEMBUR_ALLIN TO [hris_widy_app];`);
  await query(`GRANT INSERT, UPDATE, DELETE ON dbo.MS_LIBUR_KERJA TO [hris_widy_app];`);
  await query(`GRANT INSERT, SELECT ON dbo.TR_AUDIT_ABSEN TO [hris_widy_app];`);

  // 6. Grant TR_ABSEN Specific Permissions
  await query(`GRANT INSERT ON dbo.TR_ABSEN TO [hris_widy_app];`);
  await query(`GRANT UPDATE ON dbo.TR_ABSEN(WORK_IN, WORK_OUT, JAM_KERJA, STATUS_HARI, REASON, SHIFT, JAM_MASUK, JAM_PULANG, HADIR, FLAG_ABSEN, DATE_IN, DATE_OUT, WORK_IN1, WORK_OUT1) TO [hris_widy_app];`);
  await query(`DENY UPDATE ON dbo.TR_ABSEN(OT_1, OT_2, OT_3, OT_4, T_OT, STDJAM) TO [hris_widy_app];`);

  console.log('✅ User [hris_widy_app] dan pembatasan izin berhasil dibuat di SQL Server.');
}

setupAppUser().then(() => process.exit(0)).catch(err => {
  console.error('Error saat setup app user:', err);
  process.exit(1);
});
