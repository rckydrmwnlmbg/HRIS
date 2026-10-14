# Panduan Lengkap Penggunaan Data Dummy Supabase HRIS

Dokumen ini menjelaskan struktur data dummy yang telah disiapkan di proyek ini, bagaimana sistem memprosesnya, serta langkah-langkah praktis untuk mengimpor dan menggunakannya pada aplikasi HRIS Next.js.

---

## 1. Arsitektur & Struktur Data Dummy

Proyek ini telah dilengkapi dengan infrastruktur data dummy realistis berbasis PostgreSQL / Supabase yang kompatibel penuh dengan aplikasi HRIS:

- **`supabase_schema.sql`**:
  - DDL PostgreSQL untuk membuat semua tabel: `EMP_TABLE`, `MS_DEP`, `MS_SEC`, `MS_DIV`, `MS_JOBS`, `MSJNS_KRY`, `Ms_Reason`, `msSHIFT`, `MS_LIBUR_KERJA`, `TR_ABSEN`, `tblCUTI`, `tbldetcuti`, `TR_LEMBUR_ALLIN`, dan `TR_SPL_PLAN`.
  - Fungsi kompatibilitas T-SQL ke PostgreSQL (`ISNULL`, `GETDATE`, `YEAR`, `MONTH`, `DATEDIFF`).
  - Indeks database untuk performa tinggi pada kolom `DATE_TRANS`, `EMP_CD`, `SEC_CD`, dll.

- **`supabase_seed.sql` & `scripts/seed_supabase.ts`**:
  - **500 Karyawan Realistis** (`EMP_TABLE`):
    - ID Karyawan: `26010001` – `26010500`.
    - 60 Karyawan Manajerial / All-In (SPV Lini, Chief QA, Staff HRD, IT, Accounting, PPIC, Factory Manager, HR Manager).
    - 430 Karyawan Harian / Operator (Sewing Line 1-10, Cutting, Finishing, Packing, QC, Mekanik, Gudang, Security, Driver, Cleaning Service).
    - 10 Karyawan Berstatus Resign (`Act_NonAct = false`).
    - Dilengkapi NIK KTP, NPWP, PTKP, nomor rekening bank (BCA, Mandiri, BNI), SPSI, dan gaji pokok.
  - **Master Data**:
    - 9 Departemen (`MS_DEP`) & 24 Seksi/Line (`MS_SEC`).
    - 23 Jabatan (`MS_JOBS`).
    - Kalender Hari Libur Nasional 2026 (`MS_LIBUR_KERJA`).
    - Alasan ketidakhadiran resmi (`Ms_Reason`).
  - **6 Bulan Presensi Realistis** (`TR_ABSEN`):
    - Periode data: **1 Mei 2026 s/d 7 Oktober 2026**.
    - Total: **79.000+ baris transaksi presensi** lengkap dengan jam masuk, jam pulang, jam kerja, keterlambatan, dan lembur (OT_1, OT_2).
  - **Cuti & Lembur All-In**:
    - Histori cuti dan izin di `tblCUTI` dan `tbldetcuti`.
    - Histori lembur flat di `TR_LEMBUR_ALLIN`.

---

## 2. Cara Import Data ke Supabase

### Tahap 1: Buat Tabel & Fungsi (Skema)
1. Buka dashboard proyek Anda di [Supabase Dashboard](https://supabase.com/dashboard).
2. Masuk ke menu **SQL Editor**.
3. Buat query baru dan salin seluruh isi file `supabase_schema.sql`.
4. Klik tombol **Run**.

### Tahap 2: Injeksi Data Dummy (Seeding)

#### Opsi A — Melalui Skrip Seeder CLI (Direkomendasikan)
Skrip `scripts/seed_supabase.ts` memasukkan data secara bertahap (batch per 100 baris) dengan progress bar otomatis:
1. Dapatkan connection string Supabase dari *Project Settings > Database > Connection string > URI*.
2. Jalankan perintah di terminal:
   ```bash
   DATABASE_URL="postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres" npx tsx scripts/seed_supabase.ts
   ```
3. Tunggu hingga progress bar presensi mencapai 100%.

#### Opsi B — Melalui File SQL Dump
Anda juga dapat mengeksekusi dump SQL `supabase_seed.sql` langsung menggunakan `psql`:
```bash
psql "postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres" -f supabase_seed.sql
```

---

## 3. Konfigurasi Aplikasi HRIS (Next.js)

Agar aplikasi membaca data dummy dari Supabase:

1. Buat file `.env.local` di root folder proyek:
   ```env
   # Koneksi PostgreSQL / Supabase
   DATABASE_URL="postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres"

   # Wajib diatur 'live' agar koneksi database aktif
   DATA_MODE="live"

   # Mode tipe database
   DB_TYPE="postgres"
   ```

2. Jalankan aplikasi:
   ```bash
   npm run dev
   ```

3. Buka browser di [http://localhost:3000](http://localhost:3000).

---

## 4. Eksplorasi Fitur HRIS dengan Data Dummy

| Halaman | URL | Fitur yang Dapat Diuji |
| :--- | :--- | :--- |
| **Data Karyawan** | `/karyawan` | 500 karyawan, filter departemen/seksi, status tetap/kontrak/resign. |
| **Detail Profil Karyawan** | `/karyawan/[id]` | Cek profil lengkap karyawan (contoh: ID `26010001` atau `26010050`), rincian gaji, rekening, dan presensi. |
| **Tabel Presensi Bulanan** | `/absensi` | Navigasi tabel Excel-style untuk periode Mei – Oktober 2026, koreksi presensi, dan rekap lembur. |
| **Pengajuan Cuti & Izin** | `/cuti` | Histori cuti tahunan, izin resmi, dan sakit surat dokter. |
| **Laporan & Overtime** | `/laporan` | Kalkulasi biaya lembur, breakdown per departemen, dan rekapitulasi jam kerja. |
| **AI Assistant** | `/` (Chat Widget) | Tanya jawab interaktif seputar status kehadiran dan database karyawan. |

---

## 5. Tips & Penyesuaian

- **Filter Tanggal Presensi**: Karena transaksi presensi di generate dari **1 Mei 2026 hingga 7 Oktober 2026**, untuk melihat rekap kehadiran di modul presensi, gunakan filter bulan dalam rentang tersebut.
- **Memperbarui Tanggal Akhir Seeder**: Jika ingin menambahkan data kehadiran hingga tanggal hari ini, Anda dapat mengubah konstanta `END_DATE` di `scripts/seed_supabase.ts` lalu menjalankan ulang skrip seeder.
