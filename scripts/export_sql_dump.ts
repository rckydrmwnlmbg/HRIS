import fs from 'fs';
import path from 'path';
import { generateAllData } from './seed_supabase';

async function exportSql() {
  const data = await generateAllData();
  const filePath = path.resolve(process.cwd(), 'supabase_seed.sql');
  const stream = fs.createWriteStream(filePath, { encoding: 'utf8' });

  console.log('Menulis file supabase_seed.sql...');

  stream.write('-- =============================================================================\n');
  stream.write('-- SEED DATA DUMMY HRIS UNTUK SUPABASE (POSTGRESQL)\n');
  stream.write('-- Total: 500 Karyawan, 6 Bulan Presensi, Master Data, Cuti & Lembur All-In\n');
  stream.write('-- =============================================================================\n\n');

  // 1. Master Departemen
  stream.write('-- 1. MS_DEP\n');
  for (const d of data.departments) {
    stream.write(`INSERT INTO MS_DEP (DEP_CD, DEP_DESC) VALUES ('${d.code}', '${d.name}') ON CONFLICT (DEP_CD) DO UPDATE SET DEP_DESC = EXCLUDED.DEP_DESC;\n`);
  }
  stream.write('\n');

  // 2. Master Seksi
  stream.write('-- 2. MS_SEC\n');
  for (const s of data.sections) {
    stream.write(`INSERT INTO MS_SEC (SEC_CD, SEC_DESC, GRP_CD) VALUES ('${s.code}', '${s.desc}', '${s.dep}') ON CONFLICT (SEC_CD) DO UPDATE SET SEC_DESC = EXCLUDED.SEC_DESC;\n`);
  }
  stream.write('\n');

  // 3. Master Jabatan
  stream.write('-- 3. MS_JOBS\n');
  for (const j of data.jobs) {
    stream.write(`INSERT INTO MS_JOBS (JOB_CD, JOB_DESC) VALUES ('${j.code}', '${j.desc}') ON CONFLICT (JOB_CD) DO UPDATE SET JOB_DESC = EXCLUDED.JOB_DESC;\n`);
  }
  stream.write('\n');

  // 4. Master Libur
  stream.write('-- 4. MS_LIBUR_KERJA\n');
  for (const [tgl, ket] of Object.entries(data.holidays)) {
    const escapedKet = ket.replace(/'/g, "''");
    stream.write(`INSERT INTO MS_LIBUR_KERJA (TANGGAL, KETERANGAN, COMPANY_CODE, STATUS_LIBUR, FLAG_PAY) VALUES ('${tgl}', '${escapedKet}', '01', '1', '1') ON CONFLICT (TANGGAL) DO UPDATE SET KETERANGAN = EXCLUDED.KETERANGAN;\n`);
  }
  stream.write('\n');

  // 5. Master Alasan
  stream.write('-- 5. Ms_Reason\n');
  const reasons = [
    { c: '18', d: 'Cuti Tahunan', g: 'C' },
    { c: '02', d: 'Sakit Surat Dokter', g: 'S' },
    { c: '05', d: 'Cuti Melahirkan / Haid', g: 'H' },
    { c: '03', d: 'Izin Resmi Pribadi', g: 'I' },
    { c: 'A', d: 'Alpha / Mangkir', g: 'A' },
    { c: 'O', d: 'Dinas Luar', g: 'O' },
  ];
  for (const r of reasons) {
    stream.write(`INSERT INTO Ms_Reason (REASON_CODE, REASON_DESC, REASON_GROUP) VALUES ('${r.c}', '${r.d}', '${r.g}') ON CONFLICT (REASON_CODE) DO NOTHING;\n`);
  }
  stream.write('\n');

  // 6. Master Shift
  stream.write('-- 6. msSHIFT\n');
  stream.write(`INSERT INTO msSHIFT (shift_CODE, keterangan, WORK_IN, WORK_OUT, STD_JAM) VALUES ('1', 'Shift 1 Normal', '1900-01-01 07:07:00', '1900-01-01 16:00:00', 8.00) ON CONFLICT DO NOTHING;\n`);
  stream.write(`INSERT INTO msSHIFT (shift_CODE, keterangan, WORK_IN, WORK_OUT, STD_JAM) VALUES ('S1', 'Shift Security Pagi', '1900-01-01 07:00:00', '1900-01-01 15:00:00', 8.00) ON CONFLICT DO NOTHING;\n`);
  stream.write(`INSERT INTO msSHIFT (shift_CODE, keterangan, WORK_IN, WORK_OUT, STD_JAM) VALUES ('S2', 'Shift Security Sore', '1900-01-01 15:00:00', '1900-01-01 23:00:00', 8.00) ON CONFLICT DO NOTHING;\n`);
  stream.write(`INSERT INTO msSHIFT (shift_CODE, keterangan, WORK_IN, WORK_OUT, STD_JAM) VALUES ('S3', 'Shift Security Malam', '1900-01-01 23:00:00', '1900-01-01 07:00:00', 8.00) ON CONFLICT DO NOTHING;\n\n`);

  // 7. Karyawan (EMP_TABLE)
  stream.write('-- 7. EMP_TABLE (500 Karyawan)\n');
  const chunkSizeEmp = 50;
  for (let i = 0; i < data.employees.length; i += chunkSizeEmp) {
    const chunk = data.employees.slice(i, i + chunkSizeEmp);
    stream.write('INSERT INTO EMP_TABLE (EMP_CD, EMP_NM, DEP_CD, SEC_CD, JOB_CD, DIV_CD, JNS_KRY, Act_NonAct, DT_ENTRY, DT_RSG, DT_BRT, PLC_BRT, ADRR, CT, SX, agama, telepon, noktp, NPWP, PTKP_ST, ALL_IN, BS_SLR) VALUES\n');
    const rowsSql = chunk.map((e, idx) => {
      const rsgVal = e.DT_RSG ? `'${e.DT_RSG}'` : 'NULL';
      const adrrEsc = e.ADRR.replace(/'/g, "''");
      const nameEsc = e.EMP_NM.replace(/'/g, "''");
      return `  ('${e.EMP_CD}', '${nameEsc}', '${e.DEP_CD}', '${e.SEC_CD}', '${e.JOB_CD}', '${e.DIV_CD}', '${e.JNS_KRY}', ${e.Act_NonAct ? 'TRUE' : 'FALSE'}, '${e.DT_ENTRY}', ${rsgVal}, '${e.DT_BRT}', '${e.PLC_BRT}', '${adrrEsc}', '${e.CT}', '${e.SX}', '${e.agama}', '${e.telepon}', '${e.noktp}', '${e.NPWP}', '${e.PTKP_ST}', '${e.ALL_IN}', ${e.BS_SLR})`;
    });
    stream.write(rowsSql.join(',\n') + '\nON CONFLICT (EMP_CD) DO NOTHING;\n\n');
  }

  // 8. Cuti (tblCUTI & tbldetcuti)
  stream.write('-- 8. tblCUTI & tbldetcuti\n');
  for (const c of data.cutiMasters) {
    const remarkEsc = c.REMARK.replace(/'/g, "''");
    stream.write(`INSERT INTO tblCUTI (EMP_CD, EMP_NM, AWAL_CUTI, AKHIR_CUTI, REASON, REMARK, LM_CUTI) VALUES ('${c.EMP_CD}', '${c.EMP_NM.replace(/'/g, "''")}', '${c.AWAL_CUTI}', '${c.AKHIR_CUTI}', '${c.REASON}', '${remarkEsc}', ${c.LM_CUTI});\n`);
  }
  for (const d of data.cutiDetails) {
    stream.write(`INSERT INTO tbldetcuti (EMP_CD, EMP_NM, TGL_CUTI, REASON) VALUES ('${d.EMP_CD}', '${d.EMP_NM.replace(/'/g, "''")}', '${d.TGL_CUTI}', '${d.REASON}') ON CONFLICT (EMP_CD, TGL_CUTI) DO NOTHING;\n`);
  }
  stream.write('\n');

  // 9. Lembur All-In (TR_LEMBUR_ALLIN)
  stream.write('-- 9. TR_LEMBUR_ALLIN\n');
  for (const l of data.allInLembur) {
    stream.write(`INSERT INTO TR_LEMBUR_ALLIN (DATE_TRANS, EMP_CD, JAM_MULAI, JAM_SELESAI, NOMINAL, CREATED_BY) VALUES ('${l.DATE_TRANS}', '${l.EMP_CD}', '${l.JAM_MULAI}', '${l.JAM_SELESAI}', ${l.NOMINAL}, '${l.CREATED_BY}');\n`);
  }
  stream.write('\n');

  // 10. Presensi (TR_ABSEN) dalam Chunks of 500 baris
  stream.write('-- 10. TR_ABSEN (79.000+ Baris Transaksi Presensi)\n');
  const chunkSizeAbsen = 500;
  for (let i = 0; i < data.attendances.length; i += chunkSizeAbsen) {
    const chunk = data.attendances.slice(i, i + chunkSizeAbsen);
    stream.write('INSERT INTO TR_ABSEN (DATE_TRANS, EMP_CD, EMP_NM, SEC_CD, SHIFT, STATUS_HARI, WORK_IN, WORK_OUT, JAM_MASUK, JAM_PULANG, JAM_KERJA, REASON, OT_1, OT_2, Time_Late) VALUES\n');
    const rowsSql = chunk.map(a => {
      const inVal = a.WORK_IN ? `'${a.WORK_IN}'` : 'NULL';
      const outVal = a.WORK_OUT ? `'${a.WORK_OUT}'` : 'NULL';
      const jMasukVal = a.JAM_MASUK ? `'${a.JAM_MASUK}'` : 'NULL';
      const jPulangVal = a.JAM_PULANG ? `'${a.JAM_PULANG}'` : 'NULL';
      const rsnVal = a.REASON ? `'${a.REASON}'` : 'NULL';
      const nmEsc = a.EMP_NM ? a.EMP_NM.replace(/'/g, "''") : '';
      return `  ('${a.DATE_TRANS}', '${a.EMP_CD}', '${nmEsc}', '${a.SEC_CD}', '${a.SHIFT}', '${a.STATUS_HARI}', ${inVal}, ${outVal}, ${jMasukVal}, ${jPulangVal}, ${a.JAM_KERJA}, ${rsnVal}, ${a.OT_1}, ${a.OT_2}, ${a.Time_Late})`;
    });
    stream.write(rowsSql.join(',\n') + '\nON CONFLICT (EMP_CD, DATE_TRANS) DO NOTHING;\n\n');
  }

  stream.end();
  console.log('Selesai membuat supabase_seed.sql!');
}

exportSql().catch(console.error);
