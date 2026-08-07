import * as xlsx from 'xlsx';

const EXCEL_PATH = 'D:/Ricky not Kiki/HRIS Widy/JADWAL_SECURITY_2026.xlsx';

function readLegend() {
  const wb = xlsx.readFile(EXCEL_PATH);
  const sheet = wb.Sheets['JULI 2026'];
  const data = xlsx.utils.sheet_to_json<any[]>(sheet, { header: 1 });
  console.log('--- LEGEND & NOTES (JULI 2026) ---');
  for (let r = 24; r < data.length; r++) {
    if (data[r] && data[r].some(x => x !== null && x !== '')) {
      console.log(`Row ${r}:`, JSON.stringify(data[r]));
    }
  }
}

readLegend();
