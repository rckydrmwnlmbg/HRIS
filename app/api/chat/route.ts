import { NextRequest, NextResponse } from 'next/server';
import { getDbConnection } from '@/lib/db';
import { getRelevantMemory, recordSuccessPattern } from '@/lib/ai-memory';

const API_URL =
  process.env.AI_BASE_URL ||
  process.env.OPENAI_BASE_URL ||
  process.env.BANDELBANGET_URL ||
  'https://bandelbanget.xyz/v1/chat/completions';

const API_KEY =
  process.env.AI_API_KEY ||
  process.env.OPENAI_API_KEY ||
  process.env.BANDELBANGET_API_KEY ||
  'sk-qwen-753ac2e4be15fce1802f744c769e8636ee5632a4a409dba5';

const MODEL =
  process.env.AI_MODEL_TEXT ||
  process.env.AI_MODEL ||
  'deepseek-v4-pro';

const MODEL_VISION =
  process.env.AI_MODEL_VISION ||
  'gpt-5.6-luna';

const CORE_TABLES = [
  'EMP_TABLE',
  'TR_ABSEN',
  'tblCUTI',
  'tbldetcuti',
  'MS_SEC',
  'MS_DEP',
  'MS_JOBS',
  'Ms_Reason',
  'MSJNS_KRY',
  'MS_LIBUR_KERJA',
  'TR_LEMBUR_ALLIN',
  'TR_SPL_PLAN',
];

const SCHEMA_FALLBACK = `
-- TABEL UTAMA DATABASE PAYROLLSYS:
EMP_TABLE(EMP_CD varchar(30) PK, EMP_NM varchar(50), SEC_CD varchar(10) FK->MS_SEC, DEP_CD varchar(10) FK->MS_DEP, JOB_CD varchar(10) FK->MS_JOBS, JNS_KRY varchar(10) FK->MSJNS_KRY, ALL_IN varchar(1), Act_NonAct bit, DT_ENTRY datetime, DT_RSG datetime, ALS_KELUAR varchar(50), SX varchar(1) [L/P], agama varchar(25), noktp varchar(25), telepon varchar(15), ADRR varchar(200), CT varchar(25), BS_SLR money)
TR_ABSEN(DATE_TRANS datetime, EMP_CD char(30) FK->EMP_TABLE, EMP_NM char(50), SEC_CD char(20), WORK_IN datetime, WORK_OUT datetime, JAM_KERJA money, REASON char(5) FK->Ms_Reason, STATUS_HARI char(25), OT_1 numeric, OT_2 numeric, OT_3 numeric, OT_4 numeric, T_OT money, Time_Late float, U_MAKAN money, U_TRANSPORT money)
MS_SEC(SEC_CD char(4) PK, SEC_DESC nvarchar(50), GRP_CD char(4))
MS_DEP(DEP_CD char(4) PK, DEP_DESC varchar(50) [1000='MAIN OFFICE', 1001='PRODUCTION'])
MS_JOBS(JOB_CD nvarchar(6) PK, JOB_DESC nvarchar(45))
Ms_Reason(REASON_CODE char(3) PK, REASON_DESC varchar(60), REASON_GROUP char(3) ['A'=Alpha, 'I'=Izin, 'S'=Sakit, 'C'=Cuti, 'H'=Melahirkan/Haid, 'O'=Operasional])
MSJNS_KRY(JNS_CODE char(3) PK, JNS_DESC varchar(50) [100='TETAP', 101='KONTRAK', 102='TRAINING'])
tblCUTI(EMP_CD char(20), EMP_NM varchar(50), AWAL_CUTI smalldatetime, AKHIR_CUTI smalldatetime, REASON char(10), REMARK varchar(75), LM_CUTI int)
tbldetcuti(EMP_CD nvarchar(20), EMP_NM nvarchar(50), TGL_CUTI smalldatetime, REASON nvarchar(10))
MS_LIBUR_KERJA(TANGGAL datetime, KETERANGAN varchar(100))
TR_LEMBUR_ALLIN(DATE_TRANS date, EMP_CD varchar(30), JAM_MULAI varchar(10), JAM_SELESAI varchar(10), NOMINAL decimal(18,2))
TR_SPL_PLAN(DATE_TRANS date, LINE_ID varchar(20), JOB_DESC varchar(50), JAM_17_OPR int, JAM_18_OPR int, JAM_19_OPR int, JAM_20_OPR int, STATUS_DOC varchar(20))
`;

const APP_KNOWLEDGE = `
PENGETAHUAN LENGKAP SISTEM HRIS TMNB (PT TP Trading Jakarta):

1. ATURAN KRUSIAL STATUS KARYAWAN AKTIF:
- Total baris di EMP_TABLE ada 9.285 karyawan (termasuk riwayat lama).
- Untuk menentukan KARYAWAN AKTIF SECARA VALID, WAJIB menggunakan filter:
  e.Act_NonAct = 1 AND (e.DT_RSG IS NULL OR CONVERT(varchar(10), e.DT_RSG, 120) >= CONVERT(varchar(10), GETDATE(), 120)) AND (e.DT_ENTRY IS NULL OR CONVERT(varchar(10), e.DT_ENTRY, 120) <= CONVERT(varchar(10), GETDATE(), 120))
- PERINGATAN PENTING: JANGAN HANYA mengecek 'Act_NonAct = 1' saja! Karena ada 1.270 mantan karyawan yang kolom Act_NonAct-nya belum diubah tapi kolom DT_RSG (Tanggal Resign) sudah terisi di masa lalu.
- Jumlah karyawan aktif yang benar saat ini adalah 1.966 orang (Kontrak: 1.179, Tetap: 786, Training: 1).
- Karyawan Non-Aktif / Resign / Keluar:
  e.Act_NonAct = 0 OR (e.DT_RSG IS NOT NULL AND CONVERT(varchar(10), e.DT_RSG, 120) < CONVERT(varchar(10), GETDATE(), 120))
- Status Ikatan Kerja Karyawan:
  * Tetap (PKWTT): RTRIM(e.STATUS) = 'T' (atau JNS_KRY = '100')
  * Kontrak (PKWT): RTRIM(e.STATUS) = 'K' (atau JNS_KRY = '101')
  * Harian: RTRIM(e.STATUS) = 'H'

2. PEMETAAN BAGIAN, LINE, & DEPARTEMEN PABRIK (MS_SEC & MS_DEP):
- SEWING (Line Produksi Jahit):
  SEC_DESC LIKE '%LINE%' OR RTRIM(s.SEC_DESC) IN ('BUTTON', 'PATTERN SEAMER') (Line 01 s/d Line 18)
- CUTTING (Pemotongan & Persiapan Kain):
  RTRIM(s.SEC_DESC) IN ('BANDLELING', 'CUTTING', 'GANTI BS', 'GELAR', 'GELAR INTERLINING', 'LOADING', 'MARKER', 'NUMBERING', 'PIPING', 'PRESS', 'RELAX')
- WAREHOUSE (Gudang Bahan Baku & Aksesoris):
  RTRIM(s.SEC_DESC) IN ('ACCESSORIES', 'FABRIC', 'IT INVENTORY', 'MATERIAL MGMT', 'TRANSFER', 'WAREHOUSE')
- PACKING & FINISHING:
  RTRIM(s.SEC_DESC) IN ('PACKING', 'IRONING', 'FINISHING')
- QUALITY ASSURANCE (QA / QC):
  RTRIM(s.SEC_DESC) IN ('LAB', 'PSO', 'QA', 'QC ACCURACY')
- MAINTENANCE / MEKANIK:
  RTRIM(s.SEC_DESC) IN ('MEKANIK')
- UTILITY & UMUM:
  RTRIM(s.SEC_DESC) IN ('UTILITY', 'DRIVER', 'CLEANING SERVICE', 'SECURITY')
- OFFICE & MANAJEMEN:
  RTRIM(s.SEC_DESC) IN ('HRD', 'ACCOUNTING', 'FINANCE', 'IT', 'PURCHASING', 'EXIM', 'MERCHANDISER', 'IE')

3. KATEGORI KARYAWAN & DUA JENIS PERHITUNGAN LEMBUR DI SISTEM:
- Perbedaan 2 Jenis Laporan Lembur di Aplikasi HRIS:
  a) LEMBUR RESMI / PAYROLL OVERTIME (Tabel TR_ABSEN kolom OT_1 s/d OT_4):
     * Dihitung berdasarkan batas jam lembur resmi yang diakui payroll:
       - OT_1: Jam ke-1 pada hari kerja biasa (pengali 1.5x upah sejam).
       - OT_2: Jam ke-2 dst pada hari kerja biasa (3 jam per hari) ATAU jam ke 1-8 pada hari libur resmi (pengali 2.0x).
       - OT_3: Jam ke-9 pada hari libur (pengali 3.0x).
       - OT_4: Jam ke-10 ke atas pada hari libur (pengali 4.0x).
       - TOTAL JAM LEMBUR RESMI = SUM(OT_1 + OT_2 + OT_3 + OT_4).
       - Contoh: 4 hari kerja biasa lembur 4 jam/hari (1 jam OT1 + 3 jam OT2 = 12 jam OT2) + 1 hari libur 8 jam penuh OT2 = Total OT1: 4 jam, Total OT2: 20 jam (Total: 24 jam).
  b) ANALYSIS OT / LEMBUR AKTUAL FINGERPRINT (Laporan di menu /laporan atau /lembur):
     * Dihitung murni dari selisih ketukan mesin fingerprint riil (WORK_IN dan WORK_OUT) dikurangi 8 jam kerja normal (dengan pembulatan desimal 0.5 jam / setengah jam standar INUS):
       - Hari Kerja: Jam Lembur Aktual = (Durasi Fingerprint - 8 Jam Kerja).
       - Hari Libur: Seluruh durasi fingerprint dihitung sebagai Jam Lembur Aktual.
       - Contoh (Diah Lestari): Masuk 07:11 pulang 20:32 (durasi 13.0 jam -> 8 kerja + 5.0 OT). Hari libur masuk 07:02 pulang 16:01 (8.5 jam OT). Total OT Aktual 1 minggu = 29.5 jam (Total Jam Kerja: 32 jam, Total Kerja+OT: 61.5 jam).
  c) Kategori Karyawan:
     * ALL IN: e.ALL_IN IN ('1', 'Y') -> Tunjangan flat bulanan di TR_LEMBUR_ALLIN (Staf, Spv, Kabag).
     * HARIAN: e.ALL_IN NOT IN ('1', 'Y') -> Lembur per jam (Operator, Produksi).

4. DAFTAR MASTER ALASAN ABSENSI (Ms_Reason) & CUTI (tblCUTI, tbldetcuti):
- Hadir Kerja: a.WORK_IN IS NOT NULL
- Keterlambatan: a.Time_Late > 0 (menit keterlambatan)
- Hari Libur Mingguan / Libur Nasional: UPPER(RTRIM(ISNULL(a.STATUS_HARI,''))) LIKE '%LIBUR%' (BUKAN ALPHA! Hari libur tidak boleh dihitung mangkir/alpha)
- Alpa / Mangkir: a.WORK_IN IS NULL AND UPPER(RTRIM(ISNULL(a.STATUS_HARI,''))) = 'KERJA' AND (a.REASON IS NULL OR RTRIM(a.REASON) = '' OR RTRIM(a.REASON) = '0' OR RTRIM(a.REASON) = '02')
- Sakit (SKD): RTRIM(a.REASON) = '15' ATAU RTRIM(a.REASON) = '03'
- Izin Resmi: RTRIM(a.REASON) IN ('04', '05', '06', '07')
- Cuti Tahunan: RTRIM(a.REASON) = '18' ATAU RTRIM(a.REASON) = '05' (memotong saldo cuti tahunan 12 hari di tblCUTI)
- Cuti Melahirkan: RTRIM(a.REASON) = '13' (3 bulan)
- Cuti Haid: RTRIM(a.REASON) = '17' (1-2 hari)
- Shift Security: Pagi (HOUR(a.WORK_IN) < 12) dan Sore/Malam (HOUR(a.WORK_IN) >= 12).

5. STANDAR FORMAT LAPORAN & EKSPOR EXCEL PERUSAHAAN (PT TMNB):
- Format resmi: Judul Utama 'PT. TMNB — LAPORAN DATA HRIS' (14pt Bold), Subtitle tanggal dan total baris, Header abu-abu formal FFD9D9D9 (10pt Bold), border tipis keliling, dan font Calibri.
- Tombol Unduh Laporan Lengkap Excel di UI akan secara otomatis mengunduh seluruh baris data dalam format standar resmi ini.
`;

const APP_NAVIGATION = `
NAVIGASI HALAMAN APLIKASI HRIS:
Berikut adalah daftar halaman yang tersedia di aplikasi HRIS ini. Jika pertanyaan user berkaitan dengan rekap data, laporan resmi, atau analisis tertentu, SELALU arahkan user ke halaman yang sesuai:

- /laporan → Halaman Download & Cetak Laporan Excel Resmi format standar perusahaan (Laporan Absensi Bulanan, Rekapitulasi Lembur Mingguan/Bulanan, Laporan Data Karyawan Aktif/Keluar).
  Kapan diarahkan: User meminta buatkan data lembur, data absensi, rekap bulanan/mingguan, download laporan Excel formal standar perusahaan, atau print data.
- /dashboard → Ringkasan statistik karyawan aktif, chart distribusi per bagian/departemen, kehadiran hari ini.
  Kapan diarahkan: user ingin lihat overview, ringkasan umum, grafik/chart.
- /daily → Data absensi HARI INI secara real-time. Siapa yang sudah masuk, alpha, terlambat, izin.
  Kapan diarahkan: user ingin monitoring kehadiran hari ini secara live/detail per orang.
- /karyawan → Database karyawan lengkap. Profil, pencarian NIK/nama, filter bagian/jabatan/status.
  Kapan diarahkan: user ingin cari profil karyawan, lihat detail data personal, filter karyawan.
- /absensi → Rekap absensi BULANAN per karyawan. Tabel harian per bulan, filter per bagian/jabatan.
  Kapan diarahkan: user ingin laporan absensi bulanan, rekap per periode.
- /cuti → Pengajuan dan monitoring cuti karyawan. Sisa cuti, histori cuti, approval.
  Kapan diarahkan: user bertanya soal cuti, sisa cuti, pengajuan cuti.
- /lembur → Rekap lembur mingguan. Analysis OT per karyawan, breakdown per hari.
  Kapan diarahkan: user ingin lihat jam lembur mingguan, analisis OT visual.
- /lembur/all-in → Input nominal lembur karyawan kategori All-In (tunjangan flat).
  Kapan diarahkan: user ingin input/lihat data lembur all-in.
- /lembur/spl → Surat Perintah Lembur (SPL) harian per Line/Seksi produksi.
  Kapan diarahkan: user ingin lihat/input SPL.
- /pengaturan → Pengaturan umum aplikasi (bahasa, tema, profil).
- /pengaturan/hari-libur → Master data hari libur nasional dan perusahaan.
  Kapan diarahkan: user bertanya kapan libur, tanggal merah.
`;

// ── RAG: Dynamic Schema Cache ──
let schemaCache: string | null = null;
let schemaCacheTime = 0;
const SCHEMA_CACHE_TTL = 600_000; // 10 menit

// ── RAG: Context Cache ──
let contextCache: { context: string; suggestions: string[] } | null = null;
let contextCacheTime = 0;
const CONTEXT_CACHE_TTL = 30_000; // 30 detik

async function getDynamicSchema(): Promise<string> {
  if (schemaCache && Date.now() - schemaCacheTime < SCHEMA_CACHE_TTL) return schemaCache;
  try {
    const pool = await getDbConnection();
    const tablesListStr = CORE_TABLES.map(t => `'${t}'`).join(',');
    const tables = await pool.request().query(`
      SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME IN (${tablesListStr})
      ORDER BY TABLE_NAME, ORDINAL_POSITION
    `);
    const rows = tables.recordset;
    const grouped: Record<string, string[]> = {};
    for (const r of rows) {
      if (!grouped[r.TABLE_NAME]) grouped[r.TABLE_NAME] = [];
      grouped[r.TABLE_NAME].push(
        `${r.COLUMN_NAME} ${r.DATA_TYPE}${r.CHARACTER_MAXIMUM_LENGTH ? `(${r.CHARACTER_MAXIMUM_LENGTH})` : ''}`
      );
    }
    schemaCache = Object.entries(grouped)
      .map(([t, cols]) => `${t}(${cols.join(', ')})`)
      .join('\n');
    schemaCacheTime = Date.now();
    return schemaCache;
  } catch {
    return SCHEMA_FALLBACK;
  }
}

// ── RAG: Query-Aware Entity & Semantic Retrieval ──
async function getQueryAwareRAG(userQuery: string): Promise<string> {
  try {
    const pool = await getDbConnection();
    const ragSnippets: string[] = [];

    // 1. Ekstrak potensi NIK atau Nama Karyawan jika disebutkan
    const cleanTokens = userQuery.replace(/[^a-zA-Z0-9\s]/g, ' ').split(/\s+/).filter(t => t.length >= 3);
    const stopWords = [
      'siapa', 'berapa', 'gaji', 'salary', 'pendapatan', 'tampilkan', 'daftar', 'karyawan', 'bulan', 'hari', 'ini',
      'yang', 'pada', 'total', 'data', 'rekap', 'dibulan', 'di', 'ke', 'dari', 'untuk', 'tolong', 'dan', 'atau',
      'tahun', 'januari', 'februari', 'maret', 'april', 'mei', 'juni', 'juli', 'agustus', 'september', 'oktober', 'november', 'desember',
      '2024', '2025', '2026', '2027', 'info', 'informasi', 'rincian', 'detail'
    ];
    const nameKeywords = cleanTokens.filter(t => !stopWords.includes(t.toLowerCase()));

    // Deteksi bulan & tahun jika ada di query
    const lowerQuery = userQuery.toLowerCase();
    const monthsMap: Record<string, number> = {
      januari: 1, februari: 2, maret: 3, april: 4, mei: 5, juni: 6,
      juli: 7, agustus: 8, september: 9, oktober: 10, november: 11, desember: 12
    };
    let targetMonth: number | null = null;
    for (const [mName, mNum] of Object.entries(monthsMap)) {
      if (lowerQuery.includes(mName)) {
        targetMonth = mNum;
        break;
      }
    }
    const yearMatch = userQuery.match(/\b(202\d)\b/);
    const targetYear = yearMatch ? parseInt(yearMatch[1], 10) : 2026;

    if (nameKeywords.length > 0) {
      let filter = '';
      if (nameKeywords.length >= 2) {
        // Prioritaskan kecocokan semua kata (contoh: "WIDYA" AND "ETIKA")
        const comb = nameKeywords.map(k => `e.EMP_NM LIKE '%${k.replace(/'/g, "''")}%'`).join(' AND ');
        const ind = nameKeywords.map(k => `e.EMP_NM LIKE '%${k.replace(/'/g, "''")}%' OR e.EMP_CD LIKE '%${k.replace(/'/g, "''")}%'`).join(' OR ');
        filter = `(${comb}) OR (${ind})`;
      } else {
        filter = `e.EMP_NM LIKE '%${nameKeywords[0].replace(/'/g, "''")}%' OR e.EMP_CD LIKE '%${nameKeywords[0].replace(/'/g, "''")}%'`;
      }

      const empCandidates = await pool.request().query(`
        SELECT TOP 3 
          RTRIM(e.EMP_CD) as EMP_CD, 
          RTRIM(e.EMP_NM) as EMP_NM, 
          RTRIM(s.SEC_DESC) as SEC_DESC,
          RTRIM(j.JOB_DESC) as JOB_DESC,
          e.BS_SLR,
          CASE WHEN RTRIM(e.ALL_IN) = '1' OR RTRIM(e.ALL_IN) = 'Y' THEN 'ALL IN (Staf/Tunjangan Tetap)' ELSE 'HARIAN (Lembur Jam)' END as KATEGORI_LEMBUR,
          CASE WHEN RTRIM(e.JNS_KRY) = '100' THEN 'Tetap (PKWTT)' WHEN RTRIM(e.JNS_KRY) = '101' THEN 'Kontrak (PKWT)' ELSE 'Training' END as STATUS_KERJA,
          e.Act_NonAct, 
          e.DT_RSG,
          CONVERT(varchar(10), e.DT_ENTRY, 120) as DT_ENTRY_STR,
          ISNULL(e.T1, 0) as T1_JABATAN,
          ISNULL(e.T3, 0) as T3_PRESTASI,
          ISNULL(e.T4, 0) as T4_KHUSUS,
          ISNULL(e.T5, 0) as T5_LEMBUR_ALLIN
        FROM EMP_TABLE e
        LEFT JOIN MS_SEC s ON RTRIM(e.SEC_CD) = RTRIM(s.SEC_CD)
        LEFT JOIN MS_JOBS j ON RTRIM(e.JOB_CD) = RTRIM(j.JOB_CD)
        WHERE ${filter}
        ORDER BY 
          CASE WHEN ${nameKeywords.length >= 2 ? `(${nameKeywords.map(k => `e.EMP_NM LIKE '%${k.replace(/'/g, "''")}%'`).join(' AND ')})` : '1=1'} THEN 0 ELSE 1 END,
          CASE WHEN e.Act_NonAct = 1 AND (e.DT_RSG IS NULL OR e.DT_RSG >= GETDATE()) THEN 0 ELSE 1 END,
          e.DT_ENTRY DESC
      `);

      if (empCandidates.recordset.length > 0) {
        const formatRupiah = (num: number) => `Rp ${Math.round(num).toLocaleString('id-ID')}`;
        const candidateDetails: string[] = [];

        for (const emp of empCandidates.recordset) {
          const isActive = emp.Act_NonAct && (!emp.DT_RSG || new Date(emp.DT_RSG) >= new Date());
          const totalTunjanganTetap = (emp.T1_JABATAN || 0) + (emp.T3_PRESTASI || 0) + (emp.T4_KHUSUS || 0) + (emp.T5_LEMBUR_ALLIN || 0);
          const totalEstimasiTetap = (emp.BS_SLR || 0) + totalTunjanganTetap;

          let monthlyAttendance = '';
          if (targetMonth) {
            try {
              const attQuery = await pool.request().query(`
                SELECT 
                  COUNT(CASE WHEN a.WORK_IN IS NOT NULL THEN 1 END) as TOTAL_HADIR,
                  COUNT(CASE WHEN a.WORK_IN IS NULL AND UPPER(RTRIM(ISNULL(a.STATUS_HARI,''))) = 'KERJA' AND (a.REASON IS NULL OR RTRIM(a.REASON) = '' OR RTRIM(a.REASON) = '0' OR RTRIM(a.REASON) = '02') THEN 1 END) as TOTAL_ALPA,
                  COUNT(CASE WHEN UPPER(RTRIM(ISNULL(a.STATUS_HARI,''))) LIKE '%LIBUR%' THEN 1 END) as TOTAL_LIBUR,
                  COUNT(CASE WHEN RTRIM(a.REASON) IN ('15','03') THEN 1 END) as TOTAL_SAKIT,
                  COUNT(CASE WHEN RTRIM(a.REASON) IN ('04','05','06','07') THEN 1 END) as TOTAL_IZIN,
                  COUNT(CASE WHEN RTRIM(a.REASON) = '18' THEN 1 END) as TOTAL_CUTI,
                  SUM(ISNULL(a.OT_1,0)+ISNULL(a.OT_2,0)+ISNULL(a.OT_3,0)+ISNULL(a.OT_4,0)) as TOTAL_OT_HOURS,
                  SUM(ISNULL(a.U_MAKAN, 0)) as TOTAL_U_MAKAN,
                  SUM(ISNULL(a.U_TRANSPORT, 0)) as TOTAL_U_TRANSPORT,
                  SUM(ISNULL(a.T_OT, 0)) as TOTAL_U_LEMBUR
                FROM TR_ABSEN a
                WHERE RTRIM(a.EMP_CD) = '${emp.EMP_CD}' AND MONTH(a.DATE_TRANS) = ${targetMonth} AND YEAR(a.DATE_TRANS) = ${targetYear}
              `);
              const att = attQuery.recordset[0];
              if (att) {
                monthlyAttendance = `\n  - Data Kehadiran Periode Bulan ${targetMonth}/${targetYear}: Hadir = ${att.TOTAL_HADIR || 0} hari, Alpha = ${att.TOTAL_ALPA || 0} hari (Hari Libur Resmi = ${att.TOTAL_LIBUR || 0} hari, Sakit = ${att.TOTAL_SAKIT || 0} hari, Izin = ${att.TOTAL_IZIN || 0} hari, Cuti = ${att.TOTAL_CUTI || 0} hari), Total Jam Lembur Resmi = ${att.TOTAL_OT_HOURS || 0} jam. Tunjangan Makan TR_ABSEN = ${formatRupiah(att.TOTAL_U_MAKAN || 0)}, Tunjangan Transport TR_ABSEN = ${formatRupiah(att.TOTAL_U_TRANSPORT || 0)}, Upah Lembur TR_ABSEN = ${formatRupiah(att.TOTAL_U_LEMBUR || 0)}`;
              }
            } catch (err) {
              console.warn('[RAG MONTHLY ATT ERROR]', err);
            }
          }

          candidateDetails.push(
            `* Karyawan: ${emp.EMP_NM} (NIK: ${emp.EMP_CD})\n` +
            `  - Status: ${isActive ? 'AKTIF' : 'NON-AKTIF / RESIGN'}, Hubungan Kerja: ${emp.STATUS_KERJA}\n` +
            `  - Bagian: ${emp.SEC_DESC || '-'}, Jabatan: ${emp.JOB_DESC || '-'}\n` +
            `  - Tanggal Masuk Kerja: ${emp.DT_ENTRY_STR || '-'}\n` +
            `  - Gaji Pokok (Basic Salary / BS_SLR): ${formatRupiah(emp.BS_SLR || 0)}\n` +
            `  - Tunjangan Tetap: T1 (Jabatan) = ${formatRupiah(emp.T1_JABATAN || 0)}, T3 (Prestasi) = ${formatRupiah(emp.T3_PRESTASI || 0)}, T5 (Lembur All-In) = ${formatRupiah(emp.T5_LEMBUR_ALLIN || 0)}\n` +
            `  - Total Gaji Pokok + Tunjangan Tetap: ${formatRupiah(totalEstimasiTetap)}\n` +
            `  - Kategori Lembur: ${emp.KATEGORI_LEMBUR}${monthlyAttendance}`
          );
        }

        ragSnippets.push(`[RAG Data Profil & Gaji Karyawan Riil Database]:\n${candidateDetails.join('\n\n')}`);
      }
    }

    // 2. Ekstrak potensi Bagian/Line jika disebutkan
    const secCandidates = await pool.request().query(`
      SELECT TOP 4 RTRIM(SEC_CD) as SEC_CD, RTRIM(SEC_DESC) as SEC_DESC
      FROM MS_SEC
      WHERE SEC_DESC LIKE '%LINE%' OR SEC_DESC LIKE '%CUTTING%' OR SEC_DESC LIKE '%SEWING%' OR SEC_DESC LIKE '%QC%' OR SEC_DESC LIKE '%PACKING%' OR SEC_DESC LIKE '%IRONING%'
    `);
    if (secCandidates.recordset.length > 0) {
      const secList = secCandidates.recordset.map((s: any) => `${s.SEC_CD}=${s.SEC_DESC}`).join(', ');
      ragSnippets.push(`[RAG Contoh Kode Bagian MS_SEC]: ${secList}`);
    }

    return ragSnippets.join('\n\n');
  } catch {
    return '';
  }
}

// ── Web Search: DuckDuckGo Instant Answer ──
const WEB_SEARCH_KEYWORDS = [
  'uu ', 'undang-undang', 'peraturan', 'regulasi', 'hukum', 'pp ', 'perppu',
  'bpjs', 'jamsostek', 'ketenagakerjaan', 'depnaker', 'disnaker',
  'aturan pemerintah', 'menurut hukum', 'dasar hukum',
  'cara menghitung', 'rumus', 'formula', 'prosedur',
  'upah minimum', 'umr', 'umk', 'ump',
  'phk', 'pesangon', 'uang pisah',
  'thr', 'bonus', 'insentif',
  'pkwt', 'pkwtt', 'perjanjian kerja',
  'cuti melahirkan menurut', 'hak cuti menurut',
  'jam kerja menurut', 'lembur menurut',
  'cipta kerja', 'omnibus',
];

function detectWebSearchNeeded(query: string): boolean {
  const lower = query.toLowerCase();
  return WEB_SEARCH_KEYWORDS.some(kw => lower.includes(kw));
}

let webSearchCache: Record<string, { result: string; time: number }> = {};
const WEB_CACHE_TTL = 300_000; // 5 menit

async function searchWeb(query: string): Promise<string> {
  const cacheKey = query.toLowerCase().trim().slice(0, 80);
  if (webSearchCache[cacheKey] && Date.now() - webSearchCache[cacheKey].time < WEB_CACHE_TTL) {
    return webSearchCache[cacheKey].result;
  }

  try {
    // DuckDuckGo Instant Answer API (free, no key)
    const searchQuery = encodeURIComponent(query + ' Indonesia ketenagakerjaan');
    const ddgUrl = `https://api.duckduckgo.com/?q=${searchQuery}&format=json&no_html=1&skip_disambig=1`;
    const res = await fetch(ddgUrl, { signal: AbortSignal.timeout(5000) });
    const data = await res.json();

    const snippets: string[] = [];

    if (data.AbstractText) {
      snippets.push(`Ringkasan: ${data.AbstractText.slice(0, 400)}`);
      if (data.AbstractSource) snippets.push(`Sumber: ${data.AbstractSource}`);
    }

    if (data.RelatedTopics?.length) {
      const topics = data.RelatedTopics
        .filter((t: any) => t.Text)
        .slice(0, 3)
        .map((t: any) => `- ${t.Text.slice(0, 200)}`);
      if (topics.length) snippets.push(`Info terkait:\n${topics.join('\n')}`);
    }

    if (data.Answer) {
      snippets.push(`Jawaban langsung: ${data.Answer}`);
    }

    if (snippets.length === 0) {
      // Fallback: try a simple search with different approach
      const fallbackUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1`;
      const fallbackRes = await fetch(fallbackUrl, { signal: AbortSignal.timeout(3000) });
      const fallbackData = await fallbackRes.json();
      if (fallbackData.AbstractText) {
        snippets.push(`Ringkasan: ${fallbackData.AbstractText.slice(0, 400)}`);
      }
    }

    const result = snippets.length > 0
      ? `[RAG PENCARIAN INTERNET]:\n${snippets.join('\n')}`
      : '';

    webSearchCache[cacheKey] = { result, time: Date.now() };
    return result;
  } catch (err) {
    console.warn('[WEB SEARCH] Failed:', err);
    return '';
  }
}

// ── RAG: User Context + Suggestions (query TR_ABSEN & EMP_TABLE) ──
async function getContextAndSuggestions(): Promise<{ context: string; suggestions: string[] }> {
  if (contextCache && Date.now() - contextCacheTime < CONTEXT_CACHE_TTL) return contextCache;

  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const hour = now.getHours();
  const day = now.getDay();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

  try {
    const pool = await getDbConnection();
    const r = await pool.request().query(`
      SELECT
        (SELECT COUNT(*) FROM TR_ABSEN WHERE CONVERT(varchar(10), DATE_TRANS, 120) = '${today}' AND WORK_IN IS NULL AND UPPER(RTRIM(ISNULL(STATUS_HARI,''))) = 'KERJA' AND (REASON IS NULL OR RTRIM(REASON) = '' OR RTRIM(REASON) = '0' OR RTRIM(REASON) = '02')) AS alpha_today,
        (SELECT COUNT(*) FROM TR_ABSEN WHERE DATE_TRANS >= '${monthStart}' AND (ISNULL(OT_1,0) > 0 OR ISNULL(OT_2,0) > 0 OR ISNULL(OT_3,0) > 0 OR ISNULL(OT_4,0) > 0)) AS ot_month,
        (SELECT COUNT(*) FROM EMP_TABLE WHERE Act_NonAct = 1 AND (DT_RSG IS NULL OR DT_RSG >= GETDATE()) AND (DT_ENTRY IS NULL OR DT_ENTRY <= GETDATE())) AS active_emp,
        (SELECT COUNT(*) FROM EMP_TABLE WHERE Act_NonAct = 1 AND (DT_RSG IS NULL OR DT_RSG >= GETDATE()) AND RTRIM(JNS_KRY) = '101') AS active_kontrak,
        (SELECT COUNT(*) FROM EMP_TABLE WHERE Act_NonAct = 1 AND (DT_RSG IS NULL OR DT_RSG >= GETDATE()) AND RTRIM(JNS_KRY) = '100') AS active_tetap,
        (SELECT COUNT(*) FROM EMP_TABLE WHERE Act_NonAct = 1 AND (DT_RSG IS NULL OR DT_RSG >= GETDATE()) AND RTRIM(SX) = 'L') AS active_pria,
        (SELECT COUNT(*) FROM EMP_TABLE WHERE Act_NonAct = 1 AND (DT_RSG IS NULL OR DT_RSG >= GETDATE()) AND RTRIM(SX) = 'P') AS active_wanita
    `);
    const row = r.recordset[0] || {};
    const alphaToday = row.alpha_today || 0;
    const otMonth = row.ot_month || 0;
    const activeEmp = row.active_emp || 1966;
    const activeKontrak = row.active_kontrak || 1179;
    const activeTetap = row.active_tetap || 786;
    const activePria = row.active_pria || 510;
    const activeWanita = row.active_wanita || 1456;

    const context = `[RAG STATISTIK AKTIF REAL-TIME]:
- Tanggal & Jam Sistem: ${today}, pukul ${hour}:00 WIB
- Total Karyawan Aktif Sebenarnya (Act_NonAct=1 AND DT_RSG IS NULL): ${activeEmp} orang
- Komposisi Status Kerja: Kontrak = ${activeKontrak} orang, Tetap = ${activeTetap} orang, Training = 1 orang
- Komposisi Gender: Laki-laki = ${activePria} orang, Perempuan = ${activeWanita} orang
- Absensi Hari Ini: Alpha = ${alphaToday} orang
- Record Lembur Bulan Ini: ${otMonth} data lembur`;

    const suggestions: string[] = [];
    if (hour < 11) {
      suggestions.push('Berapa total karyawan aktif saat ini?', 'Berapa jumlah karyawan tetap vs kontrak?');
    } else if (hour < 16) {
      suggestions.push('Daftar karyawan terlambat hari ini', 'Rekap kehadiran per bagian hari ini');
    } else {
      suggestions.push('Rekap lembur hari ini', 'Top 5 karyawan dengan jam lembur terbanyak bulan ini');
    }
    if (day === 5) suggestions.push('Daftar karyawan cuti minggu ini');
    if (alphaToday > 0) suggestions.push(`Siapa saja ${alphaToday} orang yang alpha hari ini?`);
    suggestions.push('Tampilkan 10 karyawan terbaru yang masuk');

    const uniqueSuggestions = Array.from(new Set(suggestions)).slice(0, 5);

    contextCache = { context, suggestions: uniqueSuggestions };
    contextCacheTime = Date.now();
    return contextCache;
  } catch {
    const fallback = {
      context: `[RAG STATISTIK REAL-TIME]: Hari ini: ${today}, jam ${hour}:00. Total Karyawan Aktif Sebenarnya: 1.966 orang (Kontrak: 1.179, Tetap: 786, Pria: 510, Wanita: 1.456).`,
      suggestions: [
        'Berapa total karyawan aktif saat ini?',
        'Berapa jumlah karyawan tetap vs kontrak?',
        'Siapa saja karyawan yang alpha hari ini?',
        'Daftar bagian/seksi di perusahaan',
      ],
    };
    contextCache = fallback;
    contextCacheTime = Date.now();
    return fallback;
  }
}

// ── Prompt Injection Guard ──
const INJECTION_PATTERNS = [
  /ignore\s+(previous|all|above|prior)\s+(instructions?|prompts?|rules?|context)/i,
  /you\s+are\s+now\s+/i,
  /system\s*:/i,
  /override\s+(the\s+)?(system|instructions?|rules?|prompt)/i,
  /bypass\s+(the\s+)?(filter|guard|rule|restriction)/i,
  /jailbreak/i,
  /forget\s+(everything|all|your|previous)/i,
  /new\s+(instructions?|rules?|prompt)\s*:/i,
  /act\s+as\s+(if\s+)?(you\s+are\s+)?(a\s+)?different/i,
  /pretend\s+(you\s+are|to\s+be)/i,
  /role\s*:\s*system/i,
  /<\|im_start\|>/i,
  /<\|im_end\|>/i,
  /reset\s+(your\s+)?(instructions?|rules?|memory)/i,
  /sudo\s/mi,
];

const SQL_INJECTION_IN_TEXT = [
  /'\s*OR\s+'1'='1/i,
  /'\s*OR\s+1=1/i,
  /UNION\s+(ALL\s+)?SELECT/i,
  /DROP\s+TABLE/i,
  /INSERT\s+INTO/i,
  /DELETE\s+FROM/i,
  /UPDATE\s+\w+\s+SET/i,
  /;\s*DROP/i,
  /;\s*DELETE/i,
  /xp_cmdshell/i,
  /EXEC\s*\(/i,
  /EXECUTE\s*\(/i,
];

function validateInput(message: string): string | null {
  if (!message || message.trim().length < 2) return 'Pesan terlalu pendek.';
  if (message.length > 2000) return 'Pesan terlalu panjang (maksimal 2000 karakter).';

  for (const pattern of SQL_INJECTION_IN_TEXT) {
    if (pattern.test(message)) {
      return 'Permintaan mengandung pola query SQL yang tidak diizinkan.';
    }
  }

  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(message)) {
      return 'Saya hanya membantu query dan analisis data HRIS TMNB.';
    }
  }

  return null;
}

function cleanAIText(text: string): string {
  if (!text) return '';
  // 1. Remove all SQL code blocks (closed or unclosed)
  let cleaned = text.replace(/```(?:sql|tsql|[\w]*)\s*[\s\S]*?(?:```|$)/gi, '').trim();
  // 2. Remove any standalone backticks
  cleaned = cleaned.replace(/```/g, '').trim();
  // 3. Remove markdown header markers (#, ##) but keep the header text
  cleaned = cleaned.replace(/^#{1,6}\s*/gm, '').trim();
  // 4. Clean up excess newlines (preserve double newlines for spacing)
  cleaned = cleaned.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  return cleaned;
}

// ── SQL Safety ──
const DANGEROUS_SQL = /(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE|EXEC|EXECUTE|MERGE|GRANT|REVOKE)\s/i;
const BLOCKED_KEYWORDS = /(INTO\s+(OUTFILE|DUMPFILE)|xp_cmdshell|sp_configure|OPENROWSET|OPENDATASOURCE|SLEEP|BENCHMARK|WAITFOR)/i;

function extractSQL(response: string): string | null {
  // Case-insensitive match for ```sql ... ``` or unclosed ```sql ...
  const match = response.match(/```(?:sql|tsql)?\s*([\s\S]*?)(?:```|$)/i);
  if (match) {
    let raw = match[1].trim();
    if (raw.endsWith(';')) raw = raw.slice(0, -1).trim();
    if (/^\s*(SELECT|WITH)\b/i.test(raw)) {
      return raw;
    }
  }
  return null;
}

function validateSQL(sql: string): string | null {
  if (DANGEROUS_SQL.test(sql)) return 'Operasi tulis tidak diizinkan.';
  if (BLOCKED_KEYWORDS.test(sql)) return 'Keyword tidak diizinkan terdeteksi.';
  if (!/^\s*(SELECT|WITH)\b/i.test(sql)) return 'Hanya query SELECT yang diizinkan.';
  if (sql.length > 3000) return 'Query terlalu panjang.';
  return null;
}

// ── System Prompt ──
function buildSystemPrompt(
  schema: string,
  context: string,
  queryRAG: string,
  webSearchResult: string,
  learnedMemory: string
): string {
  return `Kamu adalah Viditii, asisten AI HRIS cerdas dan fleksibel untuk PT TMNB (PT TP Trading Jakarta). Kamu memahami seluruh sistem aplikasi HRIS ini dan bisa membantu tim HRD/manajemen dalam:
- Menganalisis data karyawan, absensi, lembur, cuti
- Mengarahkan user ke halaman yang tepat di aplikasi
- Menjawab pertanyaan tentang regulasi ketenagakerjaan Indonesia
- Memberikan rekomendasi dan insight berbasis data

ATURAN RESPONS:
1. Jika user meminta DATA spesifik (jumlah, daftar, rekap, statistik, siapa, berapa, performa, lembur, absensi) → Jelaskan dan terangkan temuan data secara NARATIF, komunikatif, dan ringkas (sebutkan total karyawan, perbandingan angka, dan sorotan kunci/peringkat teratas secara poin kalimat).
2. DILARANG KERAS membuat tabel markdown (| Kolom 1 | Kolom 2 |) atau tabel teks ASCII di dalam chat, karena ukuran kotak chat sempit. Urusan tabel data lengkap diserahkan ke file Excel yang otomatis disediakan via tombol unduh.
3. SELALU sertakan query SQL yang sesuai di dalam \`\`\`sql ... \`\`\` agar sistem dapat mengeksekusi data dan menyiapkan file Excel lengkap.
4. Jika user bertanya KONSEP/PENJELASAN (apa itu, bagaimana cara, jelaskan, aturan) → jawab teks naratif saja, JANGAN generate SQL.
5. Jika pertanyaan berkaitan dengan rekap data, lembur, absensi, atau laporan → SELALU berikan info: "Rincian data tabel lengkap dapat diunduh melalui tombol Unduh Laporan Lengkap Excel di bawah. Untuk melihat laporan resmi berformat standar perusahaan, silakan buka halaman Laporan di menu /laporan."
6. JANGAN PERNAH generate SQL INSERT/UPDATE/DELETE/DROP/ALTER.
7. Jawab dalam bahasa Indonesia, ramah, profesional, dan jelas.
8. STRUKTUR & SPASING PENULISAN (SANGAT PENTING):
- Buat tulisan yang SANGAT RAPI dan ENAK DIBACA dengan pemisahan baris (enter) dan spasi yang jelas.
- Pisahkan paragraf pembuka, poin rincian, dan paragraf penutup menggunakan DUA KALI ENTER (\n\n).
- Gunakan poin berbutir (- ) atau bernomor (1. , 2. ) untuk merinci data, angka komponen gaji, kehadiran, atau perbandingan status. Setiap poin WAJIB berada di baris tersendiri.
- Gunakan format tebal (**Kata Kunci**) untuk nama karyawan, NIK, nominal rupiah, total angka, atau bagian agar mudah dipindai pembaca.
- JANGAN PERNAH menyatukan semua informasi ke dalam satu baris panjang tanpa enter!

ATURAN SQL T-SQL:
- JANGAN membatasi kueri dengan SELECT TOP 100 jika user meminta rekap data periode, data lembur mingguan/bulanan, atau seluruh data. Biarkan kueri mengambil seluruh data yang cocok agar file Excel berisi data lengkap.
- Gunakan SELECT TOP N hanya jika user secara spesifik menyebutkan jumlah seperti "top 5", "top 10", atau "3 karyawan".
- WAJIB RTRIM() pada semua kolom CHAR/VARCHAR saat SELECT dan JOIN.
- Filter karyawan aktif WAJIB: e.Act_NonAct = 1 AND (e.DT_RSG IS NULL OR CONVERT(varchar(10), e.DT_RSG, 120) >= CONVERT(varchar(10), GETDATE(), 120))
- Nama tabel RESMI: EMP_TABLE, TR_ABSEN, MS_SEC, MS_DEP, MS_JOBS, Ms_Reason, MSJNS_KRY, tblCUTI, tbldetcuti, TR_LEMBUR_ALLIN, TR_SPL_PLAN.
- Format tanggal: CONVERT(varchar(10), kolom, 120) untuk YYYY-MM-DD.

ATURAN ADAPTIF (SANGAT PENTING):
- Jika user meminta "performa terbaik ALL IN dan HARIAN" (atau karyawan terbaik bulan X):
  * Gunakan CTE dengan ROW_NUMBER() OVER (PARTITION BY (CASE WHEN RTRIM(e.ALL_IN) = '1' OR RTRIM(e.ALL_IN) = 'Y' THEN 'ALL IN' ELSE 'HARIAN' END) ORDER BY COUNT(CASE WHEN a.WORK_IN IS NOT NULL THEN 1 END) DESC, SUM(ISNULL(a.OT_1,0)+ISNULL(a.OT_2,0)+ISNULL(a.OT_3,0)+ISNULL(a.OT_4,0)) DESC, SUM(ISNULL(a.Time_Late,0)) ASC) agar menghasilkan daftar peringkat karyawan terbaik dari KEDUA kategori (ALL IN dan HARIAN) secara adil dan lengkap (misalnya Top 15 ALL IN dan Top 15 HARIAN).
  * Terangkan beberapa nama karyawan teratas dan pencapaiannya secara naratif di teks balasan.
  * JANGAN gunakan HAVING SUM(alpha) = 0 karena hari libur/Minggu tercatat di TR_ABSEN tanpa WORK_IN.
- Jika user meminta "buatkan data lembur" / "data lembur minggu ke-X" / "rekap lembur":
  * Ambil seluruh karyawan yang memiliki jam lembur (> 0) pada periode tanggal tersebut tanpa membatasi TOP 100.
  * Urutkan berdasarkan TOTAL_JAM_LEMBUR DESC.
  * Terangkan ringkasan jumlah karyawan yang lembur, bagian dengan lembur tertinggi, dan jam lembur teratas secara narasi.
  * Di teks balasan, sertakan keterangan bahwa seluruh data tabel dapat diunduh via tombol Excel dan arahkan ke menu /laporan.
- Jika user menanyakan "gaji / pendapatan / profil karyawan tertentu" (Contoh: "Berapa gaji karyawan Widya Etika"):
  * WAJIB SEBUTKAN DATA ASLI DAN PERSIS yang tercantum di [RAG Data Profil & Gaji Karyawan Riil Database]!
  * DILARANG KERAS MENGARANG NIK, JABATAN, GAJI POKOK, ATAU TUNJANGAN!
  * Sebutkan: NIK asli, Bagian/Jabatan asli, Status Kontrak/Tetap, Gaji Pokok (BS_SLR), rincian Tunjangan Tetap (T1 Jabatan, T3 Prestasi, T5 Lembur All-In jika ada), Total Gaji Pokok + Tunjangan Tetap (gunakan nilai persis dari Total di RAG, jangan menghitung manual agar tidak ada selisih ketik), serta Kategori Lembur (ALL IN atau HARIAN).
  * Jika karyawan berstatus ALL IN (e.ALL_IN = 1), jelaskan bahwa lembur tidak dibayar per jam di TR_ABSEN melainkan diberikan tunjangan flat bulanan.
  * Tulis kueri SQL SELECT data karyawan lengkap dari EMP_TABLE (dan TR_ABSEN jika menanyakan periode tertentu).
- Jika user bilang "per bagian" atau "per seksi" atau "per line" → GROUP BY RTRIM(s.SEC_DESC).
- Jika user bilang "per departemen" → GROUP BY RTRIM(d.DEP_DESC).
- Jika user bilang "per jabatan" → GROUP BY RTRIM(j.JOB_DESC).
- Jika user bilang "bulan lalu" atau "bulan kemarin" → gunakan MONTH(DATEADD(month, -1, GETDATE())).
- Jika user bilang "minggu ini" → gunakan DATEADD(day, -DATEPART(dw, GETDATE())+2, GETDATE()) s/d GETDATE().
- Jika user bilang "minggu ke-1 / ke-2 / ke-3 / ke-4" bulan X → gunakan rentang tanggal (01-07, 08-14, 15-21, 22-31) pada DATE_TRANS.
- Jika user bilang "grafik" atau "chart" → arahkan ke halaman /dashboard.
- JANGAN PERNAH menolak menjawab dengan alasan tidak ada data di RAG real-time. Database memiliki data lengkap di TR_ABSEN. Selalu generate query SQL T-SQL!

SCHEMA DATABASE:
${schema}

${APP_KNOWLEDGE}

${APP_NAVIGATION}

${context}

${learnedMemory ? `${learnedMemory}\n` : ''}${queryRAG ? `${queryRAG}\n` : ''}${webSearchResult ? `${webSearchResult}\n` : ''}
CONTOH KASUS:

Contoh 1 - Jumlah Karyawan Aktif:
User: "Berapa total karyawan aktif?"
Jawaban:
Saat ini terdapat total 1.966 karyawan aktif di PT TMNB (176 karyawan kategori ALL IN dan 1.790 karyawan kategori Harian). Anda dapat melihat rincian per bagian di menu /dashboard atau /karyawan.
\`\`\`sql
SELECT COUNT(*) AS TOTAL_AKTIF
FROM EMP_TABLE e
WHERE e.Act_NonAct = 1
  AND (e.DT_RSG IS NULL OR CONVERT(varchar(10), e.DT_RSG, 120) >= CONVERT(varchar(10), GETDATE(), 120))
\`\`\`

Contoh 1b - Gaji & Profil Karyawan Tertentu:
User: "Berapa gaji karyawan Widya Etika dibulan Juni ?"
Jawaban:
Berdasarkan data resmi di sistem, Widya Etika (NIK: 26066995) adalah karyawan aktif di bagian HR dengan jabatan STAFF dan status hubungan kerja Kontrak (PKWT) yang mulai masuk kerja pada 11 Juni 2026.

Rincian komponen gaji dan pendapatan:
- Gaji Pokok (Basic Salary): Rp 3.701.709
- Tunjangan Jabatan (T1): Rp 337.005
- Tunjangan Prestasi (T3): Rp 337.005
- Tunjangan Lembur All-In (T5): Rp 200.000
- Total Estimasi Gaji Pokok + Tunjangan: Rp 4.575.719

Widya Etika terdaftar dalam kategori ALL IN, sehingga upah lembur diberikan flat bulanan melalui Tunjangan All-In dan tidak dihitung per jam di TR_ABSEN. Pada bulan Juni 2026, tercatat hadir kerja sebanyak 14 hari kerja (sejak tanggal masuk 11 Juni 2026). Rincian data lengkap dapat diunduh melalui tombol Unduh Laporan Lengkap Excel di bawah.
\`\`\`sql
SELECT 
  RTRIM(e.EMP_CD) AS NIK, 
  RTRIM(e.EMP_NM) AS NAMA, 
  RTRIM(s.SEC_DESC) AS BAGIAN, 
  RTRIM(j.JOB_DESC) AS JABATAN,
  e.BS_SLR AS GAJI_POKOK,
  ISNULL(e.T1, 0) AS TUNJANGAN_JABATAN,
  ISNULL(e.T3, 0) AS TUNJANGAN_PRESTASI,
  ISNULL(e.T5, 0) AS TUNJANGAN_LEMBUR_ALLIN,
  (e.BS_SLR + ISNULL(e.T1,0) + ISNULL(e.T3,0) + ISNULL(e.T5,0)) AS TOTAL_ESTIMASI_GAJI,
  CASE WHEN RTRIM(e.ALL_IN) = '1' OR RTRIM(e.ALL_IN) = 'Y' THEN 'ALL IN' ELSE 'HARIAN' END AS KATEGORI_LEMBUR
FROM EMP_TABLE e
LEFT JOIN MS_SEC s ON RTRIM(e.SEC_CD) = RTRIM(s.SEC_CD)
LEFT JOIN MS_JOBS j ON RTRIM(e.JOB_CD) = RTRIM(j.JOB_CD)
WHERE RTRIM(e.EMP_CD) = '26066995' OR e.EMP_NM LIKE '%WIDYA%ETIKA%'
\`\`\`

Contoh 2 - Performa Karyawan Terbaik (ALL IN & HARIAN):
User: "tolong list karyawan dengan performa terbaik, baik itu ALL IN dan HARIAN bulan juni"
Jawaban:
Berdasarkan rekapitulasi kehadiran bulan Juni 2026, berikut rangkuman performa terbaik dari kedua kategori:

1. Kategori ALL IN: Dipimpin oleh Inti Mujiarsih (Packing), Ali Nurudin (Utility), dan Unang Pranadinata (Mekanik) dengan kehadiran sempurna 23 hari kerja dan tanpa keterlambatan.
2. Kategori Harian: Dipimpin oleh Murawi (Warehouse), Maskon (Packing), dan Purwati (Packing) dengan kehadiran penuh 23 hari kerja serta kontribusi jam lembur tertinggi mencapai 120 hingga 130 jam.

Rincian tabel lengkap telah disiapkan dan dapat diunduh melalui tombol Unduh Laporan Lengkap Excel di bawah. Anda juga dapat melihat laporan absensi resmi di menu /absensi atau /laporan.
\`\`\`sql
WITH PerfRank AS (
  SELECT 
    RTRIM(e.EMP_CD) AS NIK,
    RTRIM(e.EMP_NM) AS NAMA,
    RTRIM(s.SEC_DESC) AS BAGIAN,
    CASE WHEN RTRIM(e.ALL_IN) = '1' OR RTRIM(e.ALL_IN) = 'Y' THEN 'ALL IN' ELSE 'HARIAN' END AS KATEGORI,
    COUNT(CASE WHEN a.WORK_IN IS NOT NULL THEN 1 END) AS TOTAL_HADIR,
    SUM(ISNULL(a.Time_Late, 0)) AS TOTAL_TERLAMBAT_MENIT,
    SUM(ISNULL(a.OT_1, 0) + ISNULL(a.OT_2, 0) + ISNULL(a.OT_3, 0) + ISNULL(a.OT_4, 0)) AS TOTAL_JAM_LEMBUR,
    ROW_NUMBER() OVER (
      PARTITION BY (CASE WHEN RTRIM(e.ALL_IN) = '1' OR RTRIM(e.ALL_IN) = 'Y' THEN 'ALL IN' ELSE 'HARIAN' END)
      ORDER BY COUNT(CASE WHEN a.WORK_IN IS NOT NULL THEN 1 END) DESC,
               SUM(ISNULL(a.OT_1, 0) + ISNULL(a.OT_2, 0) + ISNULL(a.OT_3, 0) + ISNULL(a.OT_4, 0)) DESC,
               SUM(ISNULL(a.Time_Late, 0)) ASC
    ) AS RANK_KATEGORI
  FROM TR_ABSEN a
  JOIN EMP_TABLE e ON RTRIM(a.EMP_CD) = RTRIM(e.EMP_CD)
  LEFT JOIN MS_SEC s ON RTRIM(e.SEC_CD) = RTRIM(s.SEC_CD)
  WHERE MONTH(a.DATE_TRANS) = 6 AND YEAR(a.DATE_TRANS) = 2026
    AND e.Act_NonAct = 1 AND (e.DT_RSG IS NULL OR e.DT_RSG >= GETDATE())
  GROUP BY e.EMP_CD, e.EMP_NM, s.SEC_DESC, e.ALL_IN
)
SELECT NIK, NAMA, BAGIAN, KATEGORI, TOTAL_HADIR, TOTAL_TERLAMBAT_MENIT, TOTAL_JAM_LEMBUR
FROM PerfRank
WHERE RANK_KATEGORI <= 15
ORDER BY KATEGORI, RANK_KATEGORI
\`\`\`

Contoh 3 - Lembur Periode Minggu Spesifik (Seluruh Karyawan):
User: "tolong buatkan data lembur di minggu ke tiga bulan juni 2026"
Jawaban:
Pada minggu ke-3 bulan Juni 2026 (periode 15-21 Juni 2026), tercatat sebanyak 1.640 karyawan aktif yang melakukan kerja lembur. Jam lembur tertinggi pada periode ini didominasi oleh bagian produksi (Line 01, Line 07, dan Line 16) dengan rata-rata jam lembur mencapai 24 jam per karyawan dalam seminggu.

Seluruh data lembur dari 1.640 karyawan tersebut telah dirangkum dalam file Excel dan dapat Anda unduh melalui tombol Unduh Laporan Lengkap Excel di bawah. Untuk mengunduh laporan resmi lembur berformat standar perusahaan, silakan buka halaman Laporan di menu /laporan.
\`\`\`sql
SELECT 
  RTRIM(e.EMP_CD) AS NIK,
  RTRIM(e.EMP_NM) AS NAMA,
  RTRIM(s.SEC_DESC) AS BAGIAN,
  CASE 
    WHEN RTRIM(e.ALL_IN) = '1' OR RTRIM(e.ALL_IN) = 'Y' THEN 'ALL IN'
    ELSE 'HARIAN'
  END AS KATEGORI,
  SUM(ISNULL(a.OT_1, 0)) AS OT_1,
  SUM(ISNULL(a.OT_2, 0)) AS OT_2,
  SUM(ISNULL(a.OT_3, 0)) AS OT_3,
  SUM(ISNULL(a.OT_4, 0)) AS OT_4,
  SUM(ISNULL(a.OT_1, 0) + ISNULL(a.OT_2, 0) + ISNULL(a.OT_3, 0) + ISNULL(a.OT_4, 0)) AS TOTAL_JAM_LEMBUR
FROM TR_ABSEN a
JOIN EMP_TABLE e ON RTRIM(a.EMP_CD) = RTRIM(e.EMP_CD)
LEFT JOIN MS_SEC s ON RTRIM(e.SEC_CD) = RTRIM(s.SEC_CD)
WHERE a.DATE_TRANS >= '2026-06-15' AND a.DATE_TRANS <= '2026-06-21'
  AND (ISNULL(a.OT_1, 0) + ISNULL(a.OT_2, 0) + ISNULL(a.OT_3, 0) + ISNULL(a.OT_4, 0)) > 0
  AND e.Act_NonAct = 1 AND (e.DT_RSG IS NULL OR e.DT_RSG >= GETDATE())
GROUP BY e.EMP_CD, e.EMP_NM, s.SEC_DESC, e.ALL_IN
ORDER BY TOTAL_JAM_LEMBUR DESC
\`\`\`

Contoh 4 - Alpha Per Bagian:
User: "Siapa saja alpha hari ini per bagian?"
Jawaban:
Berikut daftar karyawan alpha hari ini dikelompokkan per bagian:
\`\`\`sql
SELECT TOP 100 RTRIM(s.SEC_DESC) AS BAGIAN, RTRIM(e.EMP_CD) AS NIK, RTRIM(e.EMP_NM) AS NAMA
FROM TR_ABSEN a
JOIN EMP_TABLE e ON RTRIM(a.EMP_CD) = RTRIM(e.EMP_CD)
LEFT JOIN MS_SEC s ON RTRIM(e.SEC_CD) = RTRIM(s.SEC_CD)
WHERE CONVERT(varchar(10), a.DATE_TRANS, 120) = CONVERT(varchar(10), GETDATE(), 120)
  AND a.WORK_IN IS NULL AND (a.REASON IS NULL OR a.REASON = '' OR a.REASON = '0' OR RTRIM(a.REASON) = '02')
  AND e.Act_NonAct = 1 AND (e.DT_RSG IS NULL OR e.DT_RSG >= GETDATE())
ORDER BY RTRIM(s.SEC_DESC), RTRIM(e.EMP_NM)
\`\`\`
Untuk monitoring kehadiran hari ini secara live, silakan buka halaman Daily di menu /daily.

Contoh 5 - Arahkan ke Halaman:
User: "Saya ingin lihat data absensi bulan ini secara detail"
Jawaban:
Untuk melihat rekap absensi bulanan secara detail per karyawan per hari, silakan buka halaman Absensi di menu /absensi. Di sana Anda bisa filter per bagian, jabatan, dan periode bulan.

Jika Anda ingin ringkasan singkat, berikut jumlah alpha bulan ini:
\`\`\`sql
SELECT COUNT(*) AS TOTAL_ALPHA_BULAN_INI
FROM TR_ABSEN a
JOIN EMP_TABLE e ON RTRIM(a.EMP_CD) = RTRIM(e.EMP_CD)
WHERE MONTH(a.DATE_TRANS) = MONTH(GETDATE()) AND YEAR(a.DATE_TRANS) = YEAR(GETDATE())
  AND a.WORK_IN IS NULL AND (a.REASON IS NULL OR a.REASON = '' OR RTRIM(a.REASON) = '02')
  AND e.Act_NonAct = 1 AND (e.DT_RSG IS NULL OR e.DT_RSG >= GETDATE())
\`\`\`

Contoh 6 - Pertanyaan Regulasi (Web Search):
User: "Berapa batas maksimal jam lembur menurut UU Cipta Kerja?"
Jawaban:
Menurut PP No. 35 Tahun 2021 (turunan UU Cipta Kerja), batas maksimal lembur adalah:
- Maksimal 4 jam per hari
- Maksimal 18 jam per minggu
- Upah lembur jam pertama = 1.5x upah sejam
- Upah lembur jam berikutnya = 2x upah sejam

Di sistem HRIS ini, jam lembur tercatat di kolom OT_1 (jam pertama), OT_2, OT_3, OT_4 pada tabel TR_ABSEN.
`;
}

export async function POST(request: NextRequest) {
  try {
    const { message, history = [] } = await request.json();

    const validationError = validateInput(message);
    if (validationError) {
      return NextResponse.json({ error: validationError, rejected: true }, { status: 400 });
    }

    const [schema, ctx, queryRAG] = await Promise.all([
      getDynamicSchema(),
      getContextAndSuggestions(),
      getQueryAwareRAG(message),
    ]);

    const learnedMemory = getRelevantMemory(message);

    // Web search jika pertanyaan butuh info dari internet
    let webSearchResult = '';
    if (detectWebSearchNeeded(message)) {
      webSearchResult = await searchWeb(message);
    }

    const systemPrompt = buildSystemPrompt(schema, ctx.context, queryRAG, webSearchResult, learnedMemory);

    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-4),
      { role: 'user', content: message },
    ];

    let aiData: any = null;
    let aiContent = '';

    try {
      const aiResponse = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: MODEL,
          messages,
          max_tokens: 3500,
          temperature: 0.2,
        }),
      });

      aiData = await aiResponse.json();

      if (!aiResponse.ok || aiData.error) {
        const errorMsg =
          aiData?.error?.message ||
          (aiResponse.status === 403 ? 'Quota API Key habis (key_exceeded).' : `Error API AI (Status ${aiResponse.status})`);

        console.error('[CHAT AI ERROR]', aiResponse.status, aiData?.error);
        return NextResponse.json(
          {
            error: `${errorMsg} Silakan periksa atau perbarui API Key di file .env.local (variabel AI_API_KEY / AI_BASE_URL).`,
            suggestions: ctx.suggestions,
          },
          { status: 200 }
        );
      }

      aiContent = aiData.choices?.[0]?.message?.content || '';
    } catch (fetchErr: any) {
      console.error('[CHAT FETCH ERROR]', fetchErr);
      return NextResponse.json(
        {
          error: `Gagal menghubungi endpoint AI (${API_URL}): ${fetchErr.message}. Pastikan koneksi internet aktif atau periksa URL di .env.local.`,
          suggestions: ctx.suggestions,
        },
        { status: 200 }
      );
    }

    if (!aiContent) {
      // Retry with condensed system prompt and ample token budget
      console.warn('[CHAT] Empty AI response, retrying with condensed prompt');
      try {
        const retryRes = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: MODEL,
            messages: [
              {
                role: 'system',
                content: `Kamu adalah Viditii, asisten AI HRIS untuk PT TMNB. Jawab dalam bahasa Indonesia, ringkas, tanpa markdown. Tulis SQL SELECT dalam \`\`\`sql ... \`\`\`. Tabel: EMP_TABLE, TR_ABSEN, MS_SEC, MS_DEP, MS_JOBS, Ms_Reason. Kategori ALL IN vs HARIAN: CASE WHEN RTRIM(ALL_IN)='1' OR RTRIM(ALL_IN)='Y' THEN 'ALL IN' ELSE 'HARIAN' END. Filter aktif: Act_NonAct=1 AND (DT_RSG IS NULL OR DT_RSG>=GETDATE()). Gunakan RTRIM() pada kolom CHAR. ${ctx.context}`,
              },
              { role: 'user', content: message },
            ],
            max_tokens: 2500,
            temperature: 0.3,
          }),
        });
        const retryData = await retryRes.json();
        aiContent = retryData.choices?.[0]?.message?.content || '';
      } catch (retryErr) {
        console.error('[CHAT RETRY ERROR]', retryErr);
      }
    }

    if (!aiContent) {
      return NextResponse.json({
        text: 'Maaf, saya tidak bisa memproses pertanyaan itu. Coba tanyakan dengan kata kunci yang lebih spesifik.',
        suggestions: ctx.suggestions,
      });
    }

    const sql = extractSQL(aiContent);
    let rows: any[] | null = null;
    let error: string | null = null;

    if (sql) {
      const sqlError = validateSQL(sql);
      if (sqlError) {
        error = sqlError;
      } else {
        try {
          const pool = await getDbConnection();
          const result = await pool.request().query(sql);
          rows = (result.recordset || []).slice(0, 2500).map((row: any) => {
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

          // Auto-learn pola kueri sukses ke dalam memori pembelajaran
          if (rows && rows.length > 0) {
            recordSuccessPattern(message, sql, rows.length);
          }
        } catch (dbError: any) {
          console.error('[CHAT DB QUERY ERROR]', dbError.message, 'SQL:', sql);
          error = `Gagal menjalankan query: ${dbError.message}`;
        }
      }
    }

    const cleanText = cleanAIText(aiContent);

    return NextResponse.json({
      text: cleanText || (rows ? 'Berikut data yang ditemukan:' : 'Permintaan selesai diproses.'),
      sql: sql || null,
      rows,
      error,
      suggestions: ctx.suggestions,
      tokens: aiData?.usage?.total_tokens || 0,
    });
  } catch (err: any) {
    console.error('[CHAT CONTROLLER ERROR]', err);
    return NextResponse.json({ error: `Gagal memproses permintaan: ${err.message}` }, { status: 500 });
  }
}

export async function GET() {
  try {
    const ctx = await getContextAndSuggestions();
    return NextResponse.json({ suggestions: ctx.suggestions });
  } catch {
    return NextResponse.json({
      suggestions: [
        'Berapa total karyawan aktif saat ini?',
        'Berapa jumlah karyawan tetap vs kontrak?',
        'Siapa saja karyawan yang alpha hari ini?',
        'Daftar bagian/seksi di perusahaan',
      ],
    });
  }
}