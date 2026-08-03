import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
// @ts-ignore
import ExcelJS from 'exceljs/dist/exceljs.min.js';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const bulan = searchParams.get('bulan') || new Date().getMonth() + 1;
    const tahun = searchParams.get('tahun') || new Date().getFullYear();

    const data = await query<any>(`
      SELECT 
        l.ID,
        CONVERT(varchar(10), l.DATE_TRANS, 120) AS DATE_TRANS,
        RTRIM(l.EMP_CD) AS EMP_CD,
        RTRIM(e.EMP_NM) AS EMP_NM,
        l.JAM_MULAI,
        l.JAM_SELESAI,
        l.NOMINAL,
        RTRIM(sec.SEC_DESC) AS SEC_DESC,
        CASE   WHEN UPPER(RTRIM(sec.SEC_DESC)) LIKE '%LINE%' THEN 'SEWING'   WHEN RTRIM(sec.SEC_DESC) IN ('BUTTON', 'PATTERN SEAMER') THEN 'SEWING'   WHEN RTRIM(sec.SEC_DESC) IN ('BANDLELING', 'CUTTING', 'GANTI BS', 'GELAR', 'GELAR INTERLINING', 'LOADING', 'MARKER', 'NUMBERING', 'PIPING', 'PRESS', 'RELAX') THEN 'CUTTING'   WHEN RTRIM(sec.SEC_DESC) IN ('MEKANIK') THEN 'MECHANIC'   WHEN RTRIM(sec.SEC_DESC) IN ('LAB', 'PSO', 'QA', 'QC ACCURACY') THEN 'QA'   WHEN RTRIM(sec.SEC_DESC) IN ('IE') THEN 'IE'   WHEN RTRIM(sec.SEC_DESC) IN ('ACCESSORIES', 'FABRIC', 'IT INVENTORY', 'MATERIAL MGMT', 'TRANSFER') THEN 'WAREHOUSE'   WHEN RTRIM(sec.SEC_DESC) IN ('IRONING') THEN 'FINISHING'   WHEN RTRIM(sec.SEC_DESC) IN ('PACKING', 'WAREHOUSE') THEN 'PACKING'   WHEN RTRIM(sec.SEC_DESC) IN ('END LINE', 'END LINE SPARE', 'IN LINE', 'QC CUTTING', 'QC FABRIC', 'QC FINISHING', 'QC SEWING', 'QC SIZESPEC') THEN 'QC'   WHEN RTRIM(sec.SEC_DESC) IN ('ORDER MGMT.') THEN 'PPIC'   WHEN RTRIM(sec.SEC_DESC) IN ('CAD MARKER', 'CAD PATTERN', 'SAMPLE', 'SEWING PATTERN') THEN 'SAMPLE'   WHEN RTRIM(sec.SEC_DESC) IN ('OFFICE PRODUKSI') THEN 'PROD.  OFFICE'   WHEN RTRIM(sec.SEC_DESC) IN ('CLINIC', 'COMPLIANCE', 'HR') THEN 'HRC'   WHEN RTRIM(sec.SEC_DESC) IN ('ACC/FIN', 'ACCOUNTING', 'FINANCE', 'PURCHASE') THEN 'ACCOUNTING'   WHEN RTRIM(sec.SEC_DESC) IN ('EXIM', 'EXPORT', 'IMPORT', 'SUB-CON') THEN 'EXIM'   WHEN RTRIM(sec.SEC_DESC) IN ('5 S', 'IT') THEN 'GA'   WHEN RTRIM(sec.SEC_DESC) IN ('COOK', 'CS', 'DRIVER', 'SECURITY') THEN 'GA SERVICE'   WHEN RTRIM(sec.SEC_DESC) IN ('UMUM', 'UTILITY') THEN 'MAINTENANCE'   ELSE RTRIM(d.DEP_DESC) END AS TEAM
      FROM TR_LEMBUR_ALLIN l
      LEFT JOIN EMP_TABLE e ON RTRIM(l.EMP_CD) = RTRIM(e.EMP_CD)
      LEFT JOIN MS_JOBS j ON RTRIM(e.JOB_CD) = RTRIM(j.JOB_CD)
      LEFT JOIN MS_SEC sec ON RTRIM(e.SEC_CD) = RTRIM(sec.SEC_CD)
      LEFT JOIN MS_DEP d ON RTRIM(e.DEP_CD) = RTRIM(d.DEP_CD)
      WHERE MONTH(l.DATE_TRANS) = ${bulan} 
        AND YEAR(l.DATE_TRANS) = ${tahun}
      ORDER BY l.DATE_TRANS ASC, e.EMP_NM ASC
    `);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Lembur ALL IN');

    // Title
    sheet.mergeCells('A1:H1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = `DATA LEMBUR KARYAWAN ALL IN - PERIODE ${bulan}/${tahun}`;
    titleCell.font = { name: 'Arial', size: 14, bold: true };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // Headers
    const headers = ['NO', 'TANGGAL', 'NIK', 'NAMA KARYAWAN', 'BAGIAN', 'TEAM', 'JAM LEMBUR', 'NOMINAL (Rp)'];
    const headerRow = sheet.addRow(headers);
    headerRow.font = { bold: true };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
    
    // Add border and background to headers
    headerRow.eachCell((cell: any) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });

    // Set Column Widths
    sheet.getColumn(1).width = 5;
    sheet.getColumn(2).width = 15;
    sheet.getColumn(3).width = 15;
    sheet.getColumn(4).width = 30;
    sheet.getColumn(5).width = 20;
    sheet.getColumn(6).width = 20;
    sheet.getColumn(7).width = 15;
    sheet.getColumn(8).width = 15;

    let totalNominal = 0;

    data.forEach((row, index) => {
      const nominal = Number(row.NOMINAL) || 0;
      totalNominal += nominal;

      const dataRow = sheet.addRow([
        index + 1,
        row.DATE_TRANS,
        row.EMP_CD,
        row.EMP_NM,
        row.SEC_DESC || '-',
        row.TEAM || '-',
        `${row.JAM_MULAI} - ${row.JAM_SELESAI}`,
        nominal
      ]);

      // Apply borders and format
      dataRow.eachCell((cell: any, colNumber: number) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
        if (colNumber === 8) {
          cell.numFmt = '#,##0';
        }
      });
      dataRow.getCell(1).alignment = { horizontal: 'center' };
      dataRow.getCell(2).alignment = { horizontal: 'center' };
      dataRow.getCell(7).alignment = { horizontal: 'center' };
    });

    // Total Row
    const totalRow = sheet.addRow(['', '', '', '', '', '', 'TOTAL', totalNominal]);
    totalRow.font = { bold: true };
    totalRow.getCell(7).alignment = { horizontal: 'right' };
    totalRow.getCell(8).numFmt = '#,##0';
    totalRow.eachCell((cell: any) => {
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFFF00' }
      };
    });
    sheet.mergeCells(`A${totalRow.number}:F${totalRow.number}`);

    const buffer = await workbook.xlsx.writeBuffer();
    
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename=Lembur_ALLIN_${bulan}_${tahun}.xlsx`,
      },
    });
  } catch (error: any) {
    console.error('Export Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
