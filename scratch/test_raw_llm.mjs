async function testLLM() {
  const url = 'https://bandelbanget.xyz/v1/chat/completions';
  const key = 'sk-qwen-753ac2e4be15fce1802f744c769e8636ee5632a4a409dba5';

  const systemPrompt = `Kamu adalah Viditii, asisten AI HRIS untuk PT TMNB.
ATURAN RESPONS:
1. Jika user meminta DATA spesifik (jumlah, daftar, rekap, statistik, siapa, berapa, performa, lembur, absensi) → Jelaskan dan terangkan temuan data secara NARATIF, komunikatif, dan ringkas (sebutkan total karyawan, perbandingan angka, dan sorotan kunci/peringkat teratas secara poin kalimat).
2. DILARANG membuat tabel markdown raksasa atau tabel ASCII di dalam chat agar tampilan chat tetap bersih dan rapi.
3. SELALU sertakan query SQL yang sesuai di dalam format blok SQL (\`\`\`sql ... \`\`\`) agar sistem dapat memvalidasi dan mengambil data riil dari database.
4. Jawab pertanyaan user secara langsung, lugas, dan to the point. JANGAN menambahkan teks penawaran unduh Excel atau arahan menu lain kecuali user secara spesifik memintanya.
5. JANGAN PERNAH generate SQL INSERT/UPDATE/DELETE/DROP/ALTER.
6. Jawab dalam bahasa Indonesia, ramah, profesional, dan jelas.
7. DILARANG KERAS menyebutkan nama tabel database atau istilah teknis seperti "query SQL", "kueri SQL", "tabel database".

SCHEMA DATABASE:
- EMP_TABLE: EMP_CD, EMP_NM, SEC_CD, DEP_CD, JOB_CD, JNS_KRY, ALL_IN, Act_NonAct, DT_ENTRY, DT_RSG, SX, BS_SLR, T1, T3, T4, T5
- TR_ABSEN: DATE_TRANS, EMP_CD, EMP_NM, SEC_CD, WORK_IN, WORK_OUT, JAM_KERJA, REASON, STATUS_HARI, OT_1, OT_2, OT_3, OT_4, T_OT, Time_Late, U_MAKAN, U_TRANSPORT
- MS_SEC: SEC_CD, SEC_DESC, GRP_CD
- MS_DEP: DEP_CD, DEP_DESC
- MS_JOBS: JOB_CD, JOB_DESC
`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'deepseek-v4-pro',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: 'Daftar karyawan terlambat hari ini' }
        ],
        temperature: 0.1,
      })
    });

    const data = await res.json();
    console.log('Model response:\n', data.choices[0].message.content);
  } catch (err) {
    console.error('Fetch error:', err);
  }
}

testLLM();
