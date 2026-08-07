// Simulate the complete logic of route.ts

function cleanAIText(text) {
  if (!text) return '';
  let cleaned = text;
  cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, '');
  cleaned = cleaned.replace(/^Thinking Process:[\s\S]*?(?=\n\n|\n[A-Z]|$)/gi, '');
  cleaned = cleaned.replace(/^(?:The user wants|Let me|I need to|To answer this|Based on the user request)[\s\S]*?(?=(?:Berikut|Halo|Tentu|Berdasarkan|Data|Informasi|Untuk|\n\n[A-Z]))/i, '');
  cleaned = cleaned.replace(/```(?:sql|tsql|[\w]*)\s*[\s\S]*?(?:```|$)/gi, '').trim();
  cleaned = cleaned.replace(/```/g, '').trim();
  cleaned = cleaned.replace(/(?:Berikut|Di bawah ini|Ini adalah|Berikut ini)?\s*(?:adalah\s+)?(?:query|kueri|query\s+SQL|kueri\s+SQL)\s*(?:yang\s+digunakan|untuk\s+mengambil|nya)?\s*[:.]?\s*$/gim, '').trim();
  cleaned = cleaned.replace(/Berdasarkan query yang saya siapkan[^\n]*\n?/gi, '').trim();
  cleaned = cleaned.replace(/Berikut query SQL yang digunakan[^\n]*\n?/gi, '').trim();
  cleaned = cleaned.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  return cleaned;
}

function synthesizeRowsResponse(userPrompt, sql, rows) {
  if (!rows) return null;
  const p = userPrompt.toLowerCase();

  if (rows.length === 0) {
    if (/terlambat|telat|late/i.test(p)) {
      return 'Tidak ada karyawan yang tercatat datang terlambat untuk hari/periode ini. Seluruh karyawan yang hadir tercatat tepat waktu.';
    }
    if (/alpha|absen|mangkir|tidak hadir|belum hadir/i.test(p)) {
      return 'Tidak ada karyawan yang tercatat alpha (tanpa keterangan) untuk hari/periode yang dipilih.';
    }
    if (/lembur|overtime|ot\b|spl/i.test(p)) {
      return 'Tidak ditemukan catatan lembur untuk kriteria atau periode yang diminta.';
    }
    if (/cuti|ijin|izin|sakit/i.test(p)) {
      return 'Tidak ada data cuti atau izin/sakit yang tercatat untuk periode yang dipilih.';
    }
    return 'Tidak ada data yang ditemukan di sistem HRIS untuk kriteria pencarian tersebut.';
  }

  if (rows.length === 1) {
    const keys = Object.keys(rows[0]);
    if (keys.length === 1 || (keys.length === 2 && keys.some(k => /total|jumlah|count|avg|sum/i.test(k)))) {
      const mainKey = keys.find(k => /total|jumlah|count|avg|sum/i.test(k)) || keys[0];
      const val = rows[0][mainKey];
      const formattedVal = typeof val === 'number' ? val.toLocaleString('id-ID') : val;

      if (/total.*aktif|jumlah.*aktif|karyawan.*aktif/i.test(p)) {
        return `Saat ini terdapat total **${formattedVal} karyawan aktif** di sistem HRIS PT TMNB.`;
      }
      if (/alpha|absen/i.test(p)) {
        return `Jumlah karyawan yang tercatat alpha pada periode ini adalah **${formattedVal} orang**.`;
      }
      if (/lembur/i.test(p)) {
        return `Total akumulasi jam lembur pada periode tersebut adalah **${formattedVal} jam**.`;
      }
      return `Berdasarkan data di sistem HRIS, total **${mainKey.replace(/_/g, ' ')}** adalah **${formattedVal}**.`;
    }
  }

  if (/terlambat|telat|late/i.test(p) || rows.some(r => 'MENIT_TERLAMBAT' in r || 'Time_Late' in r || 'JAM_MASUK' in r)) {
    const count = rows.length;
    const topRows = rows.slice(0, 15);
    const avgLate = Math.round(
      rows.reduce((acc, r) => acc + Number(r.MENIT_TERLAMBAT ?? r.Time_Late ?? 0), 0) / count
    );

    let text = `Hari ini tercatat sebanyak **${count.toLocaleString('id-ID')} karyawan** yang datang terlambat (rata-rata keterlambatan **${avgLate} menit**).\n\n`;
    text += `**Daftar Karyawan Terlambat (Urutan Terlama):**\n`;

    topRows.forEach((r, i) => {
      const nik = r.NIK || r.EMP_CD || '';
      const nama = r.NAMA || r.EMP_NM || '-';
      const bagian = r.BAGIAN || r.SEC_DESC || '';
      const jabatan = r.JABATAN || r.JOB_DESC || '';
      const jamMasuk = r.JAM_MASUK || (r.WORK_IN ? String(r.WORK_IN).slice(11, 16) : '');
      const menit = r.MENIT_TERLAMBAT ?? r.Time_Late ?? 0;

      const partBagian = bagian ? ` (${bagian}${jabatan ? ` - ${jabatan}` : ''})` : '';
      const partJam = jamMasuk ? `, Masuk: ${jamMasuk}` : '';
      text += `${i + 1}. **${nama}**${nik ? ` (NIK: ${nik})` : ''}${partBagian} — Terlambat **${menit} menit**${partJam}\n`;
    });

    if (count > 15) {
      text += `\n*...dan ${count - 15} karyawan lainnya tercatat terlambat.*`;
    }
    return text.trim();
  }

  return null;
}

// Test Case 1: Terlambat with data
console.log('=== TEST 1: Daftar Karyawan Terlambat Hari Ini (Ada Data) ===');
const sampleLate = [
  { NIK: '24054619', NAMA: 'RIZKI NOER ARROHMAN', BAGIAN: 'Warehouse', JABATAN: 'Operator', JAM_MASUK: '16:03', MENIT_TERLAMBAT: 15 },
  { NIK: '24074744', NAMA: 'ROBIN', BAGIAN: 'Warehouse', JABATAN: 'Operator', JAM_MASUK: '16:03', MENIT_TERLAMBAT: 12 },
  { NIK: '24054593', NAMA: 'DURAHMAN', BAGIAN: 'Warehouse', JABATAN: 'Operator', JAM_MASUK: '16:03', MENIT_TERLAMBAT: 8 },
];
console.log(synthesizeRowsResponse('Daftar karyawan terlambat hari ini', 'SELECT ...', sampleLate));

// Test Case 2: Terlambat 0 data
console.log('\n=== TEST 2: Daftar Karyawan Terlambat Hari Ini (0 Data) ===');
console.log(synthesizeRowsResponse('Daftar karyawan terlambat hari ini', 'SELECT ...', []));

// Test Case 3: Total Karyawan Aktif
console.log('\n=== TEST 3: Total Karyawan Aktif ===');
console.log(synthesizeRowsResponse('Berapa total karyawan aktif?', 'SELECT ...', [{ TOTAL_AKTIF: 1966 }]));
