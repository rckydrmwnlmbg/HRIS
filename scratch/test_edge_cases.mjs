// Edge Cases & Informal Queries Test

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
`;

const EDGE_SCENARIOS = [
  { id: 'E1', prompt: 'ada brp org yg telat hr ini?' },
  { id: 'E2', prompt: 'karyawan cewe sm cowo banyakan mana?' },
  { id: 'E3', prompt: 'karyawan yg gajinya paling gede siapa?' },
  { id: 'E4', prompt: 'gaji nik 24054619' },
  { id: 'E5', prompt: 'rekap lembur kemarin' },
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
  cleaned = cleaned.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  return cleaned;
}

async function runEdgeTest(s) {
  console.log(`\n======================================================`);
  console.log(`[EDGE TEST ${s.id}] User: "${s.prompt}"`);

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
        max_tokens: 1000,
      }),
      timeout: 30000,
    });

    const json = await res.json();
    const rawContent = json.choices?.[0]?.message?.content || '';
    const elapsed = ((Date.now() - start) / 1000).toFixed(2);

    const sql = extractSQL(rawContent);
    const cleanedText = cleanAIText(rawContent);

    console.log(`⏱️ Selesai dalam ${elapsed}s`);
    if (sql) {
      console.log(`🔍 [SQL]:\n${sql}`);
    }
    console.log(`📝 [Respon]:\n${cleanedText}`);
  } catch (err) {
    console.log(`❌ Error: ${err.message}`);
  }
}

async function main() {
  console.log(`Menjalankan Pengujian Edge Cases & Pertanyaan Informal...`);
  for (const s of EDGE_SCENARIOS) {
    await runEdgeTest(s);
  }
}

main();
