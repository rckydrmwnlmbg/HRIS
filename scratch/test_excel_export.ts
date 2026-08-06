import fs from 'fs';
import path from 'path';
import ExcelJS from 'exceljs';

process.env.NODE_ENV = 'development';

const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [key, ...vals] = trimmed.split('=');
    const val = vals.join('=').split('#')[0].trim();
    if (key && val) {
      process.env[key.trim()] = val;
    }
  }
}

async function testExport() {
  const { getDbConnection } = await import('../lib/db');
  const pool = await getDbConnection();

  const sql = `
    SELECT TOP 10 
      RTRIM(e.EMP_CD) AS NIK, 
      RTRIM(e.EMP_NM) AS NAMA, 
      RTRIM(s.SEC_DESC) AS BAGIAN,
      RTRIM(j.JOB_DESC) AS JABATAN,
      CONVERT(varchar(10), e.DT_ENTRY, 120) AS TGL_MASUK,
      RTRIM(e.SX) AS LP
    FROM EMP_TABLE e
    LEFT JOIN MS_SEC s ON RTRIM(e.SEC_CD) = RTRIM(s.SEC_CD)
    LEFT JOIN MS_JOBS j ON RTRIM(e.JOB_CD) = RTRIM(j.JOB_CD)
    WHERE e.Act_NonAct = 1 AND (e.DT_RSG IS NULL OR e.DT_RSG >= GETDATE())
  `;

  const result = await pool.request().query(sql);
  const rows = (result.recordset || []).map((row: any) => {
    const cleaned: Record<string, any> = {};
    for (const [k, v] of Object.entries(row)) {
      if (typeof v === 'string') {
        cleaned[k] = v.trim();
      } else if (v instanceof Date) {
        cleaned[k] = v.toISOString().slice(0, 10);
      } else {
        cleaned[k] = v;
      }
    }
    return cleaned;
  });

  console.log(`Retrieved ${rows.length} rows`);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'HRIS Widy AI';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Data AI', {
    views: [{ showGridLines: true, state: 'frozen', ySplit: 5 }]
  });

  const keys = Object.keys(rows[0] || {});
  const totalCols = Math.max(keys.length, 6);

  // 1. Company Banner (Row 1-2)
  worksheet.mergeCells(1, 1, 2, totalCols);
  const titleCell = worksheet.getCell(1, 1);
  titleCell.value = 'PT. TMNB GARMENT MANUFACTURING\nLAPORAN DATA ANALISIS HRIS WIDY AI';
  titleCell.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  titleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E293B' } // Slate 800
  };

  // 2. Info Bar (Row 3-4)
  worksheet.mergeCells(3, 1, 3, totalCols);
  const infoCell = worksheet.getCell(3, 1);
  const now = new Date();
  const dateStr = now.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  infoCell.value = `Tanggal Cetak: ${dateStr} pukul ${timeStr} WIB | Total Baris Data: ${rows.length} baris`;
  infoCell.font = { name: 'Calibri', size: 9, italic: true, color: { argb: 'FF475569' } };
  infoCell.alignment = { vertical: 'middle', horizontal: 'left' };
  infoCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF1F5F9' }
  };

  worksheet.getRow(4).height = 8; // Spacing row

  // 3. Table Header (Row 5)
  const headerRow = worksheet.getRow(5);
  headerRow.height = 24;

  keys.forEach((key, idx) => {
    const colNumber = idx + 1;
    const cell = headerRow.getCell(colNumber);
    const headerTitle = key
      .replace(/_/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
    cell.value = headerTitle;
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF334155' } // Slate 700
    };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF94A3B8' } },
      left: { style: 'thin', color: { argb: 'FF94A3B8' } },
      bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
      right: { style: 'thin', color: { argb: 'FF94A3B8' } },
    };
  });

  // 4. Data Rows (Row 6+)
  rows.forEach((row, rowIdx) => {
    const currentRowNumber = 6 + rowIdx;
    const dataRow = worksheet.getRow(currentRowNumber);
    dataRow.height = 20;
    const isEven = rowIdx % 2 === 1;

    keys.forEach((key, colIdx) => {
      const colNumber = colIdx + 1;
      const cell = dataRow.getCell(colNumber);
      const val = row[key];
      cell.value = val === null || val === undefined ? '-' : val;
      cell.font = { name: 'Calibri', size: 10, color: { argb: 'FF1E293B' } };

      // Background zebra
      if (isEven) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF8FAFC' }
        };
      }

      // Border
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };

      // Alignment & Number formatting
      const upperKey = key.toUpperCase();
      const isDate = upperKey.includes('DATE') || upperKey.includes('TGL') || upperKey.includes('TRANS');
      const isCode = upperKey.includes('CD') || upperKey.includes('NIK') || upperKey.includes('CODE') || upperKey.includes('SX') || upperKey.includes('LP') || upperKey.includes('STATUS');
      const isNumeric = typeof val === 'number';

      if (isNumeric) {
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
        if (upperKey.includes('SLR') || upperKey.includes('NOMINAL') || upperKey.includes('GAJI')) {
          cell.numFmt = '#,##0';
        } else if (upperKey.includes('OT') || upperKey.includes('JAM') || upperKey.includes('LATE')) {
          cell.numFmt = '0.0';
        } else {
          cell.numFmt = '#,##0';
        }
      } else if (isDate || isCode) {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      } else {
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      }
    });
  });

  // 5. Column Widths
  keys.forEach((key, colIdx) => {
    const colNumber = colIdx + 1;
    let maxLen = key.length;
    rows.forEach(r => {
      const v = r[key];
      if (v !== null && v !== undefined) {
        const len = String(v).length;
        if (len > maxLen) maxLen = len;
      }
    });
    const col = worksheet.getColumn(colNumber);
    col.width = Math.max(12, Math.min(45, maxLen + 4));
  });

  const outPath = path.resolve(process.cwd(), 'scratch/sample_styled_export.xlsx');
  await workbook.xlsx.writeFile(outPath);
  console.log(`Saved sample export to: ${outPath}`);
}

testExport().then(() => process.exit(0)).catch(e => {
  console.error(e);
  process.exit(1);
});
