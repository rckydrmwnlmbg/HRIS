// Native fetch in Node 18+

const AI_BASE_URL = 'https://bandelbanget.xyz/v1/chat/completions';
const AI_API_KEY = 'sk-qwen-753ac2e4be15fce1802f744c769e8636ee5632a4a409dba5';
const AI_MODEL = 'deepseek-v4-pro';

const SYSTEM_PROMPT = `Kamu adalah Viditii, asisten AI HRIS untuk PT TMNB.

⚠️ PERINGATAN PENTING — NAMA KOLOM DATABASE ⚠️
HANYA gunakan nama kolom ini. JANGAN MENGARANG:
- EMP_TABLE: EMP_CD, EMP_NM, SEC_CD, DEP_CD, JOB_CD, JNS_KRY, ALL_IN, Act_NonAct, DT_ENTRY, DT_RSG, SX, BS_SLR, T1, T3, T4, T5
- TR_ABSEN: DATE_TRANS, EMP_CD, EMP_NM, SEC_CD, WORK_IN, WORK_OUT, JAM_KERJA, REASON, STATUS_HARI, OT_1, OT_2, OT_3, OT_4, T_OT, Time_Late, U_MAKAN, U_TRANSPORT
- MS_SEC: SEC_CD, SEC_DESC, GRP_CD
- MS_DEP: DEP_CD, DEP_DESC
- MS_JOBS: JOB_CD, JOB_DESC
- Ms_Reason: REASON_CODE, REASON_DESC, REASON_GROUP
- MSJNS_KRY: JNS_CODE, JNS_DESC
- tblCUTI: EMP_CD, EMP_NM, AWAL_CUTI, AKHIR_CUTI, REASON, REMARK, LM_CUTI
- TR_LEMBUR_ALLIN: DATE_TRANS, EMP_CD, JAM_MULAI, JAM_SELESAI, NOMINAL
- TR_SPL_PLAN: DATE_TRANS, LINE_ID, JOB_DESC, JAM_17_OPR, JAM_18_OPR, JAM_19_OPR, JAM_20_OPR, STATUS_DOC
- MS_LIBUR_KERJA: TANGGAL, KETERANGAN

ATURAN RESPONS:
1. Jika user meminta DATA spesifik (jumlah, daftar, rekap, statistik, siapa, berapa, performa, lembur, absensi) → Jelaskan dan terangkan temuan data secara NARATIF, komunikatif, dan ringkas (sebutkan total karyawan, perbandingan angka, dan sorotan kunci/peringkat teratas secara poin kalimat).
2. DILARANG membuat tabel markdown raksasa atau tabel ASCII di dalam chat agar tampilan chat tetap bersih dan rapi.
3. SELALU sertakan query SQL yang sesuai di dalam format blok SQL (\`\`\`sql ... \`\`\`) agar sistem dapat memvalidasi dan mengambil data riil dari database.
4. Jika user bertanya KONSEP/PENJELASAN (apa itu, bagaimana cara, jelaskan, aturan) → jawab teks naratif saja, JANGAN generate SQL.
5. Jawab pertanyaan user secara langsung, lugas, dan to the point. JANGAN menambahkan teks penawaran unduh Excel atau arahan menu lain kecuali user secara spesifik memintanya.
6. JANGAN PERNAH generate SQL INSERT/UPDATE/DELETE/DROP/ALTER.
7. Jawab dalam bahasa Indonesia, ramah, profesional, dan jelas.
8. STRUKTUR & SPASING PENULISAN (SANGAT PENTING):
- Buat tulisan yang SANGAT RAPI dan ENAK DIBACA dengan pemisahan baris (enter) dan spasi yang jelas.
- Pisahkan paragraf pembuka, poin rincian, dan paragraf penutup menggunakan DUA KALI ENTER (\\n\\n).
- Gunakan poin berbutir (- ) atau bernomor (1. , 2. ) untuk merinci data, angka komponen gaji, kehadiran, atau perbandingan status. Setiap poin WAJIB berada di baris tersendiri.
- Gunakan format tebal (**Kata Kunci**) untuk nama karyawan, NIK, nominal rupiah, total angka, atau bagian agar mudah dipindai pembaca.
- JANGAN PERNAH menyatukan semua informasi ke dalam satu baris panjang tanpa enter!
9. BAHASA ALAMI & BEBAS DARI ISTILAH TEKNIS / NAMA TABEL (SANGAT PENTING):
- DILARANG KERAS menyebutkan nama tabel database (seperti EMP_TABLE, TR_ABSEN, MS_SEC, MS_DEP, tblCUTI, dll.) di dalam teks narasi jawaban kepada pengguna.
- DILARANG menyebutkan nama kolom kode teknis (seperti EMP_CD, BS_SLR, T1, T3, T4, T5, JNS_KRY, Act_NonAct, DATE_TRANS, dll.) atau istilah teknis programming / SQL (seperti query, join, select, database schema, dsb.).
- Gunakan bahasa HR dan manajemen yang natural, ramah, dan profesional.
`;

const SCENARIOS = [
  { id: '1', category: 'Keterlambatan', prompt: 'Daftar karyawan terlambat hari ini' },
  { id: '2', category: 'Total Karyawan', prompt: 'Berapa total karyawan aktif saat ini dan perbandingan tetap vs kontrak?' },
  { id: '3', category: 'Alpha / Absen', prompt: 'Siapa saja karyawan yang tidak hadir (alpha) hari ini?' },
  { id: '4', category: 'Lembur', prompt: 'Siapa karyawan yang memiliki jam lembur terbanyak bulan ini?' },
  { id: '5', category: 'Profil & Gaji', prompt: 'Berapa rincian gaji dan status karyawan Widya Etika?' },
  { id: '6', category: 'Departemen', prompt: 'Berapa jumlah karyawan di bagian Warehouse dan Sewing?' },
  { id: '7', category: 'Performa', prompt: 'Tolong list performa karyawan terbaik kategori ALL IN dan HARIAN bulan ini' },
  { id: '8', category: 'Cuti', prompt: 'Siapa saja karyawan yang sedang mengambil cuti?' },
  { id: '9', category: 'Konseptual HR', prompt: 'Apa perbedaan mendasar antara sistem lembur karyawan ALL IN dan Harian?' },
  { id: '10', category: 'Sapaan & Bantuan', prompt: 'Halo Viditii, selamat pagi! Apa saja yang bisa kamu bantu?' },
];

function extractSQL(response) {
  const match = response.match(/```(?:sql|tsql)?\s*([\s\S]*?)(?:```|$)/i);
  if (match) {
    let raw = match[1].trim();
    if (raw.endsWith(';')) raw = raw.slice(0, -1).trim();
    if (/^\s*(SELECT|WITH)\b/i.test(raw) && /\bFROM\b/i.test(raw)) {
      return raw;
    }
  }
  return null;
}

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

async function runScenario(s) {
  console.log(`\n======================================================`);
  console.log(`[TEST ${s.id}] [${s.category}] "${s.prompt}"`);

  const start = Date.now();
  try {
    const res = await fetch(AI_BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${AI_API_KEY}`,
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: s.prompt },
        ],
        temperature: 0.1,
        max_tokens: 1500,
      }),
      timeout: 30000,
    });

    if (!res.ok) {
      const errText = await res.text();
      console.log(`❌ API Error HTTP ${res.status}: ${errText}`);
      return;
    }

    const json = await res.json();
    const rawContent = json.choices?.[0]?.message?.content || '';
    const elapsed = ((Date.now() - start) / 1000).toFixed(2);

    const sql = extractSQL(rawContent);
    const cleanedText = cleanAIText(rawContent);

    console.log(`⏱️ Selesai dalam ${elapsed}s`);
    if (sql) {
      console.log(`\n🔍 [SQL Terdeteksi]:\n${sql}`);
    } else {
      console.log(`\n💬 [Non-SQL / Respon Naratif Langsung]`);
    }

    console.log(`\n📝 [Teks Bersih yang Tampil ke User]:\n${cleanedText}`);

    // Checklist Evaluasi Kualitas:
    const checks = [];
    if (cleanedText.includes('EMP_TABLE') || cleanedText.includes('TR_ABSEN') || cleanedText.includes('MS_SEC')) {
      checks.push('⚠️ Terdapat kebocoran nama tabel teknis!');
    }
    if (/excel|unduh file|download/i.test(cleanedText)) {
      checks.push('⚠️ Menawarkan file Excel tanpa diminta!');
    }
    if (cleanedText.length < 15) {
      checks.push('⚠️ Respon terlalu pendek / kosong!');
    }
    if (checks.length === 0) {
      console.log(`\n✅ EVALUASI: LULUS (Respon alami, rapi, dan cerdas)`);
    } else {
      console.log(`\n❌ EVALUASI GAGAL:\n` + checks.join('\n'));
    }
  } catch (err) {
    console.log(`❌ Exception: ${err.message}`);
  }
}

async function main() {
  console.log(`Memulai Pengujian 10 Skenario Pertanyaan AI HRIS Viditii...`);
  for (const s of SCENARIOS) {
    await runScenario(s);
  }
}

main();
