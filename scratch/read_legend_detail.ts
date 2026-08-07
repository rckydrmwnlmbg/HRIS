import * as xlsx from 'xlsx';

const EXCEL_PATH = 'D:/Ricky not Kiki/HRIS Widy/JADWAL_SECURITY_2026.xlsx';

function readLegendDetail() {
  const wb = xlsx.readFile(EXCEL_PATH);
  const sheet = wb.Sheets['JULI 2026'];
  const data = xlsx.utils.sheet_to_json<any[]>(sheet, { header: 1 });
  for (let r = 24; r < 53; r++) {
    const row = data[r];
    if (!row) continue;
    const nonEmpty = row.map((val, idx) => ({ col: idx, val })).filter(x => x.val !== null && x.val !== undefined && x.val !== '');
    if (nonEmpty.length > 0) {
      console.log(`Row ${r}:`, JSON.stringify(nonEmpty));
    }
  }
}

readLegendDetail();
