import * as xlsx from 'xlsx';
import * as fs from 'fs';

// Path file excel dijaga sesuai instruksi, bisa diubah via ENV nantinya
const EXCEL_PATH = 'D:\\Ricky not Kiki\\HRIS Widy\\JADWAL_SECURITY_2026.xlsx';

let scheduleCache: any = null;

function loadSchedule() {
  if (!fs.existsSync(EXCEL_PATH)) {
    console.warn('File JADWAL_SECURITY_2026.xlsx tidak ditemukan di path:', EXCEL_PATH);
    return null;
  }
  
  try {
    const workbook = xlsx.readFile(EXCEL_PATH);
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = xlsx.utils.sheet_to_json<any[]>(firstSheet, { header: 1 });
    
    // Header bulan ada di baris index 3 (data[3])
    const rowBulan = data[3];
    if (!rowBulan) return null;
    
    // Parse the entire schedule into memory: { "EMP_NM": { "YYYY-MM": ["P1", "P2", "X", ...] } }
    const parsedSchedule: Record<string, Record<string, string[]>> = {};
    
    // Temukan semua blok bulan/tahun di baris ke-3
    const monthBlocks: { name: string, startIdx: number }[] = [];
    for (let i = 0; i < rowBulan.length; i++) {
      if (typeof rowBulan[i] === 'string' && rowBulan[i].match(/(JANUARI|FEBRUARI|MARET|APRIL|MEI|JUNI|JULI|AGUSTUS|SEPTEMBER|OKTOBER|NOVEMBER|DESEMBER) 202/i)) {
        monthBlocks.push({ name: rowBulan[i].trim().toUpperCase(), startIdx: i });
      }
    }
    
    // Populate data untuk setiap karyawan di baris ke-4 dan seterusnya
    for (let r = 4; r < data.length; r++) {
      const row = data[r];
      const empName = row[1]; // Kolom N A M A
      if (!empName || typeof empName !== 'string') continue;
      
      const cleanName = empName.trim().toUpperCase();
      parsedSchedule[cleanName] = {};
      
      monthBlocks.forEach(block => {
        // Ambil array shift (31 hari maksimal per bulan)
        const shifts = row.slice(block.startIdx, block.startIdx + 31).map(s => s ? String(s).trim() : '');
        parsedSchedule[cleanName][block.name] = shifts;
      });
    }
    
    scheduleCache = parsedSchedule;
    return scheduleCache;
  } catch (err) {
    console.error("Gagal load jadwal security:", err);
    return null;
  }
}

const BULAN_INDO = ['JANUARI', 'FEBRUARI', 'MARET', 'APRIL', 'MEI', 'JUNI', 'JULI', 'AGUSTUS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DESEMBER'];

/**
 * Mengambil Shift Code untuk Security (misal 'P1', 'X', 'M') dari file Excel.
 * Mengembalikan 'X' jika tidak ditemukan (Default = Libur / Unknown).
 */
export function getSecurityShift(empNm: string, targetDate: Date): string {
  if (!scheduleCache) loadSchedule();
  if (!scheduleCache) return 'X'; // Fallback aman
  
  const cleanName = empNm.trim().toUpperCase();
  const scheduleData = scheduleCache[cleanName];
  
  if (!scheduleData) {
    // Jika nama tidak ada di Excel, asumsikan bukan security shift atau salah nama
    return 'X'; 
  }
  
  const monthIdx = targetDate.getMonth();
  const year = targetDate.getFullYear();
  const monthName = `${BULAN_INDO[monthIdx]} ${year}`;
  
  const monthSchedule = scheduleData[monthName];
  if (!monthSchedule) return 'X';
  
  const dayIdx = targetDate.getDate() - 1; // 0-indexed (tgl 1 = index 0)
  const shift = monthSchedule[dayIdx];
  
  return shift || 'X';
}
