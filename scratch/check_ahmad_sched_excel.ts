import * as xlsx from 'xlsx';

const EXCEL_PATH = 'D:/Ricky not Kiki/HRIS Widy/JADWAL_SECURITY_2026.xlsx';

function checkAhmadSchedule() {
  const wb = xlsx.readFile(EXCEL_PATH);
  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json<any[]>(sheet, { header: 1 });
    console.log(`\n--- SCHEDULE IN SHEET: ${sheetName} ---`);
    for (let r = 0; r < data.length; r++) {
      const row = data[r];
      if (!row) continue;
      if (row[1] && typeof row[1] === 'string' && row[1].toUpperCase().includes('AHMAD')) {
        console.log(`Row ${r} (${row[1]}):`, JSON.stringify(row.slice(0, 35)));
      }
    }
  }
}

checkAhmadSchedule();
