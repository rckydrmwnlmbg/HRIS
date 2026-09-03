import ExcelJS from 'exceljs';
import path from 'path';

async function testFormulas() {
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet('HARIAN');

  // Row 15: Sample employee
  const startRow = 15;
  const excelRow = ws.getRow(startRow);
  excelRow.getCell(1).value = '0001';
  excelRow.getCell(2).value = 'Budi';
  excelRow.getCell(3).value = 'L';
  excelRow.getCell(4).value = 'PRODUKSI';
  excelRow.getCell(5).value = 'TEAM A';

  // 7 days (cols 6 to 19): 8h kerja, 2h ot
  for (let d = 0; d < 7; d++) {
    const ci = 6 + d * 2;
    excelRow.getCell(ci).value = 8.0;
    excelRow.getCell(ci).numFmt = '0.0';
    excelRow.getCell(ci + 1).value = 2.0;
    excelRow.getCell(ci + 1).numFmt = '0.0';
  }

  const kerjaCols = ['F', 'H', 'J', 'L', 'N', 'P', 'R'].map(c => `${c}15`).join('+');
  const otCols = ['G', 'I', 'K', 'M', 'O', 'Q', 'S'].map(c => `${c}15`).join('+');

  // TOTAL KERJA (Formula)
  excelRow.getCell(20).value = { formula: kerjaCols, result: 56.0 };
  excelRow.getCell(20).numFmt = '0.0';

  // TOTAL OT (Formula)
  excelRow.getCell(21).value = { formula: otCols, result: 14.0 };
  excelRow.getCell(21).numFmt = '0.0';

  // TOTAL KERJA+OT (Formula)
  excelRow.getCell(22).value = { formula: 'T15+U15', result: 70.0 };
  excelRow.getCell(22).numFmt = '0.0';

  // Grand total row 16
  const sumRow = ws.getRow(16);
  sumRow.getCell(1).value = 'TOTAL';
  for (let c = 6; c <= 19; c++) {
    const colLet = String.fromCharCode(65 + c - 1);
    sumRow.getCell(c).value = { formula: `SUM(${colLet}15:${colLet}15)` };
    sumRow.getCell(c).numFmt = '0.0';
  }
  sumRow.getCell(20).value = { formula: 'SUM(T15:T15)', result: 56.0 };
  sumRow.getCell(20).numFmt = '0.0';
  sumRow.getCell(21).value = { formula: 'SUM(U15:U15)', result: 14.0 };
  sumRow.getCell(21).numFmt = '0.0';
  sumRow.getCell(22).value = { formula: 'T16+U16', result: 70.0 };
  sumRow.getCell(22).numFmt = '0.0';

  // Breakdown statistics
  ws.getCell(19, 20).value = 'MAX WT';
  ws.getCell(19, 21).value = { formula: 'MAX(V15:V15)', result: 70.0 };
  ws.getCell(19, 21).numFmt = '0.0';

  ws.getCell(21, 20).value = '<= 40';
  ws.getCell(21, 21).value = { formula: 'COUNTIF(V15:V15, "<=40")', result: 0 };

  ws.getCell(22, 20).value = '40.5 - 60';
  ws.getCell(22, 21).value = { formula: 'COUNTIFS(V15:V15, ">40", V15:V15, "<=60")', result: 0 };

  ws.getCell(23, 20).value = '>60';
  ws.getCell(23, 21).value = { formula: 'COUNTIF(V15:V15, ">60")', result: 1 };

  ws.getCell(24, 20).value = 'Total';
  ws.getCell(24, 21).value = { formula: 'SUM(U21:U23)', result: 1 };

  const outPath = path.resolve(process.cwd(), 'scratch/test_formula_output.xlsx');
  await workbook.xlsx.writeFile(outPath);
  console.log('Test Excel file generated at:', outPath);
}

testFormulas().catch(console.error);
