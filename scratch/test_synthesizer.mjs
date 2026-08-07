function synthesizeRowsResponse(userPrompt, sql, rows) {
  if (!rows || rows.length === 0) {
    if (/terlambat|telat|late/i.test(userPrompt)) {
      return 'Tidak ada karyawan yang tercatat datang terlambat untuk periode/tanggal yang dipilih. Seluruh karyawan hadir tepat waktu.';
    }
    if (/alpha|absen|mangkir|tidak hadir/i.test(userPrompt)) {
      return 'Tidak ada karyawan yang tercatat alpha (tanpa keterangan) untuk periode/tanggal yang dipilih.';
    }
    if (/lembur|overtime|ot/i.test(userPrompt)) {
      return 'Tidak ditemukan data lembur untuk kriteria atau periode yang diminta.';
    }
    return 'Tidak ada data yang ditemukan di sistem HRIS untuk kriteria pencarian tersebut.';
  }

  // 1. Single aggregate value (e.g. SELECT COUNT(*) AS TOTAL_AKTIF)
  if (rows.length === 1 && Object.keys(rows[0]).length <= 2) {
    const r = rows[0];
    const key = Object.keys(r)[0];
    const val = r[key];
    const num = typeof val === 'number' ? val.toLocaleString('id-ID') : val;
    
    if (/total.*aktif|jumlah.*aktif/i.test(userPrompt)) {
      return `Berdasarkan data terkini di sistem HRIS, terdapat total **${num} karyawan aktif** di PT TMNB.`;
    }
    if (/alpha/i.test(userPrompt)) {
      return `Jumlah karyawan yang tercatat alpha pada periode ini adalah **${num} orang**.`;
    }
    return `Berdasarkan data di sistem HRIS, nilai **${key.replace(/_/g, ' ')}** adalah **${num}**.`;
  }

  // 2. Keterlambatan (Late Employees)
  if (/terlambat|telat|late/i.test(userPrompt) || rows.some(r => 'MENIT_TERLAMBAT' in r || 'Time_Late' in r)) {
    const count = rows.length;
    const topRows = rows.slice(0, 10);
    const avgLate = Math.round(rows.reduce((acc, r) => acc + (Number(r.MENIT_TERLAMBAT || r.Time_Late || 0)), 0) / count);

    let text = `Hari ini tercatat sebanyak **${count.toLocaleString('id-ID')} karyawan** yang datang terlambat (rata-rata keterlambatan **${avgLate} menit**).\n\n`;
    text += `**Daftar Karyawan Terlambat (Urutan Terlama):**\n`;
    
    topRows.forEach((r, i) => {
      const nik = r.NIK || r.EMP_CD || '';
      const nama = r.NAMA || r.EMP_NM || '-';
      const bagian = r.BAGIAN || r.SEC_DESC || '';
      const jabatan = r.JABATAN || r.JOB_DESC || '';
      const jamMasuk = r.JAM_MASUK || r.WORK_IN || '';
      const menit = r.MENIT_TERLAMBAT ?? r.Time_Late ?? 0;
      
      const partBagian = bagian ? ` (${bagian}${jabatan ? ` - ${jabatan}` : ''})` : '';
      const partJam = jamMasuk ? `, Masuk: ${jamMasuk}` : '';
      text += `${i + 1}. **${nama}**${nik ? ` (NIK: ${nik})` : ''}${partBagian} — Terlambat **${menit} menit**${partJam}\n`;
    });

    if (count > 10) {
      text += `\n*...dan ${count - 10} karyawan lainnya.*`;
    }
    return text.trim();
  }

  // 3. Alpha / Ketidakhadiran
  if (/alpha|absen|mangkir|tidak hadir/i.test(userPrompt) || rows.some(r => r.STATUS_HARI === 'ALPHA' || r.REASON === '02')) {
    const count = rows.length;
    const topRows = rows.slice(0, 15);
    
    let text = `Tercatat sebanyak **${count.toLocaleString('id-ID')} karyawan** yang tidak hadir (alpha / tanpa keterangan):\n\n`;
    topRows.forEach((r, i) => {
      const nik = r.NIK || r.EMP_CD || '';
      const nama = r.NAMA || r.EMP_NM || '-';
      const bagian = r.BAGIAN || r.SEC_DESC || '';
      const jabatan = r.JABATAN || r.JOB_DESC || '';
      const partBagian = bagian ? ` — ${bagian}${jabatan ? ` (${jabatan})` : ''}` : '';
      text += `${i + 1}. **${nama}**${nik ? ` (NIK: ${nik})` : ''}${partBagian}\n`;
    });

    if (count > 15) {
      text += `\n*...dan ${count - 15} karyawan lainnya.*`;
    }
    return text.trim();
  }

  // 4. Lembur / Overtime
  if (/lembur|overtime|ot/i.test(userPrompt) || rows.some(r => 'TOTAL_JAM_LEMBUR' in r || 'OT_1' in r)) {
    const count = rows.length;
    const topRows = rows.slice(0, 10);
    const totalJam = Math.round(rows.reduce((acc, r) => acc + (Number(r.TOTAL_JAM_LEMBUR || 0)), 0));

    let text = `Tercatat sebanyak **${count.toLocaleString('id-ID')} karyawan** dengan total akumulasi lembur **${totalJam.toLocaleString('id-ID')} jam**.\n\n`;
    text += `**Karyawan dengan Jam Lembur Tertinggi:**\n`;
    
    topRows.forEach((r, i) => {
      const nik = r.NIK || r.EMP_CD || '';
      const nama = r.NAMA || r.EMP_NM || '-';
      const bagian = r.BAGIAN || r.SEC_DESC || '';
      const kategori = r.KATEGORI || '';
      const jam = r.TOTAL_JAM_LEMBUR ?? 0;
      
      const partBagian = bagian ? ` (${bagian}${kategori ? ` - ${kategori}` : ''})` : '';
      text += `${i + 1}. **${nama}**${nik ? ` (NIK: ${nik})` : ''}${partBagian} — **${jam} Jam** Lembur\n`;
    });

    if (count > 10) {
      text += `\n*...dan ${count - 10} karyawan lainnya.*`;
    }
    return text.trim();
  }

  // 5. Performa Terbaik (ALL IN & HARIAN)
  if (/performa|terbaik|rajin|ranking|juara/i.test(userPrompt) || rows.some(r => 'RANK_KATEGORI' in r || 'KATEGORI' in r)) {
    const allIn = rows.filter(r => (r.KATEGORI || '').toUpperCase().includes('ALL IN')).slice(0, 5);
    const harian = rows.filter(r => (r.KATEGORI || '').toUpperCase().includes('HARIAN')).slice(0, 5);

    let text = `Berikut rangkuman peringkat performa karyawan terbaik berdasarkan tingkat kehadiran dan kontribusi:\n\n`;
    
    if (allIn.length > 0) {
      text += `**Kategori ALL IN (Staf & Manajerial):**\n`;
      allIn.forEach((r, i) => {
        text += `${i + 1}. **${r.NAMA || r.EMP_NM}** (${r.BAGIAN || '-'}) — Hadir: **${r.TOTAL_HADIR || 0} hari**, Telat: **${r.TOTAL_TERLAMBAT_MENIT || 0} mnt**\n`;
      });
      text += `\n`;
    }

    if (harian.length > 0) {
      text += `**Kategori HARIAN (Produksi & Operasional):**\n`;
      harian.forEach((r, i) => {
        text += `${i + 1}. **${r.NAMA || r.EMP_NM}** (${r.BAGIAN || '-'}) — Hadir: **${r.TOTAL_HADIR || 0} hari**, Lembur: **${r.TOTAL_JAM_LEMBUR || 0} jam**\n`;
      });
    }
    return text.trim();
  }

  // 6. Generic List Formatter (e.g. bagian, jabatan, karyawan)
  const count = rows.length;
  const topRows = rows.slice(0, 10);
  let text = `Berikut data yang ditemukan (**${count.toLocaleString('id-ID')} data**):\n\n`;
  
  topRows.forEach((r, i) => {
    const nama = r.NAMA || r.EMP_NM || r.BAGIAN || r.SEC_DESC || r.DEP_DESC || Object.values(r)[0];
    const second = r.BAGIAN || r.SEC_DESC || r.JABATAN || r.JOB_DESC || (Object.values(r)[1] !== nama ? Object.values(r)[1] : '');
    const third = r.TOTAL || r.JUMLAH || r.TOTAL_KARYAWAN || r.GAJI_POKOK || '';
    
    let line = `${i + 1}. **${nama}**`;
    if (second) line += ` — ${second}`;
    if (third) line += ` (${typeof third === 'number' ? third.toLocaleString('id-ID') : third})`;
    text += line + '\n';
  });

  if (count > 10) {
    text += `\n*...dan ${count - 10} data lainnya.*`;
  }
  return text.trim();
}

// Test sample data
const sampleLate = [
  { NIK: '24054619', NAMA: 'RIZKI NOER ARROHMAN', BAGIAN: 'Warehouse', JABATAN: 'Operator', JAM_MASUK: '16:03', MENIT_TERLAMBAT: 15 },
  { NIK: '24074744', NAMA: 'ROBIN', BAGIAN: 'Warehouse', JABATAN: 'Operator', JAM_MASUK: '16:03', MENIT_TERLAMBAT: 12 },
  { NIK: '24054593', NAMA: 'DURAHMAN', BAGIAN: 'Warehouse', JABATAN: 'Operator', JAM_MASUK: '16:03', MENIT_TERLAMBAT: 8 },
];

console.log('--- SYNTHESIZED OUTPUT FOR "Daftar karyawan terlambat hari ini" ---');
console.log(synthesizeRowsResponse('Daftar karyawan terlambat hari ini', 'SELECT ...', sampleLate));
