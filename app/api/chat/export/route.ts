import { NextRequest, NextResponse } from 'next/server';
import { getDbConnection } from '@/lib/db';
import { calculateSecurityOtHours, detectSecurityShift, getDurationMinutes, getSecurityShiftByCode, isSecurityJob, isValidAttendancePair } from '@/lib/securitySchedule';
import ExcelJS from 'exceljs';

const DANGEROUS_SQL = /(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE|EXEC|EXECUTE|MERGE|GRANT|REVOKE)\s/i;
const BLOCKED_KEYWORDS = /(INTO\s+(OUTFILE|DUMPFILE)|xp_cmdshell|sp_configure|OPENROWSET|OPENDATASOURCE|SLEEP|BENCHMARK|WAITFOR)/i;

const MONTH_NAMES_ID = [
  '', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

function formatDateID(dateStr: string): string {
  if (!dateStr) return '';
  const clean = dateStr.trim().slice(0, 10);
  const parts = clean.split('-');
  if (parts.length !== 3) return dateStr;
  const day = parts[2];
  const month = MONTH_NAMES_ID[parseInt(parts[1], 10)] || parts[1];
  const year = parts[0];
  return `${day} ${month.toUpperCase()} ${year}`;
}

function detectPeriod(sql: string, prompt?: string): string {
  const cleanSql = sql || '';
  const cleanPrompt = (prompt || '').toLowerCase();

  // 1. Check BETWEEN in SQL
  const betweenMatch = cleanSql.match(/BETWEEN\s+'(\d{4}-\d{2}-\d{2})'\s+AND\s+'(\d{4}-\d{2}-\d{2})'/i);
  if (betweenMatch) {
    return `PERIODE : ${formatDateID(betweenMatch[1])} S/D ${formatDateID(betweenMatch[2])}`;
  }

  // 2. Check >= and <= in SQL
  const gteLteMatch = cleanSql.match(/>=\s*'(\d{4}-\d{2}-\d{2})'[\s\S]*?<=\s*'(\d{4}-\d{2}-\d{2})'/i);
  if (gteLteMatch) {
    return `PERIODE : ${formatDateID(gteLteMatch[1])} S/D ${formatDateID(gteLteMatch[2])}`;
  }

  // 3. Check MONTH(...) = X AND YEAR(...) = Y
  const monthYearMatch = cleanSql.match(/MONTH\([^)]+\)\s*=\s*(\d+)[\s\S]*?YEAR\([^)]+\)\s*=\s*(\d+)/i) ||
                         cleanSql.match(/YEAR\([^)]+\)\s*=\s*(\d+)[\s\S]*?MONTH\([^)]+\)\s*=\s*(\d+)/i);
  if (monthYearMatch) {
    const p1 = parseInt(monthYearMatch[1], 10);
    const p2 = parseInt(monthYearMatch[2], 10);
    const m = p1 > 12 ? p2 : p1;
    const y = p1 > 12 ? p1 : p2;
    return `PERIODE : BULAN ${MONTH_NAMES_ID[m]?.toUpperCase() || m} ${y}`;
  }

  // 4. Check DATE_TRANS = 'YYYY-MM-DD'
  const singleDateMatch = cleanSql.match(/DATE_TRANS\s*=\s*'(\d{4}-\d{2}-\d{2})'/i);
  if (singleDateMatch) {
    return `TANGGAL : ${formatDateID(singleDateMatch[1])}`;
  }

  // 5. Fallback check prompt keywords
  if (cleanPrompt) {
    if (cleanPrompt.includes('minggu ke-3') || cleanPrompt.includes('minggu ke 3') || cleanPrompt.includes('minggu ketiga')) {
      if (cleanPrompt.includes('juni 2026')) return `PERIODE : 15 JUNI 2026 S/D 21 JUNI 2026 (MINGGU KE-3)`;
      if (cleanPrompt.includes('juni')) return `PERIODE : MINGGU KE-3 JUNI`;
    }
    if (cleanPrompt.includes('juni 2026')) return `PERIODE : BULAN JUNI 2026`;
    if (cleanPrompt.includes('hari ini')) {
      const now = new Date();
      return `TANGGAL : ${formatDateID(now.toISOString().slice(0, 10))}`;
    }
  }

  return `PERIODE : SELURUH DATA TERPILIH`;
}

function detectReportTitle(sql: string, prompt?: string): string {
  const combined = ((prompt || '') + ' ' + (sql || '')).toUpperCase();
  if (combined.includes('CUTI') || combined.includes('TBLCUTI') || combined.includes('TBLDETCUTI') || combined.includes('SISA')) {
    return 'LAPORAN REKAPITULASI CUTI KARYAWAN';
  }
  if (combined.includes('OT_') || combined.includes('LEMBUR') || combined.includes('OVERTIME')) {
    return 'LAPORAN REKAPITULASI LEMBUR (OVERTIME) KARYAWAN';
  }
  if (combined.includes('PERFORMA') || combined.includes('TERBAIK') || combined.includes('RANK') || combined.includes('PRESTASI')) {
    return 'LAPORAN EVALUASI & PERFORMA KEHADIRAN KARYAWAN';
  }
  if (combined.includes('ALPHA') || combined.includes('ABSEN') || combined.includes('WORK_IN IS NULL') || combined.includes('TERLAMBAT')) {
    return 'LAPORAN REKAPITULASI KETIDAKHADIRAN / ABSENSI KARYAWAN';
  }
  if (combined.includes('GAJI') || combined.includes('SALARY') || combined.includes('SLR') || combined.includes('PAYROLL')) {
    return 'LAPORAN ESTIMASI GAJI & UPAH LEMBUR';
  }
  if (combined.includes('EMP_TABLE') || combined.includes('KARYAWAN')) {
    return 'LAPORAN DATA KARYAWAN';
  }
  return 'LAPORAN DATA HRIS';
}

function extractAnalysisOTDates(sql: string, prompt?: string): { startStr: string; endStr: string } | null {
  const combined = ((prompt || '') + ' ' + (sql || '')).toLowerCase();
  const isOTAnalysis = combined.includes('analysis ot') || combined.includes('analisis ot') || 
                       combined.includes('lembur minggu') || combined.includes('dailyot') || 
                       combined.includes('durasi_jam');
  
  if (!isOTAnalysis) return null;

  // 1. Try date range in SQL
  const betweenMatch = (sql || '').match(/BETWEEN\s+'(\d{4}-\d{2}-\d{2})'\s+AND\s+'(\d{4}-\d{2}-\d{2})'/i);
  if (betweenMatch) {
    return { startStr: betweenMatch[1], endStr: betweenMatch[2] };
  }

  const gteLteMatch = (sql || '').match(/>=\s*'(\d{4}-\d{2}-\d{2})'[\s\S]*?<=\s*'(\d{4}-\d{2}-\d{2})'/i);
  if (gteLteMatch) {
    return { startStr: gteLteMatch[1], endStr: gteLteMatch[2] };
  }

  // 2. Try week keywords in prompt
  const hasJune = combined.includes('juni');
  const year = combined.match(/\b(202[0-9])\b/)?.[1] || '2026';
  
  if (hasJune) {
    if (combined.includes('minggu ke-1') || combined.includes('minggu ke 1') || combined.includes('minggu pertama') || combined.includes('minggu 1')) {
      return { startStr: `${year}-06-01`, endStr: `${year}-06-07` };
    }
    if (combined.includes('minggu ke-2') || combined.includes('minggu ke 2') || combined.includes('minggu kedua') || combined.includes('minggu 2')) {
      return { startStr: `${year}-06-08`, endStr: `${year}-06-14` };
    }
    if (combined.includes('minggu ke-3') || combined.includes('minggu ke 3') || combined.includes('minggu ketiga') || combined.includes('minggu 3')) {
      return { startStr: `${year}-06-15`, endStr: `${year}-06-21` };
    }
    if (combined.includes('minggu ke-4') || combined.includes('minggu ke 4') || combined.includes('minggu keempat') || combined.includes('minggu 4')) {
      return { startStr: `${year}-06-22`, endStr: `${year}-06-28` };
    }
    if (combined.includes('minggu ke-5') || combined.includes('minggu ke 5') || combined.includes('minggu kelima') || combined.includes('minggu 5')) {
      return { startStr: `${year}-06-29`, endStr: `${year}-06-30` };
    }
  }

  return null;
}

async function handleAnalysisOTExport(pool: any, startStr: string, endStr: string) {
  const dStart = new Date(startStr + 'T00:00:00');
  const weekDates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(dStart);
    d.setDate(dStart.getDate() + i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    weekDates.push(`${y}-${m}-${dd}`);
  }

  const formatDate = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-');
    return `${d}-${m}-${y}`;
  };

  const otDataResult = await pool.request().query(`
    SELECT 
      RTRIM(e.EMP_CD) AS EMP_CD,
      RTRIM(e.EMP_NM) AS EMP_NM,
      RTRIM(e.SX) AS SX,
      RTRIM(d.DEP_DESC) AS DEP_DESC,
      RTRIM(s.SEC_DESC) AS SEC_DESC,
      RTRIM(j.JOB_DESC) AS JOB_DESC,
      CASE 
        WHEN UPPER(RTRIM(s.SEC_DESC)) LIKE '%LINE%' THEN 'SEWING'
        WHEN RTRIM(s.SEC_DESC) IN ('BUTTON', 'PATTERN SEAMER') THEN 'SEWING'
        WHEN RTRIM(s.SEC_DESC) IN ('BANDLELING', 'CUTTING', 'GANTI BS', 'GELAR', 'GELAR INTERLINING', 'LOADING', 'MARKER', 'NUMBERING', 'PIPING', 'PRESS', 'RELAX') THEN 'CUTTING'
        WHEN RTRIM(s.SEC_DESC) IN ('MEKANIK') THEN 'MECHANIC'
        WHEN RTRIM(s.SEC_DESC) IN ('LAB', 'PSO', 'QA', 'QC ACCURACY') THEN 'QA'
        WHEN RTRIM(s.SEC_DESC) IN ('IE') THEN 'IE'
        WHEN RTRIM(s.SEC_DESC) IN ('ACCESSORIES', 'FABRIC', 'IT INVENTORY', 'MATERIAL MGMT', 'TRANSFER') THEN 'WAREHOUSE'
        WHEN RTRIM(s.SEC_DESC) IN ('IRONING') THEN 'FINISHING'
        WHEN RTRIM(s.SEC_DESC) IN ('PACKING', 'WAREHOUSE') THEN 'PACKING'
        WHEN RTRIM(s.SEC_DESC) IN ('END LINE', 'END LINE SPARE', 'IN LINE', 'QC CUTTING', 'QC FABRIC', 'QC FINISHING', 'QC SEWING', 'QC SIZESPEC') THEN 'QC'
        WHEN RTRIM(s.SEC_DESC) IN ('ORDER MGMT.') THEN 'PPIC'
        WHEN RTRIM(s.SEC_DESC) IN ('CAD MARKER', 'CAD PATTERN', 'SAMPLE', 'SEWING PATTERN') THEN 'SAMPLE'
        WHEN RTRIM(s.SEC_DESC) IN ('OFFICE PRODUKSI') THEN 'PROD.  OFFICE'
        WHEN RTRIM(s.SEC_DESC) IN ('CLINIC', 'COMPLIANCE', 'HR') THEN 'HRC'
        WHEN RTRIM(s.SEC_DESC) IN ('ACC/FIN', 'ACCOUNTING', 'FINANCE', 'PURCHASE') THEN 'ACCOUNTING'
        WHEN RTRIM(s.SEC_DESC) IN ('EXIM', 'EXPORT', 'IMPORT', 'SUB-CON') THEN 'EXIM'
        WHEN RTRIM(s.SEC_DESC) IN ('5 S', 'IT') THEN 'GA'
        WHEN RTRIM(s.SEC_DESC) IN ('COOK', 'CS', 'DRIVER', 'SECURITY') THEN 'GA SERVICE'
        WHEN RTRIM(s.SEC_DESC) IN ('UMUM', 'UTILITY') THEN 'MAINTENANCE'
        ELSE RTRIM(d.DEP_DESC) 
      END AS TEAM,
      CASE WHEN UPPER(ISNULL(RTRIM(e.ALL_IN), '0')) IN ('1', 'Y', 'TRUE') THEN 1 ELSE 0 END AS isAllIn,
      e.DT_RSG,
      e.DT_ENTRY,
      CONVERT(varchar(10), a.DATE_TRANS, 120) AS dateStr,
      RTRIM(a.STATUS_HARI) AS STATUS_HARI,
      RTRIM(mr.REASON_GROUP) AS REASON_GROUP,
      a.WORK_IN,
      a.WORK_OUT,
      a.JAM_MASUK,
      a.JAM_PULANG,
      a.JAM_KERJA,
      RTRIM(a.SHIFT) AS SHIFT,
      ISNULL(a.OT_1, 0) + ISNULL(a.OT_2, 0) + ISNULL(a.OT_3, 0) + ISNULL(a.OT_4, 0) AS dailyOt
    FROM EMP_TABLE e
    LEFT JOIN MS_DEP d ON e.DEP_CD = d.DEP_CD
    LEFT JOIN MS_SEC s ON e.SEC_CD = s.SEC_CD
    LEFT JOIN MS_JOBS j ON e.JOB_CD = j.JOB_CD
    LEFT JOIN (
      SELECT * FROM TR_ABSEN 
      WHERE DATE_TRANS >= '${startStr}' AND DATE_TRANS <= '${endStr}'
    ) a ON e.EMP_CD = a.EMP_CD
    LEFT JOIN Ms_Reason mr ON RTRIM(a.REASON) = RTRIM(mr.REASON_CODE)
    WHERE (e.DT_ENTRY IS NULL OR e.DT_ENTRY <= '${endStr}')
      AND (e.DT_RSG IS NULL OR e.DT_RSG >= '${startStr}')
      AND (e.Act_NonAct = 1 OR e.Act_NonAct IS NULL)
    ORDER BY RTRIM(s.SEC_DESC), RTRIM(e.EMP_NM), a.DATE_TRANS
  `);

  const otData = otDataResult.recordset || [];
  const empMap = new Map();

  otData.forEach((row: any) => {
    if (!empMap.has(row.EMP_CD)) {
      empMap.set(row.EMP_CD, {
        EMP_CD: row.EMP_CD,
        EMP_NM: row.EMP_NM,
        SX: row.SX || '-',
        SEC_DESC: row.SEC_DESC || '-',
        JOB_DESC: row.JOB_DESC,
        TEAM: row.TEAM || '-',
        DEP_DESC: row.DEP_DESC || '-',
        isAllIn: row.isAllIn == 1 || row.isAllIn == 'Y',
        DT_RSG: row.DT_RSG,
        DT_ENTRY: row.DT_ENTRY,
        days: {},
        totalKerja: 0,
        totalOt: 0,
        A: 0, I: 0, S: 0, C: 0
      });
    }
    const emp = empMap.get(row.EMP_CD);
    if (row.dateStr) {
      const status = row.STATUS_HARI;
      const rg = row.REASON_GROUP;
      
      const dObj = new Date(row.dateStr + 'T00:00:00');
      const dayOfWeek = dObj.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const isHoliday = status === 'LIBUR' || status === 'OFF' || status === 'H';
      const security = isSecurityJob(row.JOB_DESC, row.SEC_DESC);
      const isSecurityWeekend = security && isWeekend;
      const isHolidayCalculation = isHoliday && !isSecurityWeekend;

      let isKerjaNormal = !isHolidayCalculation && (status === 'KERJA' || status === 'O' || rg === 'O');
      let isCuti = !isSecurityWeekend && (status === 'CUTI' || status === 'C' || status === 'H' || status === 'HAID' || rg === 'C' || rg === 'H');

      let kerjaHours = 0;
      let otHours = 0;

      let computedOt: number | null = null;
      const outDate = row.WORK_OUT ? new Date(row.WORK_OUT) : null;
      const inDate = row.WORK_IN ? new Date(row.WORK_IN) : null;
      const isSecurityHoliday = security && (status === 'LIBUR' || status === 'OFF') && !isSecurityWeekend;
      const securityShift = security ? (detectSecurityShift(row.WORK_IN, row.WORK_OUT) || getSecurityShiftByCode(row.SHIFT)) : null;
      const attendanceValid = isValidAttendancePair(row.dateStr, inDate, outDate, securityShift);
      if (attendanceValid && inDate && outDate) {
        if (isSecurityHoliday) {
          const workedMinutes = getDurationMinutes(inDate, outDate);
          computedOt = Math.max(0, Math.floor(((workedMinutes - 60) / 60) * 2) / 2);
        } else if (isHolidayCalculation) {
          computedOt = Math.max(0, Math.floor((getDurationMinutes(inDate, outDate) / 60) * 2) / 2);
        } else if (security && securityShift) {
          computedOt = calculateSecurityOtHours(inDate, outDate, securityShift);
        } else {
          let schOutHour = 16;
          let schOutMin = 0;
          if (row.JAM_PULANG) {
            const pDate = new Date(row.JAM_PULANG);
            if (!isNaN(pDate.getTime())) {
              schOutHour = pDate.getHours();
              schOutMin = pDate.getMinutes();
            }
          }
          const scheduleOut = new Date(outDate);
          scheduleOut.setHours(schOutHour, schOutMin, 0, 0);
          const diffMinutes = (outDate.getTime() - scheduleOut.getTime()) / 60000;
          const breakMinutes = diffMinutes >= 210 ? 30 : 0;
          computedOt = Math.max(0, Math.floor(((diffMinutes - breakMinutes) / 60) * 2) / 2);
        }
      }

      if (isHolidayCalculation) {
        kerjaHours = 0;
        otHours = attendanceValid ? (computedOt ?? (row.JAM_KERJA && !isNaN(Number(row.JAM_KERJA)) ? Number(row.JAM_KERJA) : 0)) : 0;
      } else {
        if (isCuti) {
          kerjaHours = 8;
          otHours = 0;
        } else if (isKerjaNormal && attendanceValid) {
          kerjaHours = 8;
          otHours = computedOt ?? 0;
        } else {
          kerjaHours = 0;
          otHours = 0;
        }
      }

      emp.days[row.dateStr] = { kerja: kerjaHours, ot: otHours };
      emp.totalKerja += kerjaHours;
      emp.totalOt = Number((emp.totalOt + otHours).toFixed(2));

      if (status === 'ALPHA' || status === 'A') emp.A++;
      else if (status === 'IJIN' || status === 'I' || rg === 'I') emp.I++;
      else if (status === 'SAKIT' || status === 'S' || rg === 'S') emp.S++;
      else if (isCuti) emp.C++;
    }
  });

  const previewData = Array.from(empMap.values());
  const workbook = new ExcelJS.Workbook();

  const stats: any = {
    HARIAN: { b1: 0, b2: 0, b3: 0, total: 0 },
    ALL_IN: { b1: 0, b2: 0, b3: 0, total: 0 }
  };

  const setBorder = (cell: any) => {
    cell.border = {
      top: { style: 'thin' }, left: { style: 'thin' },
      bottom: { style: 'thin' }, right: { style: 'thin' }
    };
  };
  const setGrayBg = (cell: any) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFBFBFBF' } };
  };
  const setYellowBg = (cell: any) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
  };

  const getColName = (n: number) => { 
    let ordA = 'A'.charCodeAt(0); 
    let len = 26; 
    let s = ""; 
    while (n >= 0) { 
      s = String.fromCharCode((n % len) + ordA) + s; 
      n = Math.floor(n / len) - 1; 
    } 
    return s; 
  };

  const coverWs = workbook.addWorksheet('REPORT', { views: [{ showGridLines: false }] });

  const generateSheet = (sheetName: string, isAllInFilter: boolean) => {
    const ws = workbook.addWorksheet(sheetName, { views: [{ showGridLines: false }] });
    const filteredData = previewData.filter(d => {
      const isAllIn = Boolean(d.isAllIn);
      return isAllInFilter ? isAllIn : !isAllIn;
    });

    ws.mergeCells('A1:B1');
    ws.getCell('A1').value = 'PT. TPINC Trading Jakarta';
    ws.getCell('A1').font = { bold: true };

    ws.mergeCells('L5:R5');
    ws.getCell('L5').value = 'LAPORAN LEMBUR (OVERTIME) PER MINGGU';
    ws.getCell('L5').font = { bold: true };

    ws.mergeCells('L7:R7');
    ws.getCell('L7').value = `PERIODE : ${formatDate(startStr)} SD ${formatDate(endStr)}`;

    ws.mergeCells('A10:D10');
    ws.getCell('A10').value = 'TEAM : SELURUH TEAM';

    ws.mergeCells('A12:A13'); ws.getCell('A12').value = 'NIK';
    ws.mergeCells('B12:B13'); ws.getCell('B12').value = 'NAMA';
    ws.mergeCells('C12:C13'); ws.getCell('C12').value = 'L/P';
    ws.mergeCells('D12:D13'); ws.getCell('D12').value = 'BAGIAN';
    ws.mergeCells('E12:E13'); ws.getCell('E12').value = 'TEAM';

    let colIndex = 6;
    weekDates.forEach((d) => {
      ws.mergeCells(12, colIndex, 12, colIndex + 1);
      ws.getCell(12, colIndex).value = formatDate(d);
      ws.getCell(13, colIndex).value = 'KERJA';
      ws.getCell(13, colIndex + 1).value = 'OT';
      colIndex += 2;
    });

    ws.mergeCells(12, colIndex, 12, colIndex + 2);
    ws.getCell(12, colIndex).value = 'TOTAL';
    ws.getCell(13, colIndex).value = 'KERJA';
    ws.getCell(13, colIndex + 1).value = 'OT';
    ws.getCell(13, colIndex + 2).value = 'KERJA+OT';
    colIndex += 3;

    ws.mergeCells(12, colIndex, 12, colIndex + 3);
    ws.getCell(12, colIndex).value = 'KETERANGAN';
    ws.getCell(13, colIndex).value = 'A';
    ws.getCell(13, colIndex + 1).value = 'I';
    ws.getCell(13, colIndex + 2).value = 'S';
    ws.getCell(13, colIndex + 3).value = 'C';

    // Header Styling
    for (let c = 1; c < colIndex + 4; c++) {
      const c12 = ws.getCell(12, c);
      const c13 = ws.getCell(13, c);
      setBorder(c12); setBorder(c13);
      setGrayBg(c12); setGrayBg(c13);
      c12.font = { bold: true }; c13.font = { bold: true };
      c12.alignment = { horizontal: 'center', vertical: 'middle' };
      c13.alignment = { horizontal: 'center', vertical: 'middle' };
    }

    let startRow = 15;

    filteredData.forEach(row => {
      const excelRow = ws.getRow(startRow);
      excelRow.getCell(1).value = row.EMP_CD;
      excelRow.getCell(2).value = row.EMP_NM;
      excelRow.getCell(3).value = row.SX;
      excelRow.getCell(4).value = row.SEC_DESC;
      excelRow.getCell(5).value = row.TEAM || '-';

      let ci = 6;
      weekDates.forEach((d) => {
        const dayData = row.days[d] || { kerja: 0, ot: 0 };
        excelRow.getCell(ci).value = dayData.kerja;
        excelRow.getCell(ci + 1).value = dayData.ot;
        excelRow.getCell(ci + 1).numFmt = '0.0';
        ci += 2;
      });

      const kerjaCols = weekDates.map((_, idx) => `${getColName(5 + idx * 2)}${startRow}`).join('+');
      const otCols = weekDates.map((_, idx) => `${getColName(6 + idx * 2)}${startRow}`).join('+');
      const totKerjaCol = getColName(colIndex - 4);
      const totOtCol = getColName(colIndex - 3);

      excelRow.getCell(ci).value = { formula: kerjaCols, result: row.totalKerja };
      excelRow.getCell(ci + 1).value = { formula: otCols, result: row.totalOt };
      excelRow.getCell(ci + 1).numFmt = '0.0';
      excelRow.getCell(ci + 2).value = { formula: `${totKerjaCol}${startRow}+${totOtCol}${startRow}`, result: row.totalKerja + row.totalOt };
      ci += 3;

      excelRow.getCell(ci).value = row.A;
      excelRow.getCell(ci + 1).value = row.I;
      excelRow.getCell(ci + 2).value = row.S;
      excelRow.getCell(ci + 3).value = row.C;

      for (let c = 1; c < colIndex + 4; c++) {
        const cell = excelRow.getCell(c);
        setBorder(cell);
        if (c > 5) cell.alignment = { horizontal: 'center' };
      }

      startRow++;
    });

    const sumRowIndex = startRow;
    const sumRow = ws.getRow(startRow);

    ws.mergeCells(sumRowIndex, 1, sumRowIndex, colIndex - 4);
    const totalCell = sumRow.getCell(1);
    totalCell.value = 'TOTAL';
    totalCell.font = { bold: true };
    totalCell.alignment = { horizontal: 'center', vertical: 'middle' };

    const sumColumns = [
      colIndex - 3, colIndex - 2, colIndex - 1,
      colIndex, colIndex + 1, colIndex + 2, colIndex + 3
    ];

    for (let c = 1; c < colIndex + 4; c++) {
      const cell = sumRow.getCell(c);
      setBorder(cell);
      if (sumColumns.includes(c)) {
        const colLetter = getColName(c - 1);
        cell.value = { formula: `SUM(${colLetter}15:${colLetter}${sumRowIndex - 1})` };
        cell.font = { bold: true };
        cell.alignment = { horizontal: 'center' };
        if (c === colIndex - 2) {
          cell.numFmt = '0.0';
        }
      }
    }

    const totKerjaOtColLetter = getColName(colIndex - 2);

    startRow += 3;
    ws.getCell(startRow, colIndex - 3).value = 'MAX WT';
    ws.getCell(startRow, colIndex - 3).font = { bold: true };
    ws.getCell(startRow, colIndex - 2).value = { formula: `MAX(${totKerjaOtColLetter}15:${totKerjaOtColLetter}${sumRowIndex - 1})` };
    ws.getCell(startRow, colIndex - 2).font = { bold: true };

    startRow += 2;
    ws.getCell(startRow, colIndex - 3).value = 'Working time breakdown';
    ws.getCell(startRow, colIndex - 3).font = { bold: true };

    startRow++;
    ws.getCell(startRow, colIndex - 3).value = '<= 40';
    ws.getCell(startRow, colIndex - 2).value = { formula: `COUNTIF(${totKerjaOtColLetter}15:${totKerjaOtColLetter}${sumRowIndex - 1}, "<=40")` };
    const b1Cell = `${getColName(colIndex - 3)}${startRow}`;

    startRow++;
    ws.getCell(startRow, colIndex - 3).value = '40,5 - 60';
    ws.getCell(startRow, colIndex - 2).value = { formula: `COUNTIFS(${totKerjaOtColLetter}15:${totKerjaOtColLetter}${sumRowIndex - 1}, ">40", ${totKerjaOtColLetter}15:${totKerjaOtColLetter}${sumRowIndex - 1}, "<=60")` };
    const b2Cell = `${getColName(colIndex - 3)}${startRow}`;

    startRow++;
    ws.getCell(startRow, colIndex - 3).value = '>60';
    ws.getCell(startRow, colIndex - 2).value = { formula: `COUNTIF(${totKerjaOtColLetter}15:${totKerjaOtColLetter}${sumRowIndex - 1}, ">60")` };
    const b3Cell = `${getColName(colIndex - 3)}${startRow}`;

    startRow++;
    ws.getCell(startRow, colIndex - 2).value = { formula: `COUNTA(A15:A${sumRowIndex - 1})` };
    const totalEmpCell = `${getColName(colIndex - 3)}${startRow}`;

    const targetStat = isAllInFilter ? stats.ALL_IN : stats.HARIAN;
    targetStat.b1Cell = `'${sheetName}'!${b1Cell}`;
    targetStat.b2Cell = `'${sheetName}'!${b2Cell}`;
    targetStat.b3Cell = `'${sheetName}'!${b3Cell}`;
    targetStat.totalCell = `'${sheetName}'!${totalEmpCell}`;

    ws.columns.forEach((c: any) => { c.width = 10; });
    ws.getColumn(2).width = 25;
    ws.getColumn(4).width = 20;
    ws.getColumn(5).width = 20;
  };

  generateSheet('HARIAN', false);
  generateSheet('ALL IN', true);

  // Cover Sheet (REPORT)
  coverWs.mergeCells('A2:F2');
  coverWs.getCell('A2').value = 'TMNB WEEKLY O/T  REPORT';
  coverWs.getCell('A2').font = { bold: true, size: 16 };
  coverWs.getCell('A2').alignment = { horizontal: 'left', vertical: 'middle' };

  coverWs.mergeCells('B4:C4');
  coverWs.mergeCells('D4:F4');
  coverWs.getCell('A4').value = 'Factory Name';
  coverWs.getCell('B4').value = 'TMNB';

  coverWs.mergeCells('B5:C5');
  coverWs.mergeCells('D5:E5');
  coverWs.getCell('A5').value = 'Monitoring Week';
  coverWs.getCell('B5').value = formatDate(startStr);
  coverWs.getCell('D5').value = 'to';
  coverWs.getCell('F5').value = formatDate(endStr);

  coverWs.mergeCells('B6:F6');
  coverWs.getCell('A6').value = 'Date of Analysis';

  for (let r = 4; r <= 6; r++) {
    for (let c = 1; c <= 6; c++) {
      const cell = coverWs.getCell(r, c);
      setBorder(cell);
      if (c === 1) setGrayBg(cell);
      if (r === 6) setGrayBg(cell);
    }
  }

  coverWs.mergeCells('A8:B8');
  coverWs.mergeCells('C8:C9');
  coverWs.mergeCells('D8:D9');
  coverWs.getCell('A8').value = 'Monday - Friday';
  coverWs.getCell('C8').value = 'Work hours';
  coverWs.getCell('D8').value = 'Saturday';

  coverWs.getCell('A9').value = 'Sub-Unit';
  coverWs.getCell('B9').value = 'Amount';

  const staticHeaders = ['A8', 'B8', 'C8', 'D8', 'A9', 'B9', 'C9', 'D9'];
  staticHeaders.forEach(addr => {
    const c = coverWs.getCell(addr);
    setBorder(c);
    setGrayBg(c);
    c.font = { bold: true };
    c.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  const rowsData = [
    ['AM-Working time', '07.00 - 12.00', 4.5, '07.30 - 11.30'],
    ['Rest Time          ', '11.30 - 12.30', null, '11.30 - 12.30'],
    ['PM-Working time', '12.30 - 16:00', 3.5, '12.30 - 15.30'],
    ['OT1-Working time', '16.00 - 17.00', 1, null],
    ['OT2-Working time', '17.00 - 18.00', 1, null],
    ['Rest Time          ', '18.00 - 18.30', null, null],
    ['OT2-Working time', '18.30 - 21.30', 3, null],
    ['OT2-Working time (Saturday)', '07.00 - 15.00', 7, null]
  ];

  for (let i = 0; i < rowsData.length; i++) {
    const rowNum = 10 + i;
    for (let col = 1; col <= 4; col++) {
      const c = coverWs.getCell(rowNum, col);
      setBorder(c);
      if (rowsData[i][col - 1] !== null) {
        c.value = rowsData[i][col - 1];
      }
      if (i === 1 || i === 5) {
        setYellowBg(c);
      }
      if (i === 7 && col <= 2) {
        c.font = { color: { argb: 'FF0070C0' } };
      }
    }
  }

  coverWs.mergeCells('A19:B19');
  coverWs.getCell('A19').value = 'Working hours per week';
  coverWs.getCell('C19').value = 'HARIAN';
  coverWs.getCell('D19').value = 'ALL IN';
  coverWs.getCell('E19').value = 'Total\nEmployees';

  const sumHeaders = ['A19', 'B19', 'C19', 'D19', 'E19'];
  sumHeaders.forEach(addr => {
    const c = coverWs.getCell(addr);
    setBorder(c);
    setGrayBg(c);
    c.font = { bold: true };
    c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  });

  const sumData = [
    [
      'Less than 40', '<= 40',
      { formula: stats.HARIAN.b1Cell },
      { formula: stats.ALL_IN.b1Cell },
      { formula: 'C20+D20' }
    ],
    [
      'Among 40.5 and 60 hours', '40,5 - 60',
      { formula: stats.HARIAN.b2Cell },
      { formula: stats.ALL_IN.b2Cell },
      { formula: 'C21+D21' }
    ],
    [
      'Among 60 till before Max.hours', '',
      { formula: stats.HARIAN.b3Cell },
      { formula: stats.ALL_IN.b3Cell },
      { formula: 'C22+D22' }
    ],
    [
      'Total', 'Total',
      { formula: stats.HARIAN.totalCell },
      { formula: stats.ALL_IN.totalCell },
      { formula: 'C23+D23' }
    ]
  ];

  for (let i = 0; i < sumData.length; i++) {
    const rowNum = 20 + i;
    for (let col = 1; col <= 5; col++) {
      const c = coverWs.getCell(rowNum, col);
      setBorder(c);
      c.value = sumData[i][col - 1];

      if (i === 2 && col <= 2) {
        c.font = { color: { argb: 'FFFF0000' } };
      }
      if (i === 3) {
        setGrayBg(c);
      }
      if (col === 5) {
        c.font = { color: { argb: 'FF0000FF' }, bold: true };
      }
      if (col >= 3) {
        c.alignment = { horizontal: 'center' };
      }
    }
  }

  coverWs.getColumn(1).width = 30;
  coverWs.getColumn(2).width = 15;
  coverWs.getColumn(3).width = 15;
  coverWs.getColumn(4).width = 15;
  coverWs.getColumn(5).width = 15;
  coverWs.getColumn(6).width = 15;

  const fileNameTitle = `Laporan Analysis OT ${formatDate(startStr)} sd ${formatDate(endStr)}`;
  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(buffer as any, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${fileNameTitle}.xlsx"`,
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const { sql, prompt, title } = await request.json();
    if (!sql || DANGEROUS_SQL.test(sql) || BLOCKED_KEYWORDS.test(sql) || !/^\s*(SELECT|WITH)\b/i.test(sql)) {
      return NextResponse.json({ error: 'Query tidak valid atau berbahaya' }, { status: 400 });
    }

    const pool = await getDbConnection();

    // Check if this is an Analysis OT request -> generate identical official multi-sheet workbook
    const analysisDates = extractAnalysisOTDates(sql, prompt);
    if (analysisDates) {
      return await handleAnalysisOTExport(pool, analysisDates.startStr, analysisDates.endStr);
    }

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

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Tidak ada data untuk diekspor.' }, { status: 400 });
    }

    const keys = Object.keys(rows[0]);
    const numCols = keys.length;

    // Detect numeric / aggregatable columns
    const numericCols = new Set<string>();
    keys.forEach(k => {
      const upper = k.toUpperCase();
      const isNum = rows.some((r: Record<string, any>) => typeof r[k] === 'number') ||
                    upper.includes('OT_') || upper.includes('OT1') || upper.includes('OT2') ||
                    upper.includes('OT3') || upper.includes('OT4') || upper.includes('JAM') ||
                    upper.includes('HADIR') || upper.includes('TOTAL') || upper.includes('LATE') ||
                    upper.includes('GAJI') || upper.includes('SLR') || upper.includes('NOMINAL') ||
                    upper.includes('JUMLAH') || upper.includes('HARI');
      if (isNum && !upper.includes('CD') && !upper.includes('NIK') && !upper.includes('CODE') && !upper.includes('DATE') && !upper.includes('TGL')) {
        numericCols.add(k);
      }
    });

    // Build column headers
    const columns = keys.map(key => {
      let maxLen = key.length;
      rows.forEach((r: Record<string, any>) => {
        const valStr = String(r[key] ?? '');
        if (valStr.length > maxLen) maxLen = valStr.length;
      });
      return {
        header: key.toUpperCase().replace(/_/g, ' '),
        key,
        width: Math.max(maxLen + 4, 12),
      };
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'PT. TMNB - Sistem HRIS Widy';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('Data Laporan', {
      views: [{ showGridLines: true }]
    });

    // ── 1. Company Header (Row 1) ──
    const companyTitle = 'PT. TPINC TRADING JAKARTA (PT. TMNB)';
    worksheet.mergeCells(1, 1, 1, numCols);
    const cellCompany = worksheet.getCell(1, 1);
    cellCompany.value = companyTitle;
    cellCompany.font = { name: 'Calibri', size: 13, bold: true, color: { argb: 'FF1F2937' } };
    cellCompany.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(1).height = 24;

    // ── 2. Report Title (Row 2) ──
    const reportTitle = title || detectReportTitle(sql, prompt);
    worksheet.mergeCells(2, 1, 2, numCols);
    const cellTitle = worksheet.getCell(2, 1);
    cellTitle.value = reportTitle;
    cellTitle.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FF111827' } };
    cellTitle.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(2).height = 22;

    // ── 3. Subtitle / Period (Row 3) ──
    const periodText = detectPeriod(sql, prompt);
    worksheet.mergeCells(3, 1, 3, numCols);
    const cellSub = worksheet.getCell(3, 1);
    cellSub.value = `${periodText} | TOTAL DATA : ${rows.length.toLocaleString('id-ID')} BARIS`;
    cellSub.font = { name: 'Calibri', size: 10, italic: false, bold: true, color: { argb: 'FF4B5563' } };
    cellSub.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(3).height = 18;

    // Blank row at Row 4
    worksheet.getRow(4).height = 10;

    // ── 4. Table Headers (Row 5) ──
    const headerRow = worksheet.getRow(5);
    headerRow.height = 24;
    columns.forEach((col, colIdx) => {
      const cell = headerRow.getCell(colIdx + 1);
      cell.value = col.header;
      cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF000000' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFD9D9D9' }, // Formal corporate gray
      };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF000000' } },
        bottom: { style: 'thin', color: { argb: 'FF000000' } },
        left: { style: 'thin', color: { argb: 'FF000000' } },
        right: { style: 'thin', color: { argb: 'FF000000' } },
      };
      worksheet.getColumn(colIdx + 1).width = Math.min(Math.max(col.width, 12), 40);
    });

    // ── 5. Data Rows (Starting at Row 6) ──
    let currentRowIdx = 6;
    const totals: Record<string, number> = {};

    rows.forEach((r: Record<string, any>) => {
      const row = worksheet.getRow(currentRowIdx);
      row.height = 19;
      columns.forEach((col, colIdx) => {
        const cell = row.getCell(colIdx + 1);
        let val = r[col.key];

        const isNumCol = numericCols.has(col.key);
        const upperKey = col.key.toUpperCase();

        if (isNumCol && val !== null && val !== undefined && val !== '') {
          const numVal = typeof val === 'number' ? val : parseFloat(String(val).replace(/,/g, ''));
          if (!isNaN(numVal)) {
            cell.value = numVal;
            cell.alignment = { horizontal: 'right', vertical: 'middle' };
            cell.numFmt = Number.isInteger(numVal) ? '#,##0' : '#,##0.00';
            totals[col.key] = (totals[col.key] || 0) + numVal;
          } else {
            cell.value = val;
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
          }
        } else {
          cell.value = val !== null && val !== undefined ? String(val) : '';
          
          if (upperKey.includes('NIK') || upperKey.includes('CD') || upperKey.includes('CODE')) {
            cell.numFmt = '@';
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
          } else if (upperKey.includes('DATE') || upperKey.includes('TGL') || upperKey.includes('SX') || upperKey.includes('KATEGORI')) {
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
          } else {
            cell.alignment = { horizontal: 'left', vertical: 'middle' };
          }
        }

        cell.font = { name: 'Calibri', size: 10, color: { argb: 'FF1F2937' } };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
          bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
          left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
          right: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        };
      });
      currentRowIdx++;
    });

    // ── 6. Summary / Total Row (if numeric columns exist) ──
    if (Object.keys(totals).length > 0) {
      const totalRow = worksheet.getRow(currentRowIdx);
      totalRow.height = 22;

      columns.forEach((col, colIdx) => {
        const cell = totalRow.getCell(colIdx + 1);
        if (colIdx === 0) {
          cell.value = 'TOTAL KESELURUHAN';
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        } else if (totals[col.key] !== undefined) {
          const tot = totals[col.key];
          cell.value = tot;
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
          cell.numFmt = Number.isInteger(tot) ? '#,##0' : '#,##0.00';
        } else {
          cell.value = '';
        }

        cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF111827' } };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF3F4F6' },
        };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF000000' } },
          bottom: { style: 'double', color: { argb: 'FF000000' } },
          left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
          right: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        };
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const safeTitle = (reportTitle || 'Laporan_HRIS').replace(/[\/\\?%*:|"<>]/g, '_').slice(0, 50);

    return new NextResponse(buffer as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${safeTitle}.xlsx"`,
      },
    });
  } catch (error: any) {
    console.error('Export error:', error);
    return NextResponse.json({ error: 'Gagal mengekspor data ke Excel: ' + (error.message || '') }, { status: 500 });
  }
}