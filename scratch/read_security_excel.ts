import * as xlsx from 'xlsx';

const EXCEL_PATH = 'D:/Ricky not Kiki/HRIS Widy/JADWAL_SECURITY_2026.xlsx';

function readSecurityExcel() {
  const wb = xlsx.readFile(EXCEL_PATH);
  console.log('Sheet Names:', wb.SheetNames);
  
  for (const sheetName of wb.SheetNames) {
    console.log(`\n--- SHEET: ${sheetName} ---`);
    const sheet = wb.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json<any[]>(sheet, { header: 1 });
    console.log(`Total Rows: ${data.length}`);
    for (let r = 0; r < Math.min(data.length, 25); r++) {
      console.log(`Row ${r}:`, JSON.stringify(data[r]?.slice(0, 15)));
    }
  }
}

readSecurityExcel();
