import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import ExcelJS from 'exceljs';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('date');
    if (!dateParam) return NextResponse.json({ error: 'date parameter is required' }, { status: 400 });

    const selectedDate = new Date(dateParam);
    const dayOfWeek = selectedDate.getDay(); // 0 = Sunday, 1 = Monday
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    
    const monday = new Date(selectedDate);
    monday.setDate(monday.getDate() + diffToMonday);
    
    const saturday = new Date(monday);
    saturday.setDate(saturday.getDate() + 5);

    const formatYMD = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${dd}`;
    };

    const startDateStr = formatYMD(monday);
    const endDateStr = formatYMD(saturday);

    // Fetch data
    const [absensiResult, reasonResult] = await Promise.all([
      query<any>(`
        SELECT 
          CONVERT(varchar(10), a.DATE_TRANS, 120) AS DATE_TRANS,
          RTRIM(a.EMP_CD) AS EMP_CD,
          RTRIM(e.EMP_NM) AS EMP_NM,
          RTRIM(e.SX) AS SX,
          RTRIM(s.SEC_DESC) AS BAGIAN,
          CASE   WHEN UPPER(RTRIM(s.SEC_DESC)) LIKE '%LINE%' THEN 'SEWING'   WHEN RTRIM(s.SEC_DESC) IN ('BUTTON', 'PATTERN SEAMER') THEN 'SEWING'   WHEN RTRIM(s.SEC_DESC) IN ('BANDLELING', 'CUTTING', 'GANTI BS', 'GELAR', 'GELAR INTERLINING', 'LOADING', 'MARKER', 'NUMBERING', 'PIPING', 'PRESS', 'RELAX') THEN 'CUTTING'   WHEN RTRIM(s.SEC_DESC) IN ('MEKANIK') THEN 'MECHANIC'   WHEN RTRIM(s.SEC_DESC) IN ('LAB', 'PSO', 'QA', 'QC ACCURACY') THEN 'QA'   WHEN RTRIM(s.SEC_DESC) IN ('IE') THEN 'IE'   WHEN RTRIM(s.SEC_DESC) IN ('ACCESSORIES', 'FABRIC', 'IT INVENTORY', 'MATERIAL MGMT', 'TRANSFER') THEN 'WAREHOUSE'   WHEN RTRIM(s.SEC_DESC) IN ('IRONING') THEN 'FINISHING'   WHEN RTRIM(s.SEC_DESC) IN ('PACKING', 'WAREHOUSE') THEN 'PACKING'   WHEN RTRIM(s.SEC_DESC) IN ('END LINE', 'END LINE SPARE', 'IN LINE', 'QC CUTTING', 'QC FABRIC', 'QC FINISHING', 'QC SEWING', 'QC SIZESPEC') THEN 'QC'   WHEN RTRIM(s.SEC_DESC) IN ('ORDER MGMT.') THEN 'PPIC'   WHEN RTRIM(s.SEC_DESC) IN ('CAD MARKER', 'CAD PATTERN', 'SAMPLE', 'SEWING PATTERN') THEN 'SAMPLE'   WHEN RTRIM(s.SEC_DESC) IN ('OFFICE PRODUKSI') THEN 'PROD.  OFFICE'   WHEN RTRIM(s.SEC_DESC) IN ('CLINIC', 'COMPLIANCE', 'HR') THEN 'HRC'   WHEN RTRIM(s.SEC_DESC) IN ('ACC/FIN', 'ACCOUNTING', 'FINANCE', 'PURCHASE') THEN 'ACCOUNTING'   WHEN RTRIM(s.SEC_DESC) IN ('EXIM', 'EXPORT', 'IMPORT', 'SUB-CON') THEN 'EXIM'   WHEN RTRIM(s.SEC_DESC) IN ('5 S', 'IT') THEN 'GA'   WHEN RTRIM(s.SEC_DESC) IN ('COOK', 'CS', 'DRIVER', 'SECURITY') THEN 'GA SERVICE'   WHEN RTRIM(s.SEC_DESC) IN ('UMUM', 'UTILITY') THEN 'MAINTENANCE'   ELSE RTRIM(d.DEP_DESC) END AS TEAM,
          a.OT_1, a.OT_2, a.OT_3, a.OT_4,
          RTRIM(a.STATUS_HARI) as STATUS_HARI,
          RTRIM(a.REASON) as REASON,
          a.JAM_KERJA
        FROM TR_ABSEN a
        LEFT JOIN EMP_TABLE e ON RTRIM(a.EMP_CD) = RTRIM(e.EMP_CD)
        LEFT JOIN MS_SEC s ON RTRIM(e.SEC_CD) = RTRIM(s.SEC_CD)
        LEFT JOIN MS_DEP d ON RTRIM(e.DEP_CD) = RTRIM(d.DEP_CD)
        LEFT JOIN MS_JOBS j ON RTRIM(e.JOB_CD) = RTRIM(j.JOB_CD)
        WHERE a.DATE_TRANS >= '${startDateStr}' AND a.DATE_TRANS <= '${endDateStr}'
        ORDER BY a.EMP_CD, a.DATE_TRANS
      `),
      query<any>(`SELECT RTRIM(REASON_CODE) as REASON_CODE, RTRIM(REASON_GROUP) as REASON_GROUP FROM Ms_Reason`)
    ]);

    const reasonMap = new Map<string, string>();
    reasonResult.forEach((r: any) => {
      if (r.REASON_CODE) reasonMap.set(r.REASON_CODE, r.REASON_GROUP || '');
    });

    const getStatus = (statusHari: string, reasonCode: string) => {
      const mapped = reasonMap.get(reasonCode);
      return (mapped || statusHari || '').trim().toUpperCase();
    };

    // Group by employee
    const empMap = new Map<string, any>();
    absensiResult.forEach((r: any) => {
      if (!empMap.has(r.EMP_CD)) {
        empMap.set(r.EMP_CD, {
          nik: r.EMP_CD,
          nama: r.EMP_NM,
          jk: r.SX,
          bagian: r.BAGIAN,
          team: r.TEAM,
          days: {}
        });
      }
      
      const emp = empMap.get(r.EMP_CD);
      const otTotal = (r.OT_1 || 0) + (r.OT_2 || 0) + (r.OT_3 || 0) + (r.OT_4 || 0);
      const status = getStatus(r.STATUS_HARI, r.REASON);
      
      let kerja = 0;
      if (status === 'KERJA' || status === 'O') {
        kerja = r.JAM_KERJA > 0 ? r.JAM_KERJA : 8; // Assuming 8 hours if not specifically recorded but status is KERJA
      }

      emp.days[r.DATE_TRANS] = {
        kerja,
        ot: otTotal,
        status
      };
    });

    const dates: string[] = [];
    for (let i = 0; i < 6; i++) {
      const d = new Date(monday);
      d.setDate(d.getDate() + i);
      dates.push(formatYMD(d));
    }

    // Build Excel
    const wb = new ExcelJS.Workbook();
    
    const buildSheet = (name: string, includeAisc: boolean) => {
      const ws = wb.addWorksheet(name);
      
      // Title
      ws.mergeCells('A1:X1');
      ws.getCell('A1').value = 'PT. TPINC Trading Jakarta';
      ws.getCell('A1').font = { bold: true, size: 14 };

      ws.mergeCells('M5:T5');
      ws.getCell('M5').value = 'LAPORAN LEMBUR (OVERTIME) PER MINGGU';
      ws.getCell('M5').font = { bold: true, size: 12 };
      ws.getCell('M5').alignment = { horizontal: 'center' };

      ws.mergeCells('M7:T7');
      ws.getCell('M7').value = `PERIODE : ${monday.toLocaleDateString('en-GB', {day: '2-digit', month: 'short', year: '2-digit'})} SD ${saturday.toLocaleDateString('en-GB', {day: '2-digit', month: 'short', year: '2-digit'})}`;
      ws.getCell('M7').font = { bold: true };
      ws.getCell('M7').alignment = { horizontal: 'center' };

      // Table Header Row 1
      ws.getCell('A11').value = 'NIK'; ws.mergeCells('A11:A13');
      ws.getCell('B11').value = 'NAMA'; ws.mergeCells('B11:B13');
      ws.getCell('C11').value = 'L/P'; ws.mergeCells('C11:C13');
      ws.getCell('D11').value = 'BAGIAN'; ws.mergeCells('D11:D13');
      ws.getCell('E11').value = 'TEAM'; ws.mergeCells('E11:E13');

      let colIdx = 6; // F
      dates.forEach((d) => {
        const cell = ws.getCell(11, colIdx);
        cell.value = d;
        ws.mergeCells(11, colIdx, 11, colIdx + 1);
        
        ws.getCell(12, colIdx).value = 'KERJA';
        ws.getCell(12, colIdx + 1).value = 'OT';
        colIdx += 2;
      });

      // Total
      ws.getCell(11, colIdx).value = 'TOTAL';
      ws.mergeCells(11, colIdx, 11, colIdx + 2);
      ws.getCell(12, colIdx).value = 'KERJA';
      ws.getCell(12, colIdx + 1).value = 'OT';
      ws.getCell(12, colIdx + 2).value = 'KERJA +OT';
      
      let nextCol = colIdx + 3;

      if (includeAisc) {
        ws.getCell(11, nextCol).value = 'A';
        ws.getCell(11, nextCol + 1).value = 'I';
        ws.getCell(11, nextCol + 2).value = 'S';
        ws.getCell(11, nextCol + 3).value = 'C';
        ws.mergeCells(11, nextCol, 12, nextCol);
        ws.mergeCells(11, nextCol + 1, 12, nextCol + 1);
        ws.mergeCells(11, nextCol + 2, 12, nextCol + 2);
        ws.mergeCells(11, nextCol + 3, 12, nextCol + 3);
      }

      // Column numbers (Row 13)
      for (let c = 1; c <= (includeAisc ? nextCol + 3 : nextCol - 1); c++) {
        ws.getCell(13, c).value = c;
      }

      // Format Header
      for (let r = 11; r <= 13; r++) {
        for (let c = 1; c <= (includeAisc ? nextCol + 3 : nextCol - 1); c++) {
          const cell = ws.getCell(r, c);
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          cell.font = { bold: true };
          cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        }
      }

      // Write Data
      let rowIdx = 14;
      empMap.forEach((emp) => {
        const row = ws.getRow(rowIdx);
        row.getCell(1).value = emp.nik;
        row.getCell(2).value = emp.nama;
        row.getCell(3).value = emp.jk;
        row.getCell(4).value = emp.bagian;
        row.getCell(5).value = emp.team || '-';

        let totKerja = 0;
        let totOt = 0;
        let totA = 0, totI = 0, totS = 0, totC = 0;

        let cIdx = 6;
        dates.forEach(d => {
          const dayData = emp.days[d];
          const k = dayData?.kerja || 0;
          const o = dayData?.ot || 0;
          const s = dayData?.status;

          if (s === 'ALPHA' || s === 'A') totA++;
          else if (s === 'IJIN' || s === 'I') totI++;
          else if (s === 'SAKIT' || s === 'S') totS++;
          else if (s === 'CUTI' || s === 'C' || s === 'H') totC++;

          ws.getCell(rowIdx, cIdx).value = k || '';
          ws.getCell(rowIdx, cIdx + 1).value = o || '';
          totKerja += k;
          totOt += o;
          cIdx += 2;
        });

        ws.getCell(rowIdx, cIdx).value = totKerja || '';
        ws.getCell(rowIdx, cIdx + 1).value = totOt || '';
        ws.getCell(rowIdx, cIdx + 2).value = (totKerja + totOt) || '';
        
        let nIdx = cIdx + 3;
        if (includeAisc) {
          ws.getCell(rowIdx, nIdx).value = totA || '';
          ws.getCell(rowIdx, nIdx + 1).value = totI || '';
          ws.getCell(rowIdx, nIdx + 2).value = totS || '';
          ws.getCell(rowIdx, nIdx + 3).value = totC || '';
        }

        // Borders for data
        for (let c = 1; c <= (includeAisc ? nIdx + 3 : nIdx - 1); c++) {
          ws.getCell(rowIdx, c).border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        }
        
        rowIdx++;
      });

      // Adjust column widths
      ws.getColumn(1).width = 15;
      ws.getColumn(2).width = 30;
      ws.getColumn(3).width = 5;
      ws.getColumn(4).width = 20;
    };

    buildSheet('HARIAN', false);
    buildSheet('ALL IN', true);

    const buffer = await wb.xlsx.writeBuffer();
    
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="OT_REPORT_${startDateStr}.xlsx"`
      }
    });

  } catch (error: any) {
    console.error('Export OT error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
