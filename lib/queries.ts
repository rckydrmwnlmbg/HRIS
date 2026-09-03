/**
 * ==============================================================================
 * BACKUP LOGIKA RESMI DARI LAPORAN OT ANALYSIS (ORIGINAL SOURCE OF TRUTH)
 * ==============================================================================
 * 1. Filter Karyawan Aktif (Laporan OT Asli):
 *    (e.DT_ENTRY IS NULL OR e.DT_ENTRY <= @endDate)
 *    AND (e.DT_RSG IS NULL OR YEAR(e.DT_RSG) <= 1900 OR e.DT_RSG >= @startDate)
 *    AND e.Act_NonAct = 1
 *
 * 2. Pemetaan TEAM (Laporan OT Asli):
 *    Mengelompokkan MS_SEC ke dalam payung departemen pabrik (SEWING, CUTTING, dll)
 * ==============================================================================
 */

export const TEAM_NAME_CASE = `
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
  END
`;

/**
 * Menghasilkan klausa SQL WHERE untuk memfilter karyawan aktif pada suatu periode/tanggal
 * Berdasarkan standar baku Laporan OT Analysis.
 */
export function getActiveEmployeeFilter(options?: {
  startDate?: string;
  endDate?: string;
  date?: string;
  alias?: string;
}): string {
  const a = options?.alias || 'e';
  const start = options?.startDate || options?.date;
  const end = options?.endDate || options?.date;

  let clause = `${a}.Act_NonAct = 1`;

  if (end) {
    clause += ` AND (${a}.DT_ENTRY IS NULL OR CONVERT(varchar(10), ${a}.DT_ENTRY, 120) <= '${end}')`;
  }

  if (start) {
    clause += ` AND (${a}.DT_RSG IS NULL OR YEAR(${a}.DT_RSG) <= 1900 OR CONVERT(varchar(10), ${a}.DT_RSG, 120) >= '${start}')`;
  }

  return clause;
}
