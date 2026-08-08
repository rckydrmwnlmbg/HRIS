import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { query } from '@/lib/db';
import { calculateSecurityOtHours, detectSecurityShift, getDurationMinutes, getSecurityShiftByCode, isSecurityJob, isValidAttendancePair } from '@/lib/securitySchedule';

const addTitleAndHeader = (sheet: any, columns: any[], title: string, subtitle: string, fgColor: string = 'FF00B050') => {
  sheet.columns = columns;
  sheet.spliceRows(1, 0, [], [], []);

  sheet.getCell('A1').value = title;
  sheet.mergeCells(1, 1, 1, columns.length);
  sheet.getCell('A1').font = { size: 14, bold: true };
  sheet.getCell('A1').alignment = { horizontal: 'center' };

  sheet.getCell('A2').value = subtitle;
  sheet.mergeCells(2, 1, 2, columns.length);
  sheet.getCell('A2').alignment = { horizontal: 'center', vertical: 'middle' };

  const headerRow = sheet.getRow(4);
  headerRow.font = { color: { argb: 'FFFFFFFF' }, bold: true };
  headerRow.eachCell((cell: any) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fgColor } };
  });
};

const applyTableBorders = (sheet: any, columnsCount: number) => {
  sheet.eachRow((row: any, rowNumber: number) => {
    if (rowNumber >= 4) {
      for (let i = 1; i <= columnsCount; i++) {
        const cell = row.getCell(i);
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      }
    }
  });
};

export async function GET(request: Request) {
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    if (dateStr.includes('T')) dateStr = dateStr.split('T')[0];
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  };

  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || 'absensi';
  const bulan = parseInt(searchParams.get('bulan') || String(new Date().getMonth() + 1), 10);
  const tahun = parseInt(searchParams.get('tahun') || String(new Date().getFullYear()), 10);
  const secCd = searchParams.get('sec') || null;
  const jobCd = searchParams.get('job') || null;
  const shift = searchParams.get('shift') || null;
  const format = searchParams.get('format') || 'excel'; // 'excel' or 'json'

  const startParam = searchParams.get('start');
  const endParam = searchParams.get('end');
  const nikParam = searchParams.get('nik');

  try {
    let extraCondition = '';
    if (secCd) extraCondition += ` AND RTRIM(e.SEC_CD) = '${secCd.replace(/'/g, "''")}'`;
    if (jobCd) extraCondition += ` AND RTRIM(e.JOB_CD) = '${jobCd.replace(/'/g, "''")}'`;
    if (nikParam) extraCondition += ` AND RTRIM(a.EMP_CD) = '${nikParam.replace(/'/g, "''")}'`;

    // Shift filter (only applied if type === 'absensi', handled via extraCondition for now)
    if (type === 'absensi' && shift === 'pagi') {
      extraCondition += ` AND DATEPART(hour, a.WORK_IN) < 12 AND RTRIM(j.JOB_DESC) = 'SECURITY'`;
    } else if (type === 'absensi' && shift === 'sore') {
      extraCondition += ` AND DATEPART(hour, a.WORK_IN) >= 12 AND RTRIM(j.JOB_DESC) = 'SECURITY'`;
    }

    let previewData: any[] = [];

    if (type === 'absensi') {
      const lastDayOfMonth = new Date(tahun, bulan, 0).getDate();
      const dateCondition = (startParam && endParam)
        ? `a.DATE_TRANS >= '${startParam}' AND a.DATE_TRANS <= '${endParam}'`
        : `a.DATE_TRANS >= '${tahun}-${String(bulan).padStart(2, '0')}-01' AND a.DATE_TRANS <= '${tahun}-${String(bulan).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}'`;

      const rawAbsensiData = await query<any>(`
        SELECT 
          CONVERT(varchar(10), a.DATE_TRANS, 103) AS TANGGAL,
          CONVERT(varchar(10), a.DATE_TRANS, 120) AS dateRaw,
          RTRIM(e.EMP_CD) AS NIK,
          RTRIM(e.EMP_NM) AS NAMA,
          RTRIM(e.SX) AS LP,
          CASE WHEN UPPER(ISNULL(RTRIM(e.ALL_IN), '0')) IN ('1', 'Y', 'TRUE') THEN 'ALL IN' ELSE 'HARIAN' END AS JNSKAR,
          RTRIM(j.JOB_DESC) AS JABATAN,
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
          RTRIM(s.SEC_DESC) AS BAGIAN,
          CONVERT(varchar(5), a.WORK_IN, 108) AS MASUK,
          CONVERT(varchar(5), a.WORK_OUT, 108) AS PULANG,
          RTRIM(a.STATUS_HARI) AS STATUS_HARI,
          COALESCE(RTRIM(mr.REASON_DESC), RTRIM(a.REASON), '') AS ALASAN,
          CASE 
            WHEN a.WORK_IN IS NOT NULL AND RTRIM(a.STATUS_HARI) IN ('KERJA', 'O') THEN 
                 CASE WHEN a.JAM_KERJA IS NOT NULL AND a.JAM_KERJA < 8 THEN a.JAM_KERJA ELSE 8 END
            WHEN RTRIM(a.STATUS_HARI) IN ('KERJA', 'O') OR RTRIM(mr.REASON_GROUP) = 'O' THEN 8 
            WHEN RTRIM(a.STATUS_HARI) IN ('CUTI', 'C', 'H', 'HAID') OR RTRIM(mr.REASON_GROUP) IN ('C', 'H') THEN 8
            ELSE 0 
          END AS BASIC,
          CAST(ISNULL(a.OT_1, 0) AS DECIMAL(10,1)) AS OT1,
          CAST(ISNULL(a.OT_2, 0) AS DECIMAL(10,1)) AS OT2,
          CAST(ISNULL(a.OT_3, 0) AS DECIMAL(10,1)) AS OT3,
          CAST(ISNULL(a.OT_4, 0) AS DECIMAL(10,1)) AS OT4,
          CAST(
            (CASE 
              WHEN a.WORK_IN IS NOT NULL AND RTRIM(a.STATUS_HARI) IN ('KERJA', 'O') THEN 
                   CASE WHEN a.JAM_KERJA IS NOT NULL AND a.JAM_KERJA < 8 THEN a.JAM_KERJA ELSE 8 END
              WHEN RTRIM(a.STATUS_HARI) IN ('KERJA', 'O') OR RTRIM(mr.REASON_GROUP) = 'O' THEN 8 
              WHEN RTRIM(a.STATUS_HARI) IN ('CUTI', 'C', 'H', 'HAID') OR RTRIM(mr.REASON_GROUP) IN ('C', 'H') THEN 8
              ELSE 0 
            END) + ISNULL(a.OT_1, 0) + ISNULL(a.OT_2, 0) + ISNULL(a.OT_3, 0) + ISNULL(a.OT_4, 0)
            AS DECIMAL(10,1)
          ) AS TOTAL
        FROM TR_ABSEN a
        LEFT JOIN EMP_TABLE e ON RTRIM(a.EMP_CD) = RTRIM(e.EMP_CD)
        LEFT JOIN MS_DEP d ON e.DEP_CD = d.DEP_CD
        LEFT JOIN MS_SEC s ON e.SEC_CD = s.SEC_CD
        LEFT JOIN MS_JOBS j ON e.JOB_CD = j.JOB_CD
        LEFT JOIN Ms_Reason mr ON RTRIM(a.REASON) = RTRIM(mr.REASON_CODE)
        WHERE ${dateCondition} ${extraCondition}
        ORDER BY RTRIM(s.SEC_DESC) ASC, RTRIM(e.EMP_NM) ASC, a.DATE_TRANS ASC
      `);
      previewData = rawAbsensiData;

      if (format === 'json') {
        return NextResponse.json(previewData);
      }

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('rptAbsensi', { views: [{ showGridLines: true }] });

      const headers = [
        { header: 'TANGGAL', key: 'TANGGAL', width: 14 },
        { header: 'NIK', key: 'NIK', width: 13 },
        { header: 'NAMA', key: 'NAMA', width: 28 },
        { header: 'L/P', key: 'LP', width: 6 },
        { header: 'JNSKAR', key: 'JNSKAR', width: 12 },
        { header: 'JABATAN', key: 'JABATAN', width: 20 },
        { header: 'TEAM', key: 'TEAM', width: 18 },
        { header: 'BAGIAN', key: 'BAGIAN', width: 20 },
        { header: 'MASUK', key: 'MASUK', width: 10 },
        { header: 'PULANG', key: 'PULANG', width: 10 },
        { header: 'STATUS HARI', key: 'STATUS_HARI', width: 14 },
        { header: 'ALASAN', key: 'ALASAN', width: 18 },
        { header: 'BASIC', key: 'BASIC', width: 8 },
        { header: 'OT 1', key: 'OT1', width: 8 },
        { header: 'OT 2', key: 'OT2', width: 8 },
        { header: 'OT3', key: 'OT3', width: 8 },
        { header: 'OT 4', key: 'OT4', width: 8 },
        { header: 'TOTAL', key: 'TOTAL', width: 8 },
      ];

      worksheet.columns = headers;

      // Style Header Row (Row 1)
      const headerRow = worksheet.getRow(1);
      headerRow.height = 24;
      headerRow.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF000000' } };
      headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
      headerRow.eachCell((cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFD9D9D9' }
        };
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });

      // Style Data Rows
      previewData.forEach((row: any) => {
        const addedRow = worksheet.addRow({
          TANGGAL: row.TANGGAL,
          NIK: row.NIK,
          NAMA: row.NAMA,
          LP: row.LP,
          JNSKAR: row.JNSKAR,
          JABATAN: row.JABATAN || '-',
          TEAM: row.TEAM || '-',
          BAGIAN: row.BAGIAN || '-',
          MASUK: row.MASUK || '',
          PULANG: row.PULANG || '',
          STATUS_HARI: row.STATUS_HARI || '',
          ALASAN: row.ALASAN || '',
          BASIC: Number(row.BASIC).toFixed(1),
          OT1: Number(row.OT1).toFixed(1),
          OT2: Number(row.OT2).toFixed(1),
          OT3: Number(row.OT3).toFixed(1),
          OT4: Number(row.OT4).toFixed(1),
          TOTAL: Number(row.TOTAL).toFixed(1)
        });

        addedRow.height = 19;
        addedRow.font = { name: 'Calibri', size: 10 };

        // Center align
        const centerCols = [1, 2, 4, 5, 9, 10, 11, 13, 14, 15, 16, 17, 18];
        centerCols.forEach(colIdx => {
          addedRow.getCell(colIdx).alignment = { horizontal: 'center', vertical: 'middle' };
        });

        // Left align
        const leftCols = [3, 6, 7, 8, 12];
        leftCols.forEach(colIdx => {
          addedRow.getCell(colIdx).alignment = { horizontal: 'left', vertical: 'middle' };
        });

        for (let i = 1; i <= 18; i++) {
          addedRow.getCell(i).border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          };
        }
      });

      const buffer = await workbook.xlsx.writeBuffer();
      return new NextResponse(buffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="Laporan_${type}_${tahun}${String(bulan).padStart(2, '0')}.xlsx"`,
        },
      });

    } else if (type === 'ot') {
const parts = (searchParams.get('date') || new Date().toISOString().split('T')[0]).split('-');
      const inputDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      const day = inputDate.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      const startD = new Date(inputDate);
      startD.setDate(inputDate.getDate() + diff);

      const weekDates: string[] = [];
      for (let i = 0; i < 7; i++) {
        let d = new Date(startD);
        d.setDate(startD.getDate() + i);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        weekDates.push(`${y}-${m}-${dd}`);
      }
      const startStr = weekDates[0];
      const endStr = weekDates[6];

      const formatDate = (dateStr: string) => {
        const [y, m, d] = dateStr.split('-');
        return `${d}-${m}-${y}`;
      };

      const fileNameTitle = `Laporan Analysis OT ${formatDate(startStr)} sd ${formatDate(endStr)}`;
      const otData = await query<any>(`
        SELECT 
          RTRIM(e.EMP_CD) AS EMP_CD,
          RTRIM(e.EMP_NM) AS EMP_NM,
          RTRIM(e.SX) AS SX,
          RTRIM(d.DEP_DESC) AS DEP_DESC,
          RTRIM(s.SEC_DESC) AS SEC_DESC,
          RTRIM(j.JOB_DESC) AS JOB_DESC,
          CASE   WHEN UPPER(RTRIM(s.SEC_DESC)) LIKE '%LINE%' THEN 'SEWING'   WHEN RTRIM(s.SEC_DESC) IN ('BUTTON', 'PATTERN SEAMER') THEN 'SEWING'   WHEN RTRIM(s.SEC_DESC) IN ('BANDLELING', 'CUTTING', 'GANTI BS', 'GELAR', 'GELAR INTERLINING', 'LOADING', 'MARKER', 'NUMBERING', 'PIPING', 'PRESS', 'RELAX') THEN 'CUTTING'   WHEN RTRIM(s.SEC_DESC) IN ('MEKANIK') THEN 'MECHANIC'   WHEN RTRIM(s.SEC_DESC) IN ('LAB', 'PSO', 'QA', 'QC ACCURACY') THEN 'QA'   WHEN RTRIM(s.SEC_DESC) IN ('IE') THEN 'IE'   WHEN RTRIM(s.SEC_DESC) IN ('ACCESSORIES', 'FABRIC', 'IT INVENTORY', 'MATERIAL MGMT', 'TRANSFER') THEN 'WAREHOUSE'   WHEN RTRIM(s.SEC_DESC) IN ('IRONING') THEN 'FINISHING'   WHEN RTRIM(s.SEC_DESC) IN ('PACKING', 'WAREHOUSE') THEN 'PACKING'   WHEN RTRIM(s.SEC_DESC) IN ('END LINE', 'END LINE SPARE', 'IN LINE', 'QC CUTTING', 'QC FABRIC', 'QC FINISHING', 'QC SEWING', 'QC SIZESPEC') THEN 'QC'   WHEN RTRIM(s.SEC_DESC) IN ('ORDER MGMT.') THEN 'PPIC'   WHEN RTRIM(s.SEC_DESC) IN ('CAD MARKER', 'CAD PATTERN', 'SAMPLE', 'SEWING PATTERN') THEN 'SAMPLE'   WHEN RTRIM(s.SEC_DESC) IN ('OFFICE PRODUKSI') THEN 'PROD.  OFFICE'   WHEN RTRIM(s.SEC_DESC) IN ('CLINIC', 'COMPLIANCE', 'HR') THEN 'HRC'   WHEN RTRIM(s.SEC_DESC) IN ('ACC/FIN', 'ACCOUNTING', 'FINANCE', 'PURCHASE') THEN 'ACCOUNTING'   WHEN RTRIM(s.SEC_DESC) IN ('EXIM', 'EXPORT', 'IMPORT', 'SUB-CON') THEN 'EXIM'   WHEN RTRIM(s.SEC_DESC) IN ('5 S', 'IT') THEN 'GA'   WHEN RTRIM(s.SEC_DESC) IN ('COOK', 'CS', 'DRIVER', 'SECURITY') THEN 'GA SERVICE'   WHEN RTRIM(s.SEC_DESC) IN ('UMUM', 'UTILITY') THEN 'MAINTENANCE'   ELSE RTRIM(d.DEP_DESC) END AS TEAM,
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
          ${extraCondition}
        ORDER BY RTRIM(s.SEC_DESC), RTRIM(e.EMP_NM), a.DATE_TRANS
      `);

      const empMap = new Map();
      otData.forEach((row) => {
        if (!empMap.has(row.EMP_CD)) {
          empMap.set(row.EMP_CD, {
            EMP_CD: row.EMP_CD,
            EMP_NM: row.EMP_NM,
            SX: row.SX || '-',
            SEC_DESC: row.SEC_DESC || '-',
            JOB_DESC: row.JOB_DESC, TEAM: row.TEAM || '-',
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
          
          // Deteksi Weekend (Sabtu/Minggu) atau Hari Libur:
          const dObj = new Date(row.dateStr + 'T00:00:00');
          const dayOfWeek = dObj.getDay(); // 0 = Sunday, 6 = Saturday
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
              const actDur = (inDate && outDate) ? getDurationMinutes(inDate, outDate) / 60 : 0;
              const roundedDur = Math.round(actDur * 10) / 10;
              kerjaHours = Math.min(8, roundedDur);
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
      previewData = Array.from(empMap.values());

      if (format === 'json') return NextResponse.json(previewData);

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
        ws.getCell('A10').value = 'TEAM : ' + (jobCd ? jobCd : 'SELURUH TEAM');

        const headerRow = ws.getRow(12);
        const headerRow13 = ws.getRow(13);

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
            excelRow.getCell(ci).value = Number(dayData.kerja.toFixed(1)).toFixed(1);
            excelRow.getCell(ci + 1).value = Number(dayData.ot.toFixed(1)).toFixed(1);
            ci += 2;
          });

          const kerjaCols = weekDates.map((_, idx) => `${getColName(5 + idx * 2)}${startRow}`).join('+');
          const otCols = weekDates.map((_, idx) => `${getColName(6 + idx * 2)}${startRow}`).join('+');
          const totKerjaCol = getColName(colIndex - 4);
          const totOtCol = getColName(colIndex - 3);

          excelRow.getCell(ci).value = Number(row.totalKerja.toFixed(1)).toFixed(1);
          excelRow.getCell(ci + 1).value = Number(row.totalOt.toFixed(1)).toFixed(1);
          excelRow.getCell(ci + 2).value = Number((row.totalKerja + row.totalOt).toFixed(1)).toFixed(1);
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

        // Compute grand totals server-side
        let grandTotalKerja = 0;
        let grandTotalOt = 0;
        let grandA = 0, grandI = 0, grandS = 0, grandC = 0;
        filteredData.forEach(row => {
          grandTotalKerja += Number(row.totalKerja.toFixed(1));
          grandTotalOt += Number(row.totalOt.toFixed(1));
          grandA += row.A;
          grandI += row.I;
          grandS += row.S;
          grandC += row.C;
        });

        const sumRowIndex = startRow;
        const sumRow = ws.getRow(startRow);

        ws.mergeCells(sumRowIndex, 1, sumRowIndex, colIndex - 4);
        const totalCell = sumRow.getCell(1);
        totalCell.value = 'TOTAL';
        totalCell.font = { bold: true };
        totalCell.alignment = { horizontal: 'center', vertical: 'middle' };

        // Sum columns: TOTAL KERJA, TOTAL OT, TOTAL KERJA+OT, KETERANGAN (A, I, S, C)
        const sumColumns = [
          colIndex - 3, colIndex - 2, colIndex - 1,
          colIndex, colIndex + 1, colIndex + 2, colIndex + 3
        ];

        const sumValues: Record<number, string | number> = {
          [colIndex - 3]: grandTotalKerja.toFixed(1),
          [colIndex - 2]: grandTotalOt.toFixed(1),
          [colIndex - 1]: (grandTotalKerja + grandTotalOt).toFixed(1),
          [colIndex]: grandA,
          [colIndex + 1]: grandI,
          [colIndex + 2]: grandS,
          [colIndex + 3]: grandC,
        };

        for (let c = 1; c < colIndex + 4; c++) {
          const cell = sumRow.getCell(c);
          setBorder(cell);
          if (sumColumns.includes(c)) {
            cell.value = sumValues[c];
            cell.font = { bold: true };
            cell.alignment = { horizontal: 'center' };
          }
        }

        const totKerjaOtColLetter = getColName(colIndex - 2);

        // Compute MAX WT and Working time breakdown server-side
        const kerjaOtValues = filteredData.map(row => Number((row.totalKerja + row.totalOt).toFixed(1)));
        const maxWt = kerjaOtValues.length > 0 ? Math.max(...kerjaOtValues) : 0;
        const countLte40 = kerjaOtValues.filter(v => v <= 40).length;
        const countGt40Lte60 = kerjaOtValues.filter(v => v > 40 && v <= 60).length;
        const countGt60 = kerjaOtValues.filter(v => v > 60).length;

        startRow += 3;
        ws.getCell(startRow, colIndex - 3).value = 'MAX WT';
        ws.getCell(startRow, colIndex - 3).font = { bold: true };
        ws.getCell(startRow, colIndex - 2).value = maxWt.toFixed(1);
        ws.getCell(startRow, colIndex - 2).font = { bold: true };

        startRow += 2;
        ws.getCell(startRow, colIndex - 3).value = 'Working time breakdown';
        ws.getCell(startRow, colIndex - 3).font = { bold: true };

        startRow++;
        ws.getCell(startRow, colIndex - 3).value = '<= 40';
        ws.getCell(startRow, colIndex - 2).value = countLte40;
        const b1Cell = `${getColName(colIndex - 3)}${startRow}`;

        startRow++;
        ws.getCell(startRow, colIndex - 3).value = '40.5 - 60';
        ws.getCell(startRow, colIndex - 2).value = countGt40Lte60;
        const b2Cell = `${getColName(colIndex - 3)}${startRow}`;

        startRow++;
        ws.getCell(startRow, colIndex - 3).value = '>60';
        ws.getCell(startRow, colIndex - 2).value = countGt60;
        const b3Cell = `${getColName(colIndex - 3)}${startRow}`;

        startRow++;
        ws.getCell(startRow, colIndex - 2).value = filteredData.length;
        const totalEmpCell = `${getColName(colIndex - 3)}${startRow}`;

        const targetStat = isAllInFilter ? stats.ALL_IN : stats.HARIAN;
        targetStat.b1Cell = `'${sheetName}'!${b1Cell}`;
        targetStat.b2Cell = `'${sheetName}'!${b2Cell}`;
        targetStat.b3Cell = `'${sheetName}'!${b3Cell}`;
        targetStat.totalCell = `'${sheetName}'!${totalEmpCell}`;

        ws.columns.forEach((c: any) => { c.width = 10; });
        ws.getColumn(2).width = 25;
        ws.getColumn(4).width = 20; // BAGIAN
        ws.getColumn(5).width = 20; // TEAM
      };

      generateSheet('HARIAN', false);
      generateSheet('ALL IN', true);

      // REPORT SHEET (Already created first!)
      coverWs.mergeCells('A2:F2');
      coverWs.getCell('A2').value = 'TMNB WEEKLY O/T  REPORT';
      coverWs.getCell('A2').font = { bold: true, size: 16 };
      coverWs.getCell('A2').alignment = { horizontal: 'left', vertical: 'middle' };

      // Block 1
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

      // Static Table Header
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

      // Data 10-17
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

      // Summary Table
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
          'Among 40.5 and 60 hours', '40.5 - 60',
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
            c.font = { color: { argb: 'FFFF0000' } }; // Red
          }
          if (i === 3) {
            setGrayBg(c); // Total row gray
          }
          if (col === 5) {
            c.font = { color: { argb: 'FF0000FF' }, bold: true }; // Blue
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

      const buffer = await workbook.xlsx.writeBuffer();
      return new NextResponse(buffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${fileNameTitle}.xlsx"`,
        },
      });
    } else if (type === 'cuti') {
      const start = searchParams.get('start') || new Date().toISOString().split('T')[0];
      const end = searchParams.get('end') || new Date().toISOString().split('T')[0];

      const cutiData = await query<any>(`
        SELECT 
          RTRIM(a.EMP_CD) AS EMP_CD,
          RTRIM(e.EMP_NM) AS EMP_NM,
          CONVERT(varchar(10), a.DATE_TRANS, 120) AS dateStr,
          RTRIM(a.STATUS_HARI) AS typeCode,
          RTRIM(a.REASON) AS reasonCode,
          RTRIM(mr.REASON_DESC) AS reasonDesc,
          RTRIM(mr.REASON_GROUP) AS reasonGroup,
          RTRIM(e.SEC_CD) AS SEC_CD,
          RTRIM(s.SEC_DESC) AS SEC_DESC,
          RTRIM(e.DEP_CD) AS DEP_CD,
          RTRIM(d.DEP_DESC) AS DEP_DESC,
          CASE   WHEN UPPER(RTRIM(s.SEC_DESC)) LIKE '%LINE%' THEN 'SEWING'   WHEN RTRIM(s.SEC_DESC) IN ('BUTTON', 'PATTERN SEAMER') THEN 'SEWING'   WHEN RTRIM(s.SEC_DESC) IN ('BANDLELING', 'CUTTING', 'GANTI BS', 'GELAR', 'GELAR INTERLINING', 'LOADING', 'MARKER', 'NUMBERING', 'PIPING', 'PRESS', 'RELAX') THEN 'CUTTING'   WHEN RTRIM(s.SEC_DESC) IN ('MEKANIK') THEN 'MECHANIC'   WHEN RTRIM(s.SEC_DESC) IN ('LAB', 'PSO', 'QA', 'QC ACCURACY') THEN 'QA'   WHEN RTRIM(s.SEC_DESC) IN ('IE') THEN 'IE'   WHEN RTRIM(s.SEC_DESC) IN ('ACCESSORIES', 'FABRIC', 'IT INVENTORY', 'MATERIAL MGMT', 'TRANSFER') THEN 'WAREHOUSE'   WHEN RTRIM(s.SEC_DESC) IN ('IRONING') THEN 'FINISHING'   WHEN RTRIM(s.SEC_DESC) IN ('PACKING', 'WAREHOUSE') THEN 'PACKING'   WHEN RTRIM(s.SEC_DESC) IN ('END LINE', 'END LINE SPARE', 'IN LINE', 'QC CUTTING', 'QC FABRIC', 'QC FINISHING', 'QC SEWING', 'QC SIZESPEC') THEN 'QC'   WHEN RTRIM(s.SEC_DESC) IN ('ORDER MGMT.') THEN 'PPIC'   WHEN RTRIM(s.SEC_DESC) IN ('CAD MARKER', 'CAD PATTERN', 'SAMPLE', 'SEWING PATTERN') THEN 'SAMPLE'   WHEN RTRIM(s.SEC_DESC) IN ('OFFICE PRODUKSI') THEN 'PROD.  OFFICE'   WHEN RTRIM(s.SEC_DESC) IN ('CLINIC', 'COMPLIANCE', 'HR') THEN 'HRC'   WHEN RTRIM(s.SEC_DESC) IN ('ACC/FIN', 'ACCOUNTING', 'FINANCE', 'PURCHASE') THEN 'ACCOUNTING'   WHEN RTRIM(s.SEC_DESC) IN ('EXIM', 'EXPORT', 'IMPORT', 'SUB-CON') THEN 'EXIM'   WHEN RTRIM(s.SEC_DESC) IN ('5 S', 'IT') THEN 'GA'   WHEN RTRIM(s.SEC_DESC) IN ('COOK', 'CS', 'DRIVER', 'SECURITY') THEN 'GA SERVICE'   WHEN RTRIM(s.SEC_DESC) IN ('UMUM', 'UTILITY') THEN 'MAINTENANCE'   ELSE RTRIM(d.DEP_DESC) END AS TEAM
        FROM TR_ABSEN a
        LEFT JOIN EMP_TABLE e ON RTRIM(a.EMP_CD) = RTRIM(e.EMP_CD)
        LEFT JOIN MS_SEC s ON RTRIM(e.SEC_CD) = RTRIM(s.SEC_CD)
        LEFT JOIN MS_DEP d ON RTRIM(e.DEP_CD) = RTRIM(d.DEP_CD)
        LEFT JOIN MS_JOBS j ON RTRIM(e.JOB_CD) = RTRIM(j.JOB_CD)
        LEFT JOIN Ms_Reason mr ON RTRIM(a.REASON) = RTRIM(mr.REASON_CODE)
        WHERE CONVERT(date, a.DATE_TRANS) BETWEEN '${start}' AND '${end}'
          AND (RTRIM(a.STATUS_HARI) IN ('C', 'H', 'CUTI', 'S', 'I') 
               OR RTRIM(a.STATUS_HARI) LIKE 'CUTI%'
               OR RTRIM(mr.REASON_GROUP) IN ('C', 'H', 'S', 'I'))
          ${extraCondition}
        ORDER BY a.EMP_CD, a.DATE_TRANS ASC
      `);

      const groupedRecords: any[] = [];
      let currentGroup: any = null;

      for (const row of cutiData) {
        if (!currentGroup) {
          currentGroup = {
            EMP_CD: row.EMP_CD,
            EMP_NM: row.EMP_NM,
            startDate: row.dateStr,
            endDate: row.dateStr,
            typeCode: row.typeCode,
            reasonCode: row.reasonCode,
            type: row.reasonDesc ? row.reasonDesc : (row.typeCode || 'Unknown'),
            reason: row.reasonDesc ? `${row.reasonDesc} (${row.reasonCode || '-'})` : (row.reasonCode || '-'),
            days: 1,
            SEC_CD: row.SEC_CD,
            SEC_DESC: row.SEC_DESC,
            JOB_DESC: row.JOB_DESC, TEAM: row.TEAM,
            DEP_CD: row.DEP_CD,
            DEP_DESC: row.DEP_DESC
          };
        } else {
          const prevDate = new Date(currentGroup.endDate);
          const currDate = new Date(row.dateStr);
          const diffTime = Math.abs(currDate.getTime() - prevDate.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          if (row.EMP_CD === currentGroup.EMP_CD && row.typeCode === currentGroup.typeCode && row.reasonCode === currentGroup.reasonCode && diffDays === 1) {
            currentGroup.endDate = row.dateStr;
            currentGroup.days += 1;
          } else {
            groupedRecords.push(currentGroup);
            currentGroup = {
              EMP_CD: row.EMP_CD,
              EMP_NM: row.EMP_NM,
              startDate: row.dateStr,
              endDate: row.dateStr,
              typeCode: row.typeCode,
              reasonCode: row.reasonCode,
              type: row.reasonDesc ? row.reasonDesc : (row.typeCode || 'Unknown'),
              reason: row.reasonDesc ? `${row.reasonDesc} (${row.reasonCode || '-'})` : (row.reasonCode || '-'),
              days: 1,
              SEC_CD: row.SEC_CD,
              SEC_DESC: row.SEC_DESC,
              JOB_DESC: row.JOB_DESC, TEAM: row.TEAM,
              DEP_CD: row.DEP_CD,
              DEP_DESC: row.DEP_DESC
            };
          }
        }
      }
      if (currentGroup) {
        groupedRecords.push(currentGroup);
      }

      previewData = groupedRecords;

      if (format === 'json') {
        return NextResponse.json(previewData);
      }

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Laporan Cuti');
      const headerFont: Partial<ExcelJS.Font> = { color: { argb: 'FFFFFFFF' }, bold: true };

      addTitleAndHeader(
        worksheet,
        [
          { header: 'NIK', key: 'nik', width: 15 },
          { header: 'Nama', key: 'nama', width: 25 },
          { header: 'Departemen', key: 'dep', width: 20 },
          { header: 'Bagian', key: 'sec', width: 20 },
          { header: 'Team', key: 'team', width: 20 },
          { header: 'Jenis Cuti', key: 'type', width: 20 },
          { header: 'Mulai', key: 'start', width: 15 },
          { header: 'Selesai', key: 'end', width: 15 },
          { header: 'Hari', key: 'days', width: 10 },
          { header: 'Keterangan', key: 'reason', width: 30 },
        ],
        'LAPORAN CUTI KARYAWAN',
        `Periode: ${formatDate(start)} s/d ${formatDate(end)}`,
        'FF00B050'
      );

      const typeGroups: Record<string, any[]> = {};

      previewData.forEach((row: any) => {
        const typeStr = row.type || '-';
        if (!typeGroups[typeStr]) {
          typeGroups[typeStr] = [];
        }
        typeGroups[typeStr].push(row);

        worksheet.addRow({
          nik: row.EMP_CD,
          nama: row.EMP_NM,
          dep: row.DEP_DESC || '-',
          sec: row.SEC_DESC || '-',
          team: row.TEAM || '-',
          type: typeStr,
          start: new Date(row.startDate).toLocaleDateString('id-ID').replace(/\//g, '-'),
          end: new Date(row.endDate).toLocaleDateString('id-ID').replace(/\//g, '-'),
          days: row.days || 0,
          reason: row.reason || '-'
        });
      });

      applyTableBorders(worksheet, 10);

      for (const [typeStr, rows] of Object.entries(typeGroups)) {
        let safeSheetName = typeStr.replace(/[^a-zA-Z0-9 \-]/g, '').substring(0, 31);
        if (!safeSheetName || safeSheetName === '-') safeSheetName = 'Lainnya';

        let uniqueName = safeSheetName;
        let counter = 1;
        while (workbook.worksheets.find((w: any) => w.name.toLowerCase() === uniqueName.toLowerCase())) {
          uniqueName = `${safeSheetName.substring(0, 27)} (${counter})`;
          counter++;
        }

        const typeSheet = workbook.addWorksheet(uniqueName);
        addTitleAndHeader(
          typeSheet,
          [
            { header: 'NIK', key: 'nik', width: 15 },
            { header: 'Nama', key: 'nama', width: 25 },
            { header: 'Departemen', key: 'dep', width: 20 },
            { header: 'Bagian', key: 'sec', width: 20 },
            { header: 'Team', key: 'team', width: 20 },
            { header: 'Jenis Cuti', key: 'type', width: 20 },
            { header: 'Mulai', key: 'start', width: 15 },
            { header: 'Selesai', key: 'end', width: 15 },
            { header: 'Hari', key: 'days', width: 10 },
            { header: 'Keterangan', key: 'reason', width: 30 },
          ],
          `LAPORAN ${typeStr.toUpperCase()}`,
          `Periode: ${formatDate(start)} s/d ${formatDate(end)}`,
          'FF00B050'
        );

        rows.forEach((row: any) => {
          typeSheet.addRow({
            nik: row.EMP_CD,
            nama: row.EMP_NM,
            dep: row.DEP_DESC || '-',
            sec: row.SEC_DESC || '-',
            team: row.TEAM || '-',
            type: row.type || '-',
            start: new Date(row.startDate).toLocaleDateString('id-ID').replace(/\//g, '-'),
            end: new Date(row.endDate).toLocaleDateString('id-ID').replace(/\//g, '-'),
            days: row.days || 0,
            reason: row.reason || '-'
          });
        });

        applyTableBorders(typeSheet, 10);
      }

      const buffer = await workbook.xlsx.writeBuffer();
      return new NextResponse(buffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="Laporan_${type}_${start}_${end}.xlsx"`,
        },
      });
    } else if (type === 'skorsing') {
      const start = searchParams.get('start') || new Date().toISOString().split('T')[0];
      const end = searchParams.get('end') || new Date().toISOString().split('T')[0];

      const absensiData = await query<any>(`
        SELECT 
          RTRIM(a.EMP_CD) AS EMP_CD,
          RTRIM(e.EMP_NM) AS EMP_NM,
          RTRIM(d.DEP_DESC) AS DEP_DESC,
          RTRIM(s.SEC_DESC) AS SEC_DESC,
          CASE   WHEN UPPER(RTRIM(s.SEC_DESC)) LIKE '%LINE%' THEN 'SEWING'   WHEN RTRIM(s.SEC_DESC) IN ('BUTTON', 'PATTERN SEAMER') THEN 'SEWING'   WHEN RTRIM(s.SEC_DESC) IN ('BANDLELING', 'CUTTING', 'GANTI BS', 'GELAR', 'GELAR INTERLINING', 'LOADING', 'MARKER', 'NUMBERING', 'PIPING', 'PRESS', 'RELAX') THEN 'CUTTING'   WHEN RTRIM(s.SEC_DESC) IN ('MEKANIK') THEN 'MECHANIC'   WHEN RTRIM(s.SEC_DESC) IN ('LAB', 'PSO', 'QA', 'QC ACCURACY') THEN 'QA'   WHEN RTRIM(s.SEC_DESC) IN ('IE') THEN 'IE'   WHEN RTRIM(s.SEC_DESC) IN ('ACCESSORIES', 'FABRIC', 'IT INVENTORY', 'MATERIAL MGMT', 'TRANSFER') THEN 'WAREHOUSE'   WHEN RTRIM(s.SEC_DESC) IN ('IRONING') THEN 'FINISHING'   WHEN RTRIM(s.SEC_DESC) IN ('PACKING', 'WAREHOUSE') THEN 'PACKING'   WHEN RTRIM(s.SEC_DESC) IN ('END LINE', 'END LINE SPARE', 'IN LINE', 'QC CUTTING', 'QC FABRIC', 'QC FINISHING', 'QC SEWING', 'QC SIZESPEC') THEN 'QC'   WHEN RTRIM(s.SEC_DESC) IN ('ORDER MGMT.') THEN 'PPIC'   WHEN RTRIM(s.SEC_DESC) IN ('CAD MARKER', 'CAD PATTERN', 'SAMPLE', 'SEWING PATTERN') THEN 'SAMPLE'   WHEN RTRIM(s.SEC_DESC) IN ('OFFICE PRODUKSI') THEN 'PROD.  OFFICE'   WHEN RTRIM(s.SEC_DESC) IN ('CLINIC', 'COMPLIANCE', 'HR') THEN 'HRC'   WHEN RTRIM(s.SEC_DESC) IN ('ACC/FIN', 'ACCOUNTING', 'FINANCE', 'PURCHASE') THEN 'ACCOUNTING'   WHEN RTRIM(s.SEC_DESC) IN ('EXIM', 'EXPORT', 'IMPORT', 'SUB-CON') THEN 'EXIM'   WHEN RTRIM(s.SEC_DESC) IN ('5 S', 'IT') THEN 'GA'   WHEN RTRIM(s.SEC_DESC) IN ('COOK', 'CS', 'DRIVER', 'SECURITY') THEN 'GA SERVICE'   WHEN RTRIM(s.SEC_DESC) IN ('UMUM', 'UTILITY') THEN 'MAINTENANCE'   ELSE RTRIM(d.DEP_DESC) END AS TEAM,
          CONVERT(varchar(10), a.DATE_TRANS, 120) AS dateStr,
          CONVERT(varchar(8), a.WORK_IN, 108) AS WORK_IN_STR,
          CONVERT(varchar(8), a.WORK_OUT, 108) AS WORK_OUT_STR,
          CASE WHEN UPPER(ISNULL(RTRIM(e.ALL_IN), '0')) IN ('1', 'Y', 'TRUE') THEN 1 ELSE 0 END AS isAllIn
        FROM TR_ABSEN a
        LEFT JOIN EMP_TABLE e ON RTRIM(a.EMP_CD) = RTRIM(e.EMP_CD)
        LEFT JOIN MS_DEP d ON RTRIM(e.DEP_CD) = RTRIM(d.DEP_CD)
        LEFT JOIN MS_SEC s ON RTRIM(e.SEC_CD) = RTRIM(s.SEC_CD)
        LEFT JOIN MS_JOBS j ON RTRIM(e.JOB_CD) = RTRIM(j.JOB_CD)
        WHERE CONVERT(date, a.DATE_TRANS) BETWEEN '${start}' AND '${end}'
        ${extraCondition}
        ORDER BY a.DATE_TRANS ASC, a.EMP_CD ASC
      `);

      const skorsingList: any[] = [];
      
      const todayStrLocal = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD local

      absensiData.forEach(row => {
        let isSkorsing = false;
        let reasons: string[] = [];
        
        let workIn = row.WORK_IN_STR;
        let workOut = row.WORK_OUT_STR;

        // Jam Masuk check (standard 06:50-07:15)
        if (workIn) {
          const inTime = workIn.substring(0, 5);
          if (inTime > "07:15" && inTime < "12:00") {
            isSkorsing = true;
            reasons.push("Terlambat Masuk (" + inTime + ")");
          } else if (inTime < "06:50") {
            isSkorsing = true;
            reasons.push("Masuk Terlalu Awal (" + inTime + ")");
          }
        }

        // Jam Pulang check
        if (workOut) {
          const outTime = workOut.substring(0, 5);
          let isValid = false;

          if (
            (outTime >= "15:50" && outTime <= "16:15") || // Normal Pulang (16:00)
            (outTime >= "16:50" && outTime <= "17:15") || // OT1 (17:00)
            (outTime >= "17:50" && outTime <= "18:15") || // OT2 (18:00)
            (outTime >= "18:50" && outTime <= "19:15") || // OT3 (19:00)
            (outTime >= "19:50" && outTime <= "20:15") || // OT4 (20:00)
            (outTime >= "20:50" && outTime <= "21:15")    // OT5 (21:00)
          ) {
            isValid = true;
          }

          if (!isValid) {
            isSkorsing = true;
            reasons.push("Pelanggaran Jam Pulang (" + outTime + ")");
          }
        } else if (workIn) {
          // Jam Pulang Kosong (Tidak Absen Pulang)
          if (row.dateStr !== todayStrLocal) {
             isSkorsing = true;
             reasons.push("Tidak Absen Pulang");
          }
        }

        if (isSkorsing) {
          skorsingList.push({
            ...row,
            reason: reasons.join(", ")
          });
        }
      });

      if (format === 'json') {
        return NextResponse.json(skorsingList);
      }

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Skorsing Report');

      addTitleAndHeader(
        worksheet,
        [
          { header: 'NIK', key: 'nik', width: 12 },
          { header: 'NAMA', key: 'nama', width: 25 },
          { header: 'BAGIAN', key: 'sec', width: 20 },
          { header: 'TEAM', key: 'team', width: 20 },
          { header: 'TANGGAL', key: 'date', width: 15 },
          { header: 'JAM MASUK', key: 'in', width: 15 },
          { header: 'JAM PULANG', key: 'out', width: 15 },
          { header: 'KETERANGAN PELANGGARAN', key: 'reason', width: 45 }
        ],
        'LAPORAN SKORSING KARYAWAN',
        `Periode: ${formatDate(start)} s/d ${formatDate(end)}`,
        'FFFFC000'
      );

      skorsingList.forEach(row => {
        worksheet.addRow({
          nik: row.EMP_CD,
          nama: row.EMP_NM,
          sec: row.SEC_DESC || '-',
          team: row.TEAM || '-',
          date: formatDate(row.dateStr),
          in: row.WORK_IN_STR || '-',
          out: row.WORK_OUT_STR || '-',
          reason: row.reason || '-'
        });
      });

      applyTableBorders(worksheet, 8);
      const buffer = await workbook.xlsx.writeBuffer();
      return new NextResponse(buffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="Laporan_Skorsing_${start}_${end}.xlsx"`,
        },
      });
    }
  } catch (error) {
    console.error('Excel generation error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
