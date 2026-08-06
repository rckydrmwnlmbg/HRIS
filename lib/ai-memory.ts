import fs from 'fs';
import path from 'path';

export interface GlossaryItem {
  term: string;
  meaning: string;
  added_at: string;
}

export interface LearnedPattern {
  id: string;
  keywords: string[];
  intent: string;
  sql_snippet: string;
  usage_count: number;
  likes: number;
  dislikes: number;
  last_used: string;
}

export interface UserCorrection {
  id: string;
  topic: string;
  correction: string;
  source: string;
  created_at: string;
}

export interface AIMemoryData {
  version: number;
  last_updated: string;
  glossary: GlossaryItem[];
  learned_patterns: LearnedPattern[];
  user_corrections: UserCorrection[];
}

const MEMORY_FILE_PATH = path.join(process.cwd(), 'data', 'ai_memory.json');

const DEFAULT_MEMORY: AIMemoryData = {
  version: 1,
  last_updated: new Date().toISOString(),
  glossary: [
    { term: 'anak gudang', meaning: 'Bagian WAREHOUSE, FABRIC, ACCESSORIES, MATERIAL MGMT', added_at: '2026-08-06' },
    { term: 'seksi jahit', meaning: 'Bagian SEWING (Line 01 s/d Line 18, BUTTON, PATTERN SEAMER)', added_at: '2026-08-06' },
    { term: 'seksi potong', meaning: 'Bagian CUTTING (CUTTING, GELAR, MARKER, NUMBERING, RELAX, BANDLELING)', added_at: '2026-08-06' },
    { term: 'spv', meaning: 'Supervisor / Kepala Bagian (kategori ALL IN tunjangan tetap)', added_at: '2026-08-06' },
    { term: 'mekanik', meaning: 'Bagian MEKANIK / Maintenance mesin pabrik', added_at: '2026-08-06' },
  ],
  learned_patterns: [
    {
      id: 'perf-allin-harian',
      keywords: ['performa', 'terbaik', 'all in', 'harian', 'rajin'],
      intent: 'Ranking berimbang karyawan terbaik kategori ALL IN (kehadiran 23 hari) dan Harian (lembur tertinggi) menggunakan CTE ROW_NUMBER() PARTITION BY KATEGORI',
      sql_snippet: 'WITH PerfRank AS (...) SELECT NIK, NAMA, BAGIAN, KATEGORI, TOTAL_HADIR, TOTAL_TERLAMBAT_MENIT, TOTAL_JAM_LEMBUR FROM PerfRank WHERE RANK_KATEGORI <= 15',
      usage_count: 5,
      likes: 3,
      dislikes: 0,
      last_used: '2026-08-06',
    },
    {
      id: 'lembur-mingguan-full',
      keywords: ['lembur', 'minggu', 'rekap lembur', 'data lembur'],
      intent: 'Tarik seluruh karyawan yang lembur pada periode tanggal tanpa limit SELECT TOP 100 agar user dapat mengunduh seluruh data (misal 1.640 karyawan) ke Excel',
      sql_snippet: 'SELECT RTRIM(e.EMP_CD) AS NIK, ... SUM(OT_1+OT_2+OT_3+OT_4) AS TOTAL_JAM_LEMBUR FROM TR_ABSEN a JOIN EMP_TABLE e ... WHERE DATE_TRANS BETWEEN ... GROUP BY ... ORDER BY TOTAL_JAM_LEMBUR DESC',
      usage_count: 5,
      likes: 3,
      dislikes: 0,
      last_used: '2026-08-06',
    },
  ],
  user_corrections: [
    {
      id: 'corr-act-nonact',
      topic: 'Filter Karyawan Aktif',
      correction: 'Wajib gunakan: e.Act_NonAct = 1 AND (e.DT_RSG IS NULL OR CONVERT(varchar(10), e.DT_RSG, 120) >= CONVERT(varchar(10), GETDATE(), 120)) karena ada 1.270 mantan karyawan dengan DT_RSG lampau.',
      source: 'user_correction',
      created_at: '2026-08-06',
    },
    {
      id: 'corr-precise-alpha-holiday',
      topic: 'Definisi Alpha vs Hari Libur di TR_ABSEN',
      correction: 'Alpha/mangkir hanya dihitung saat a.WORK_IN IS NULL AND UPPER(RTRIM(ISNULL(a.STATUS_HARI,\'\'))) = \'KERJA\' AND (a.REASON IS NULL OR RTRIM(a.REASON) = \'\' OR RTRIM(a.REASON) = \'0\' OR RTRIM(a.REASON) = \'02\'). Hari libur mingguan/nasional (STATUS_HARI LIKE \'%LIBUR%\') BUKAN ALPHA!',
      source: 'user_correction',
      created_at: '2026-08-06',
    },
    {
      id: 'corr-prorata-hire-date',
      topic: 'Tanggal Masuk Kerja & Rekap Absensi',
      correction: 'Jika karyawan mulai bekerja di pertengahan bulan (misal DT_ENTRY = 2026-06-11), kehadiran dihitung sejak tanggal masuk kerja, bukan dari awal bulan. Tanggal sebelumnya bukan mangkir.',
      source: 'user_correction',
      created_at: '2026-08-06',
    },
    {
      id: 'corr-no-tables-in-chat',
      topic: 'Tampilan Obrolan',
      correction: 'Jangan tampilkan tabel di dalam chat bubble karena sempit. Terangkan temuan secara naratif dan serahkan data tabel lengkap ke tombol Unduh Laporan Lengkap Excel.',
      source: 'user_correction',
      created_at: '2026-08-06',
    },
  ],
};

export function loadMemory(): AIMemoryData {
  try {
    const dir = path.dirname(MEMORY_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(MEMORY_FILE_PATH)) {
      fs.writeFileSync(MEMORY_FILE_PATH, JSON.stringify(DEFAULT_MEMORY, null, 2), 'utf8');
      return DEFAULT_MEMORY;
    }
    const content = fs.readFileSync(MEMORY_FILE_PATH, 'utf8');
    return JSON.parse(content);
  } catch (err) {
    console.error('[AI MEMORY LOAD ERROR]', err);
    return DEFAULT_MEMORY;
  }
}

export function saveMemory(data: AIMemoryData): void {
  try {
    const dir = path.dirname(MEMORY_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    data.last_updated = new Date().toISOString();
    fs.writeFileSync(MEMORY_FILE_PATH, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('[AI MEMORY SAVE ERROR]', err);
  }
}

/**
 * Mencari memori pembelajaran yang relevan berdasarkan prompt pengguna untuk disuntikkan ke prompt LLM.
 */
export function getRelevantMemory(userPrompt: string): string {
  const memory = loadMemory();
  const lowerPrompt = userPrompt.toLowerCase();
  const matchedGlossary: GlossaryItem[] = [];
  const matchedPatterns: LearnedPattern[] = [];
  const matchedCorrections: UserCorrection[] = [...memory.user_corrections]; // Selalu sertakan koreksi penting

  // 1. Scan Glossary
  for (const item of memory.glossary) {
    if (lowerPrompt.includes(item.term.toLowerCase())) {
      matchedGlossary.push(item);
    }
  }

  // 2. Scan Patterns
  for (const pattern of memory.learned_patterns) {
    const matchCount = pattern.keywords.filter(k => lowerPrompt.includes(k.toLowerCase())).length;
    if (matchCount >= 2 || pattern.keywords.some(k => lowerPrompt.includes(k.toLowerCase()))) {
      matchedPatterns.push(pattern);
    }
  }

  let memoryContext = 'MEMORI PEMBELAJARAN AI (DARI PENGALAMAN SEBELUMNYA):\n';

  if (matchedGlossary.length > 0) {
    memoryContext += '- Istilah/Alias Pabrik yang Dipelajari:\n';
    matchedGlossary.forEach(g => {
      memoryContext += `  * "${g.term}" berarti: ${g.meaning}\n`;
    });
  }

  if (matchedCorrections.length > 0) {
    memoryContext += '- Catatan Koreksi & Aturan Penting Pengguna:\n';
    matchedCorrections.forEach(c => {
      memoryContext += `  * [${c.topic}]: ${c.correction}\n`;
    });
  }

  if (matchedPatterns.length > 0) {
    memoryContext += '- Pola Sukses yang Telah Teruji:\n';
    matchedPatterns.forEach(p => {
      memoryContext += `  * Intent: ${p.intent} (Pola SQL: ${p.sql_snippet})\n`;
    });
  }

  return memoryContext;
}

/**
 * Merekam pola kueri sukses yang menghasilkan data valid.
 */
export function recordSuccessPattern(prompt: string, sql: string, rowCount: number): void {
  try {
    if (!prompt || !sql || rowCount === 0) return;
    const memory = loadMemory();
    const lowerPrompt = prompt.toLowerCase();
    const words = lowerPrompt.replace(/[^\w\s]/g, '').split(/\s+/).filter(w => w.length > 3);

    // Cek apakah pattern sudah ada
    const existing = memory.learned_patterns.find(p =>
      p.keywords.some(k => lowerPrompt.includes(k)) && (p.sql_snippet.slice(0, 30) === sql.slice(0, 30))
    );

    if (existing) {
      existing.usage_count += 1;
      existing.last_used = new Date().toISOString().slice(0, 10);
    } else {
      const newPattern: LearnedPattern = {
        id: `pat-${Date.now()}`,
        keywords: words.slice(0, 5),
        intent: `Pola kueri sukses untuk permintaan "${prompt.slice(0, 60)}"`,
        sql_snippet: sql.replace(/\s+/g, ' ').slice(0, 150),
        usage_count: 1,
        likes: 1,
        dislikes: 0,
        last_used: new Date().toISOString().slice(0, 10),
      };
      memory.learned_patterns.push(newPattern);
      // Batasi maksimal 50 pattern teratas
      if (memory.learned_patterns.length > 50) {
        memory.learned_patterns.sort((a, b) => b.usage_count - a.usage_count);
        memory.learned_patterns = memory.learned_patterns.slice(0, 50);
      }
    }
    saveMemory(memory);
  } catch (err) {
    console.error('[AI MEMORY RECORD SUCCESS ERROR]', err);
  }
}

/**
 * Mencatat feedback (like/dislike) dan koreksi langsung dari pengguna.
 */
export function recordUserFeedback(
  prompt: string,
  sql: string | undefined,
  rating: 'like' | 'dislike',
  note?: string
): void {
  try {
    const memory = loadMemory();
    const lowerPrompt = (prompt || '').toLowerCase();

    // Cari pattern terkait jika ada
    const pattern = memory.learned_patterns.find(p =>
      p.keywords.some(k => lowerPrompt.includes(k))
    );

    if (pattern) {
      if (rating === 'like') pattern.likes += 1;
      if (rating === 'dislike') pattern.dislikes += 1;
    }

    if (note && note.trim()) {
      const newCorrection: UserCorrection = {
        id: `corr-${Date.now()}`,
        topic: `Koreksi untuk "${prompt ? prompt.slice(0, 40) : 'Umum'}"`,
        correction: note.trim(),
        source: 'user_feedback_ui',
        created_at: new Date().toISOString().slice(0, 10),
      };
      memory.user_corrections.push(newCorrection);
    }

    saveMemory(memory);
  } catch (err) {
    console.error('[AI MEMORY RECORD FEEDBACK ERROR]', err);
  }
}
