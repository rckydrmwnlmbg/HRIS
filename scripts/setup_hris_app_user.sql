-- ==============================================================================
-- SKRIP KEAMANAN DATABASE: PEMBUATAN USER 'hris_widy_app' & PEMBATASAN AKSES
-- Tujuan: Memberikan hak akses operasional web app, dan MEMBLOKIR (DENY)
--         perubahan terhadap kolom lembur (OT_1..OT_4, T_OT, STDJAM, IS1..IS3).
-- ==============================================================================

USE [master];
GO

-- 1. Buat Login SQL Server jika belum ada
IF NOT EXISTS (SELECT name FROM sys.server_logins WHERE name = 'hris_widy_app')
BEGIN
    CREATE LOGIN [hris_widy_app] WITH PASSWORD = N'HrisWidyApp@2026!Secure', 
    DEFAULT_DATABASE = [PayrollSys], 
    CHECK_EXPIRATION = OFF, 
    CHECK_POLICY = OFF;
    PRINT 'Login [hris_widy_app] berhasil dibuat di master.';
END
ELSE
BEGIN
    ALTER LOGIN [hris_widy_app] WITH PASSWORD = N'HrisWidyApp@2026!Secure';
    PRINT 'Login [hris_widy_app] diperbarui.';
END
GO

USE [PayrollSys];
GO

-- 2. Buat User Database di PayrollSys
IF NOT EXISTS (SELECT name FROM sys.database_principals WHERE name = 'hris_widy_app')
BEGIN
    CREATE USER [hris_widy_app] FOR LOGIN [hris_widy_app];
    PRINT 'User [hris_widy_app] berhasil dibuat di PayrollSys.';
END
GO

-- 3. Berikan Izin SELECT ke seluruh tabel di schema dbo
GRANT SELECT ON SCHEMA::dbo TO [hris_widy_app];

-- 4. Berikan Izin Operasional ke tabel-tabel pendukung
GRANT INSERT, UPDATE, DELETE ON dbo.tblCUTI TO [hris_widy_app];
GRANT INSERT, UPDATE, DELETE ON dbo.tbldetcuti TO [hris_widy_app];
GRANT INSERT, UPDATE, DELETE ON dbo.EMP_TABLE TO [hris_widy_app];
GRANT INSERT, UPDATE, DELETE ON dbo.TR_LEMBUR_ALLIN TO [hris_widy_app];
GRANT INSERT, UPDATE, DELETE ON dbo.MS_LIBUR_KERJA TO [hris_widy_app];

-- Buat tabel TR_AUDIT_ABSEN jika belum ada, lalu beri izin
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
    PRINT 'Tabel TR_AUDIT_ABSEN berhasil dibuat.';
END
GO

GRANT INSERT, SELECT ON dbo.TR_AUDIT_ABSEN TO [hris_widy_app];

-- 5. ATURAN AKSES TABEL TR_ABSEN
-- Berikan izin INSERT ke TR_ABSEN (untuk sync-finger membuat baris baru)
GRANT INSERT ON dbo.TR_ABSEN TO [hris_widy_app];

-- Berikan izin UPDATE HANYA pada kolom-kolom operasional yang diizinkan
GRANT UPDATE ON dbo.TR_ABSEN(WORK_IN, WORK_OUT, JAM_KERJA, STATUS_HARI, REASON, SHIFT, JAM_MASUK, JAM_PULANG, HADIR, FLAG_ABSEN, DATE_IN, DATE_OUT, WORK_IN1, WORK_OUT1) TO [hris_widy_app];

-- BLOKIR SECARA EKSPLISIT (DENY UPDATE) pada kolom-kolom lembur & standard jam
DENY UPDATE ON dbo.TR_ABSEN(OT_1, OT_2, OT_3, OT_4, T_OT, STDJAM) TO [hris_widy_app];

PRINT 'Hak akses keamanan khusus [hris_widy_app] berhasil dikonfigurasi 100%.';
GO
