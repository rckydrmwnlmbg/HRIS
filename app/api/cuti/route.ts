import { NextResponse } from 'next/server';
import { query, withTransaction } from '@/lib/db';
import { appendFile } from 'fs/promises';
import path from 'path';

/**
 * Menandai jenis ketidakhadiran HANYA lewat kolom REASON.
 *
 * STATUS_HARI di TR_ABSEN cuma punya 2 nilai valid menurut INUS: 'KERJA' dan 'LIBUR'.
 * Tidak ada 'CUTI'. Dibuktikan dari scan PMS2+.exe (78x 'LIBUR', 46x 'KERJA', 0x 'CUTI')
 * dan dari data nyata: 32.702 baris REASON='18' dan 11.784 baris REASON='02' semuanya
 * ber-STATUS_HARI='KERJA'.
 *
 * Kalkulasi payroll/OT memfilter STATUS_HARI='KERJA', jadi menulis 'CUTI' membuat baris
 * terlewat dari perhitungan tanpa memunculkan error apa pun.
 */
const STATUS_HARI_CUTI = 'KERJA';

/**
 * Audit trail ke file log (Opsi a).
 *
 * TIDAK memakai TR_AUDIT_ABSEN karena tabel itu tidak ada di database, dan scan binary
 * menunjukkan INUS sendiri tidak pernah menyebut tabel audit apa pun. Insert ke tabel
 * yang tidak ada akan membuat transaksi rollback sehingga SELURUH input cuti gagal.
 *
 * CATATAN UNTUK NANTI: begitu TR_AUDIT_ABSEN benar-benar dibuat di DB kantor, fungsi ini
 * perlu diarahkan ke sana, dan keberhasilan insert-nya WAJIB diverifikasi lewat query
 * nyata -- jangan diasumsikan berhasil.
 *
 * Sengaja dipanggil SETELAH commit dan dibungkus try/catch sendiri: kegagalan menulis log
 * tidak boleh menggagalkan input cuti yang sudah sah tersimpan.
 */
async function auditLog(action: string, detail: Record<string, any>) {
  try {
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      action,
      ...detail,
    }) + '\n';
    await appendFile(path.join(process.cwd(), 'audit-cuti.log'), line, 'utf8');
  } catch (err) {
    console.error('Gagal menulis audit log (input cuti tetap tersimpan):', err);
  }
}

/**
 * Daftar SEMUA tanggal kalender dalam rentang cuti, termasuk Sabtu & Minggu.
 *
 * Kenapa weekend disertakan (sebelumnya dilewati):
 *
 *   1. SECURITY BEKERJA WEEKEND. Versi lama melewati Sabtu/Minggu, sehingga cuti Security
 *      di weekend tidak pernah masuk tbldetcuti. Akibatnya baris TR_ABSEN weekend mereka
 *      tidak punya pasangan, dan justru akan di-NULL-kan saat INUS sinkronisasi -- persis
 *      bug yang sedang kita perbaiki.
 *
 *   2. INUS SENDIRI MENGISI SEMUA TANGGAL, lalu membersihkan hari libur di tahap berikutnya
 *      lewat `UPDATE tr_absen SET reason='' WHERE status_hari='LIBUR'`. Jadi baris weekend
 *      untuk karyawan biasa tidak menimbulkan masalah: dibersihkan INUS sendiri.
 *
 *   3. Konsisten dengan backfill_tbldetcuti.sql yang juga mengisi semua tanggal kalender.
 *      Kalau berbeda, hasil web dan hasil backfill tidak bisa dibandingkan.
 *
 * Catatan LM_CUTI: nilainya kini jumlah SEMUA hari dalam rentang, bukan hanya hari kerja.
 * Ini justru sesuai kolomnya ("lama cuti") dan cocok dengan cara INUS menghitung.
 */
function datesInRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const curr = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');

  while (curr <= end) {
    // Format lokal, bukan toISOString(), supaya tidak bergeser sehari karena UTC.
    const y = curr.getFullYear();
    const m = String(curr.getMonth() + 1).padStart(2, '0');
    const d = String(curr.getDate()).padStart(2, '0');
    dates.push(`${y}-${m}-${d}`);

    curr.setDate(curr.getDate() + 1);
  }
  return dates;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tahun = searchParams.get('tahun') || new Date().getFullYear();
    const emp = searchParams.get('emp');

    let queryStr = `
      SELECT 
        RTRIM(a.EMP_CD) AS EMP_CD,
        RTRIM(e.EMP_NM) AS EMP_NM,
        CONVERT(varchar(10), a.DATE_TRANS, 120) AS dateStr,
        RTRIM(a.STATUS_HARI) AS typeCode,
        RTRIM(a.REASON) AS reasonCode,
        RTRIM(mr.REASON_DESC) AS reasonDesc,
        RTRIM(mr.REASON_GROUP) AS reasonGroup,
        RTRIM(e.SEC_CD) AS SEC_CD,
        RTRIM(s.SEC_DESC) AS SEC_DESC,
        RTRIM(e.DEP_CD) AS DEP_CD,
        RTRIM(d.DEP_DESC) AS DEP_DESC,
        RTRIM(e.JOB_CD) AS JOB_CD,
        RTRIM(j.JOB_DESC) AS JOB_DESC,
        CASE   WHEN UPPER(RTRIM(s.SEC_DESC)) LIKE '%LINE%' THEN 'SEWING'   WHEN RTRIM(s.SEC_DESC) IN ('BUTTON', 'PATTERN SEAMER') THEN 'SEWING'   WHEN RTRIM(s.SEC_DESC) IN ('BANDLELING', 'CUTTING', 'GANTI BS', 'GELAR', 'GELAR INTERLINING', 'LOADING', 'MARKER', 'NUMBERING', 'PIPING', 'PRESS', 'RELAX') THEN 'CUTTING'   WHEN RTRIM(s.SEC_DESC) IN ('MEKANIK') THEN 'MECHANIC'   WHEN RTRIM(s.SEC_DESC) IN ('LAB', 'PSO', 'QA', 'QC ACCURACY') THEN 'QA'   WHEN RTRIM(s.SEC_DESC) IN ('IE') THEN 'IE'   WHEN RTRIM(s.SEC_DESC) IN ('ACCESSORIES', 'FABRIC', 'IT INVENTORY', 'MATERIAL MGMT', 'TRANSFER') THEN 'WAREHOUSE'   WHEN RTRIM(s.SEC_DESC) IN ('IRONING') THEN 'FINISHING'   WHEN RTRIM(s.SEC_DESC) IN ('PACKING', 'WAREHOUSE') THEN 'PACKING'   WHEN RTRIM(s.SEC_DESC) IN ('END LINE', 'END LINE SPARE', 'IN LINE', 'QC CUTTING', 'QC FABRIC', 'QC FINISHING', 'QC SEWING', 'QC SIZESPEC') THEN 'QC'   WHEN RTRIM(s.SEC_DESC) IN ('ORDER MGMT.') THEN 'PPIC'   WHEN RTRIM(s.SEC_DESC) IN ('CAD MARKER', 'CAD PATTERN', 'SAMPLE', 'SEWING PATTERN') THEN 'SAMPLE'   WHEN RTRIM(s.SEC_DESC) IN ('OFFICE PRODUKSI') THEN 'PROD.  OFFICE'   WHEN RTRIM(s.SEC_DESC) IN ('CLINIC', 'COMPLIANCE', 'HR') THEN 'HRC'   WHEN RTRIM(s.SEC_DESC) IN ('ACC/FIN', 'ACCOUNTING', 'FINANCE', 'PURCHASE') THEN 'ACCOUNTING'   WHEN RTRIM(s.SEC_DESC) IN ('EXIM', 'EXPORT', 'IMPORT', 'SUB-CON') THEN 'EXIM'   WHEN RTRIM(s.SEC_DESC) IN ('5 S', 'IT') THEN 'GA'   WHEN RTRIM(s.SEC_DESC) IN ('COOK', 'CS', 'DRIVER', 'SECURITY') THEN 'GA SERVICE'   WHEN RTRIM(s.SEC_DESC) IN ('UMUM', 'UTILITY') THEN 'MAINTENANCE'   ELSE RTRIM(d.DEP_DESC) END AS TEAM
      FROM TR_ABSEN a
      LEFT JOIN EMP_TABLE e ON a.EMP_CD = e.EMP_CD
      LEFT JOIN MS_SEC s ON e.SEC_CD = s.SEC_CD
      LEFT JOIN MS_DEP d ON e.DEP_CD = d.DEP_CD
      LEFT JOIN MS_JOBS j ON e.JOB_CD = j.JOB_CD
      LEFT JOIN Ms_Reason mr ON RTRIM(a.REASON) = RTRIM(mr.REASON_CODE)
      WHERE 
        -- Deteksi cuti/izin/sakit LEWAT REASON, bukan STATUS_HARI.
        -- Baris cuti sekarang ber-STATUS_HARI='KERJA' (pola asli INUS), jadi filter lama
        -- yang mencari STATUS_HARI IN ('C','H','CUTI','S','I') tidak akan menemukan apa pun.
        -- Nilai 'CUTI' tetap disertakan supaya 4 baris lama buatan web versi sebelumnya
        -- masih tampil di riwayat sampai dibersihkan.
        (RTRIM(mr.REASON_GROUP) IN ('C', 'H', 'S', 'I')
         OR RTRIM(a.STATUS_HARI) IN ('C', 'H', 'CUTI', 'S', 'I')
         OR RTRIM(a.STATUS_HARI) LIKE 'CUTI%')
    `;

    if (emp) {
      queryStr += ` AND RTRIM(a.EMP_CD) = '${emp.trim().replace(/'/g, "''")}'`;
    }

    queryStr += ` AND a.DATE_TRANS >= '${tahun}-01-01' AND a.DATE_TRANS <= '${tahun}-12-31'`;
    queryStr += ` AND a.WORK_IN IS NULL AND a.WORK_OUT IS NULL`;
    queryStr += ` ORDER BY a.EMP_CD, a.DATE_TRANS ASC`;

    const result = await query<any>(queryStr);

    // Grouping contiguous dates for each employee
    const groupedRecords: any[] = [];
    let currentGroup: any = null;

    for (const row of result) {
      if (!currentGroup) {
        currentGroup = {
          EMP_CD: row.EMP_CD,
          EMP_NM: row.EMP_NM,
          startDate: row.dateStr,
          endDate: row.dateStr,
          typeCode: row.typeCode,
          reasonCode: row.reasonCode,
          reasonDesc: row.reasonDesc,
          reasonGroup: row.reasonGroup,
          type: row.reasonDesc ? row.reasonDesc : (row.typeCode || 'Unknown'),
          reason: row.reasonDesc ? `${row.reasonDesc} (${row.reasonCode || '-'})` : (row.reasonCode || '-'),
          days: 1,
          SEC_CD: row.SEC_CD,
          SEC_DESC: row.SEC_DESC,
          DEP_CD: row.DEP_CD,
          DEP_DESC: row.DEP_DESC,
          JOB_CD: row.JOB_CD,
          JOB_DESC: row.JOB_DESC
        };
      } else {
        const prevDate = new Date(currentGroup.endDate);
        const currDate = new Date(row.dateStr);
        const diffTime = Math.abs(currDate.getTime() - prevDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (row.EMP_CD === currentGroup.EMP_CD && row.typeCode === currentGroup.typeCode && row.reasonCode === currentGroup.reasonCode && diffDays === 1) {
          // contiguous day
          currentGroup.endDate = row.dateStr;
          currentGroup.days += 1;
        } else {
          // push and start new group
          groupedRecords.push(currentGroup);
          currentGroup = {
            EMP_CD: row.EMP_CD,
            EMP_NM: row.EMP_NM,
            startDate: row.dateStr,
            endDate: row.dateStr,
            typeCode: row.typeCode,
            reasonCode: row.reasonCode,
            reasonDesc: row.reasonDesc,
            reasonGroup: row.reasonGroup,
            type: row.reasonDesc ? row.reasonDesc : (row.typeCode || 'Unknown'),
            reason: row.reasonDesc ? `${row.reasonDesc} (${row.reasonCode || '-'})` : (row.reasonCode || '-'),
            days: 1,
            SEC_CD: row.SEC_CD,
            SEC_DESC: row.SEC_DESC,
            DEP_CD: row.DEP_CD,
            DEP_DESC: row.DEP_DESC,
            JOB_CD: row.JOB_CD,
            JOB_DESC: row.JOB_DESC
          };
        }
      }
    }
    if (currentGroup) {
      groupedRecords.push(currentGroup);
    }

    // Sort the final result by startDate DESC
    groupedRecords.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());

    const records = groupedRecords.map((r: any, index: number) => ({
      ...r,
      id: index + 1,
      status: 'approved'
    }));

    return NextResponse.json(records);
  } catch (error: any) {
    console.error('API /cuti GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Menyimpan cuti mengikuti ALUR RESMI INUS (3 langkah), bukan menulis manual ke TR_ABSEN.
 *
 * Kenapa harus ikut alur resmi: tombol "Update Reason/Leave" di INUS membangun ulang REASON
 * di TR_ABSEN dari tbldetcuti. Kalau tbldetcuti kosong, sub-query berkorelasinya menghasilkan
 * NULL sehingga REASON hasil input web TERHAPUS. Ini bukan teori -- sudah terjadi pada
 * EMP_CD 26066995 rentang 7-10 Juli.
 *
 * Urutan langkah:
 *   1. INSERT tblCUTI
 *   2. Pastikan baris TR_ABSEN ada (UPDATE di langkah 4 butuh baris yang sudah ada)
 *   3. INSERT tbldetcuti, satu baris per tanggal
 *   4. Sinkronisasi REASON ke TR_ABSEN meniru query resmi INUS
 * Semuanya dalam SATU transaksi supaya tidak ada state setengah jadi.
 */
export async function POST(request: Request) {
  try {
    const data = await request.json();

    const empCd = String(data.EMP_CD ?? '').trim();
    const empNm = String(data.EMP_NM ?? '').trim();
    const reasonCode = String(data.type ?? '').trim();
    const remark = String(data.reason ?? '');
    const startDate = String(data.startDate ?? '').trim();
    const endDate = String(data.endDate ?? '').trim();

    if (!empCd || !reasonCode || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'EMP_CD, jenis cuti, tanggal mulai dan tanggal selesai wajib diisi' },
        { status: 400 }
      );
    }

    const dates = datesInRange(startDate, endDate);
    if (dates.length === 0) {
      // Hanya terjadi kalau endDate lebih awal dari startDate.
      return NextResponse.json(
        { error: 'Rentang tanggal tidak valid: tanggal selesai lebih awal dari tanggal mulai' },
        { status: 400 }
      );
    }

    // Validasi Tumpang-tindih (Overlap)
    // Jika karyawan sudah memiliki cuti yang rentangnya beririsan dengan input baru, form ditolak.
    // Ini krusial untuk mencegah Error PK (Primary Key) di INUS.
    const overlapCheck = await query<any>(
      `SELECT TOP 1 CONVERT(varchar(10), AWAL_CUTI, 120) AS AWAL_CUTI, CONVERT(varchar(10), AKHIR_CUTI, 120) AS AKHIR_CUTI
       FROM tblCUTI 
       WHERE RTRIM(EMP_CD) = '${empCd.replace(/'/g, "''")}'
         AND AWAL_CUTI <= '${endDate}' 
         AND AKHIR_CUTI >= '${startDate}'`
    );

    if (overlapCheck && overlapCheck.length > 0) {
      return NextResponse.json(
        { error: `Karyawan ini sudah memiliki cuti pada rentang tersebut (${overlapCheck[0].AWAL_CUTI} s.d ${overlapCheck[0].AKHIR_CUTI}). Silakan HAPUS data lama terlebih dahulu jika ini adalah koreksi.` },
        { status: 400 }
      );
    }

    await withTransaction(async (tx) => {
      // ---- LANGKAH 1: tblCUTI ----
      // HR_MG / HR_LBR tetap 0. Sudah diverifikasi di database: dari seluruh baris tblCUTI
      // (termasuk yang dibuat INUS) tidak ada satu pun yang nilainya bukan 0.
      await tx(
        `INSERT INTO tblCUTI
           (EMP_CD, EMP_NM, AWAL_CUTI, AKHIR_CUTI, REASON, REMARK, LM_CUTI, HR_MG, HR_LBR)
         VALUES (@empCd, @empNm, @awal, @akhir, @reason, @remark, @lama, 0, 0)`,
        {
          empCd,
          empNm,
          awal: startDate,
          akhir: endDate,
          reason: reasonCode,
          remark,
          lama: dates.length,
        }
      );

      // SHIFT harus diisi sendiri. Alur tbldetcuti / "Update Reason/Leave" HANYA menyentuh
      // REASON, tidak pernah SHIFT. Kalau dibiarkan NULL, INUS crash.
      const shiftRows = await tx<{ SHIFT: string }>(
        `SELECT TOP 1 RTRIM(SHIFT) AS SHIFT FROM TR_ABSEN
          WHERE RTRIM(EMP_CD) = @empCd AND SHIFT IS NOT NULL AND RTRIM(SHIFT) <> ''
          ORDER BY DATE_TRANS DESC`,
        { empCd }
      );
      const shiftVal = shiftRows?.[0]?.SHIFT || '1';

      for (const dateStr of dates) {
        // ---- LANGKAH 2: pastikan baris TR_ABSEN ada ----
        // MERGE + HOLDLOCK, bukan IF EXISTS ... ELSE INSERT. Pola lama punya celah race
        // condition: dua request bersamaan bisa lolos IF EXISTS serentak lalu sama-sama INSERT.
        //
        // Penting: pada WHEN MATCHED, STATUS_HARI TIDAK disentuh. Kalau INUS sudah menandai
        // baris itu 'LIBUR', menimpanya jadi 'KERJA' akan merusak data hari libur.
        await tx(
          `MERGE TR_ABSEN WITH (HOLDLOCK) AS target
             USING (SELECT @empCd AS EMP_CD, @dateTrans AS DATE_TRANS) AS src
                ON RTRIM(target.EMP_CD) = src.EMP_CD AND target.DATE_TRANS = src.DATE_TRANS
           WHEN MATCHED THEN
             UPDATE SET target.SHIFT = ISNULL(NULLIF(RTRIM(target.SHIFT), ''), @shift)
           WHEN NOT MATCHED THEN
             INSERT (EMP_CD, EMP_NM, DATE_TRANS, STATUS_HARI, SHIFT)
             VALUES (@empCd, @empNm, @dateTrans, @statusHari, @shift);`,
          { empCd, empNm, dateTrans: dateStr, shift: shiftVal, statusHari: STATUS_HARI_CUTI }
        );

        // ---- LANGKAH 3: tbldetcuti ----
        // DELETE dulu supaya idempoten (input ulang tidak menumpuk baris).
        //
        // INUS memakai `delete from tbldetcuti` TANPA WHERE -- menghapus seluruh tabel.
        // Kita TIDAK meniru itu; DELETE dibatasi ke karyawan + tanggal ini saja, karena
        // wipe total akan menghancurkan data cuti karyawan lain.
        await tx(
          `DELETE FROM tbldetcuti
            WHERE RTRIM(EMP_CD) = @empCd AND TGL_CUTI = @dateTrans`,
          { empCd, dateTrans: dateStr }
        );
        await tx(
          `INSERT INTO tbldetcuti (EMP_CD, EMP_NM, TGL_CUTI, REASON)
           VALUES (@empCd, @empNm, @dateTrans, @reason)`,
          { empCd, empNm, dateTrans: dateStr, reason: reasonCode }
        );
      }

      // ---- LANGKAH 4: sinkronisasi REASON ke TR_ABSEN ----
      // Meniru query resmi INUS, termasuk COLLATE Latin1_General_CI_AS (wajib: tanpa ini
      // join antar kolom dengan collation berbeda akan error).
      //
      // Dua penyimpangan keamanan dari query asli INUS, keduanya disengaja:
      //   1. `RTRIM(EMP_CD) = @empCd` -- query asli TIDAK punya filter karyawan sehingga
      //      menyentuh SEMUA karyawan dalam rentang tanggal.
      //   2. `AND EXISTS (...)` -- mencegah sub-query yang tidak menemukan pasangan menulis
      //      NULL. Tanpa guard ini kita mengulang bug yang justru sedang diperbaiki.
      await tx(
        `UPDATE tr_absen
            SET reason = (SELECT d.REASON FROM tbldetcuti d
                           WHERE d.EMP_CD COLLATE Latin1_General_CI_AS = tr_absen.EMP_CD
                             AND tr_absen.DATE_TRANS = d.TGL_CUTI)
          WHERE RTRIM(EMP_CD) = @empCd
            AND DATE_TRANS >= @awal AND DATE_TRANS <= @akhir
            AND EXISTS (SELECT 1 FROM tbldetcuti d
                         WHERE d.EMP_CD COLLATE Latin1_General_CI_AS = tr_absen.EMP_CD
                           AND d.TGL_CUTI = tr_absen.DATE_TRANS)`,
        { empCd, awal: startDate, akhir: endDate }
      );
    });

    // ---- LANGKAH 5: audit trail (setelah commit) ----
    await auditLog('CUTI_CREATE', {
      empCd,
      empNm,
      reasonCode,
      startDate,
      endDate,
      days: dates.length,
      dates,
    });

    return NextResponse.json({ success: true, days: dates.length });
  } catch (error: any) {
    console.error('API /cuti POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Menghapus data cuti dari KETIGA tabel.
 *
 * Versi sebelumnya hanya membersihkan tblCUTI dan TR_ABSEN, meninggalkan baris yatim di
 * tbldetcuti. Baris yatim itu akan MEMUNCULKAN KEMBALI cuti yang sudah dihapus begitu
 * operator menekan "Update Reason/Leave" di INUS.
 */
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const empCd = searchParams.get('emp')?.trim();
    const startDate = searchParams.get('start')?.trim();
    const endDate = searchParams.get('end')?.trim();

    if (!empCd || !startDate || !endDate) {
      return NextResponse.json({ error: 'Parameter emp, start, end wajib diisi' }, { status: 400 });
    }

    await withTransaction(async (tx) => {
      // 1. tblCUTI
      await tx(
        `DELETE FROM tblCUTI
          WHERE RTRIM(EMP_CD) = @empCd AND AWAL_CUTI = @awal AND AKHIR_CUTI = @akhir`,
        { empCd, awal: startDate, akhir: endDate }
      );

      // 2. tbldetcuti -- wajib, kalau tidak cuti akan muncul kembali saat sinkronisasi INUS.
      await tx(
        `DELETE FROM tbldetcuti
          WHERE RTRIM(EMP_CD) = @empCd AND TGL_CUTI >= @awal AND TGL_CUTI <= @akhir`,
        { empCd, awal: startDate, akhir: endDate }
      );

      // 3. Bersihkan REASON di TR_ABSEN.
      //    STATUS_HARI TIDAK diubah: nilainya sudah 'KERJA' (atau 'LIBUR' kalau INUS yang
      //    menandainya) dan keduanya benar. Versi lama menulis 'O' -- nilai yang tidak
      //    dikenal INUS, hanya muncul 2x di seluruh data.
      //
      //    Guard WORK_IN/WORK_OUT IS NULL dipertahankan: kalau ternyata ada jam fingerprint,
      //    berarti karyawan benar-benar masuk kerja dan barisnya jangan disentuh.
      await tx(
        `UPDATE TR_ABSEN
            SET REASON = ''
          WHERE RTRIM(EMP_CD) = @empCd
            AND DATE_TRANS >= @awal AND DATE_TRANS <= @akhir
            AND WORK_IN IS NULL AND WORK_OUT IS NULL`,
        { empCd, awal: startDate, akhir: endDate }
      );
    });

    await auditLog('CUTI_DELETE', { empCd, startDate, endDate });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('API /cuti DELETE error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
