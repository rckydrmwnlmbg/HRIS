'use client';
import { useState, useEffect, useMemo } from 'react';
import { Search, Save, Clock, Download, ChevronRight, CheckSquare, Printer, ClipboardList } from 'lucide-react';
import { useApp } from '@/lib/context';
import { t } from '@/lib/i18n';

interface HeadcountRow {
  SEC_CD: string;
  LINE_NAME: string;
  TOTAL_MOR: number;
  TOTAL_CHIEF: number;
  TOTAL_SPV: number;
  TOTAL_ASST: number;
  TOTAL_ADM: number;
  TOTAL_SPECIAL: number;
  TOTAL_OPR: number;
  TOTAL_HLP: number;
  TOTAL_PLANTER: number;
  TOTAL_WORKERS: number;
  
  JOB_DESC: string;
  JAM_17_OPR: number;
  JAM_17_HLP: number;
  JAM_18_OPR: number;
  JAM_18_HLP: number;
  JAM_19_OPR: number;
  JAM_19_HLP: number;
  JAM_20_OPR: number;
  JAM_20_HLP: number;
}

const DIRECT_WORKER_LINES = [
  '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', 
  '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', 
  '21', '22', '23', '24', '25', '26', '27', '28', '29',
  'CHIEF, SPV, ASST, ADM', 'HAND SEW', 'SEAMER'
];

const TECHNICAL_LINES = [
  'CUTTING-COLLAR', 'MECHANIC', 'GA & PSO', 'TECHNICIAN / IE', 'CAD', 'PATTERN'
];

const NON_TECHNICAL_LINES = [
  'WAREHOUSE', 'CUTTING-SPREADING', 'NUMBERING, ETC', 'IRONING', 'PACKING', 'INSPECT SEWING', 'INSPECT FINISHING'
];

const SAMPLE_LINES = ['SAMPLE'];

const OFFICE_LINES = ['FAC. OFFICE', 'MARKETING'];

const INDIRECT_WORKER_LINES = [
  'OFFICE (ACC, EXIM, HRC, GA, IT)', 'CLEANING SERVICE', 'DRIVER', 'SECURITY', 'MAINTENANCE', 'ADMINISTRATIVE WORKER', 'EXPATRIATE'
];

export default function SplPlanningPage() {
  const { settings } = useApp();
  const lang = settings.language;
  const [dateStr, setDateStr] = useState(new Date().toISOString().split('T')[0]);
  const [data, setData] = useState<HeadcountRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'attendance' | 'plan' | 'finance'>('attendance');
  const [highestStep, setHighestStep] = useState(1);
  const [isAttendanceApproved, setIsAttendanceApproved] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const handleDownloadPdf = async () => {
    setIsGeneratingPdf(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');
      
      const element = document.getElementById('attendance-table-container');
      if (!element) return;
      
      document.body.classList.add('exporting-pdf');
      element.classList.add('pdf-export-mode');
      
      const canvas = await html2canvas(element, { scale: 3, useCORS: true });
      const imgData = canvas.toDataURL('image/jpeg', 1.0);
      
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      const imgProps = pdf.getImageProperties(imgData);
      const margin = 5;
      const printWidth = pdfWidth - (margin * 2);
      const printHeight = (imgProps.height * printWidth) / imgProps.width;
      
      let finalHeight = printHeight;
      let finalWidth = printWidth;
      
      // Strict: If it's still taller than A4 height, squish it down to fit 1 page EXACTLY!
      if (printHeight > (pdfHeight - (margin * 2))) {
        finalHeight = pdfHeight - (margin * 2);
        finalWidth = (imgProps.width * finalHeight) / imgProps.height;
      }
      
      // Center horizontally if squished
      const xOffset = margin + (printWidth - finalWidth) / 2;
      
      pdf.addImage(imgData, 'JPEG', xOffset, margin, finalWidth, finalHeight);
      pdf.save(`SPL_Daily_Attendance_${dateStr}.pdf`);
      
      element.classList.remove('pdf-export-mode');
      document.body.classList.remove('exporting-pdf');
    } catch (err) {
      console.error('PDF Error:', err);
      alert(lang === 'id' ? 'Terjadi kendala saat menyusun dokumen' : 'Failed to generate document');
    }
    setIsGeneratingPdf(false);
  };

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/lembur/daily-headcount?date=${dateStr}`);
      if (res.ok) {
        const json = await res.json();
        
        // Helper to map a paper line name to aggregated API rows
        const mapRow = (lineName: string) => {
          let matchingSecs: string[] = [];

          if (lineName === 'CHIEF, SPV, ASST, ADM') matchingSecs = ['CHIEF, SPV, ASST, ADM']; // Keep as is if exists
          else if (lineName === 'CUTTING-COLLAR') matchingSecs = ['CUTTING', 'CUTTING COLLAR'];
          else if (lineName === 'MECHANIC') matchingSecs = ['MEKANIK', 'MECHANIC'];
          else if (lineName === 'GA & PSO') matchingSecs = ['GA', 'PSO'];
          else if (lineName === 'TECHNICIAN / IE') matchingSecs = ['IE', 'TECHNICIAN'];
          else if (lineName === 'CAD') matchingSecs = ['CAD MARKER', 'CAD PATTERN', 'CAD'];
          else if (lineName === 'PATTERN') matchingSecs = ['PATTERN'];
          else if (lineName === 'WAREHOUSE') matchingSecs = ['WAREHOUSE', 'LOADING'];
          else if (lineName === 'CUTTING-SPREADING') matchingSecs = ['GELAR', 'NUMBERING', 'BANDLELING', 'INTERLINING', 'PIPING', 'PRESS', 'GELAR INTERLINING', 'MARKER'];
          else if (lineName === 'NUMBERING, ETC') matchingSecs = []; // Absorbed by CUTTING-SPREADING, but we'll leave it 0 if it's a separate line
          else if (lineName === 'INSPECT SEWING') matchingSecs = ['QC SEWING', 'IN LINE', 'END LINE', 'END LINE SPARE', 'QC SIZESPEC'];
          else if (lineName === 'INSPECT FINISHING') matchingSecs = ['QC FINISHING', 'QC ACCURACY'];
          else if (lineName === 'SAMPLE') matchingSecs = ['SAMPLE', 'SEWING PATTERN'];
          else if (lineName === 'FAC. OFFICE') matchingSecs = ['OFFICE PRODUKSI', 'ORDER MGMT.', 'PURCHASE'];
          else if (lineName === 'MARKETING') matchingSecs = ['MARKETING'];
          else if (lineName === 'OFFICE (ACC, EXIM, HRC, GA, IT)') matchingSecs = ['ACCOUNTING', 'EXIM', 'HR', 'IT', 'FINANCE', 'EXPORT', 'IMPORT', 'UMUM'];
          else if (lineName === 'CLEANING SERVICE') matchingSecs = ['CS', '5 S', 'CLEANING'];
          else if (lineName === 'MAINTENANCE') matchingSecs = ['MAINTENANCE', 'UTILITY', 'BOILER'];
          else matchingSecs = [lineName.toUpperCase()];

          // Filter API response for any matching sections
          const matchedApiRows = json.filter((r: any) => 
            matchingSecs.includes(r.LINE_NAME?.toUpperCase()) || 
            r.SEC_CD === lineName
          );
          
          return {
            SEC_CD: matchedApiRows.length > 0 ? matchedApiRows[0].SEC_CD : lineName,
            LINE_NAME: lineName,
            TOTAL_MOR: matchedApiRows.reduce((sum: number, r: any) => sum + (r.TOTAL_MOR || 0), 0),
            TOTAL_CHIEF: matchedApiRows.reduce((sum: number, r: any) => sum + (r.TOTAL_CHIEF || 0), 0),
            TOTAL_SPV: matchedApiRows.reduce((sum: number, r: any) => sum + (r.TOTAL_SPV || 0), 0),
            TOTAL_ASST: matchedApiRows.reduce((sum: number, r: any) => sum + (r.TOTAL_ASST || 0), 0),
            TOTAL_ADM: matchedApiRows.reduce((sum: number, r: any) => sum + (r.TOTAL_ADM || 0), 0),
            TOTAL_SPECIAL: matchedApiRows.reduce((sum: number, r: any) => sum + (r.TOTAL_SPECIAL || 0), 0),
            TOTAL_OPR: matchedApiRows.reduce((sum: number, r: any) => sum + (r.TOTAL_OPR || 0), 0),
            TOTAL_HLP: matchedApiRows.reduce((sum: number, r: any) => sum + (r.TOTAL_HLP || 0), 0),
            TOTAL_PLANTER: matchedApiRows.reduce((sum: number, r: any) => sum + (r.TOTAL_PLANTER || 0), 0),
            TOTAL_WORKERS: matchedApiRows.reduce((sum: number, r: any) => sum + (r.TOTAL_WORKERS || 0), 0),
            JOB_DESC: '',
            JAM_17_OPR: 0, JAM_17_HLP: 0,
            JAM_18_OPR: 0, JAM_18_HLP: 0,
            JAM_19_OPR: 0, JAM_19_HLP: 0,
            JAM_20_OPR: 0, JAM_20_HLP: 0,
          };
        };

        const allRows = [
          ...DIRECT_WORKER_LINES.map(mapRow),
          ...TECHNICAL_LINES.map(mapRow),
          ...NON_TECHNICAL_LINES.map(mapRow),
          ...SAMPLE_LINES.map(mapRow),
          ...OFFICE_LINES.map(mapRow),
          ...INDIRECT_WORKER_LINES.map(mapRow)
        ];
        
        setData(allRows);
        setActiveTab('attendance');
        setHighestStep(1);
        setIsAttendanceApproved(false);
      }
    } catch (error) {
      console.error(error);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [dateStr]);

  const handleInputChange = (index: number, field: keyof HeadcountRow, value: string) => {
    const newData = [...data];
    if (field === 'JOB_DESC') {
      (newData[index][field] as any) = value;
    } else {
      (newData[index][field] as any) = parseInt(value) || 0;
    }
    setData(newData);
  };

  const handleApproveAttendance = () => {
    if (!isAttendanceApproved) {
      alert(lang === 'id' ? 'Harap konfirmasi verifikasi data kehadiran terlebih dahulu!' : 'Please confirm attendance data verification first!');
      return;
    }
    setActiveTab('plan');
    setHighestStep(Math.max(highestStep, 2));
  };

  const sumGroup = (lines: string[], field: keyof HeadcountRow) => {
    return data.filter(r => lines.includes(r.LINE_NAME)).reduce((sum, r) => sum + (Number(r[field]) || 0), 0);
  };

  const renderAttendanceRow = (row: HeadcountRow, isBold: boolean = false, isHeader: boolean = false) => {
    return (
      <tr key={row.LINE_NAME} style={isBold ? { fontWeight: 'bold' } : {}}>
        <td style={{ textAlign: 'center', border: '1px solid var(--border)', padding: '10px 4px' }}>{isHeader ? <strong>{row.LINE_NAME}</strong> : row.LINE_NAME}</td>
        <td className="text-center" style={{ width: '7%', border: '1px solid var(--border)', padding: '10px 4px' }}>{row.TOTAL_MOR > 0 ? row.TOTAL_MOR : ''}</td>
        <td className="text-center" style={{ width: '7%', border: '1px solid var(--border)', padding: '10px 4px' }}>{row.TOTAL_CHIEF > 0 ? row.TOTAL_CHIEF : ''}</td>
        <td className="text-center" style={{ width: '7%', border: '1px solid var(--border)', padding: '10px 4px' }}>{row.TOTAL_SPV > 0 ? row.TOTAL_SPV : ''}</td>
        <td className="text-center" style={{ width: '7%', border: '1px solid var(--border)', padding: '10px 4px' }}>{row.TOTAL_ASST > 0 ? row.TOTAL_ASST : ''}</td>
        <td className="text-center" style={{ width: '7%', border: '1px solid var(--border)', padding: '10px 4px' }}>{row.TOTAL_ADM > 0 ? row.TOTAL_ADM : ''}</td>
        <td className="text-center" style={{ width: '7%', border: '1px solid var(--border)', padding: '10px 4px' }}>{row.TOTAL_SPECIAL > 0 ? row.TOTAL_SPECIAL : ''}</td>
        <td className="text-center" style={{ width: '7%', border: '1px solid var(--border)', padding: '10px 4px' }}>{row.TOTAL_OPR > 0 ? row.TOTAL_OPR : ''}</td>
        <td className="text-center" style={{ width: '7%', border: '1px solid var(--border)', padding: '10px 4px' }}>{row.TOTAL_HLP > 0 ? row.TOTAL_HLP : ''}</td>
        <td className="text-center" style={{ width: '7%', border: '1px solid var(--border)', padding: '10px 4px' }}>{row.TOTAL_PLANTER > 0 ? row.TOTAL_PLANTER : ''}</td>
        <td className="text-center" style={{ fontWeight: 'bold', background: 'var(--bg-subtle)', border: '1px solid var(--border)', padding: '10px 4px' }}>{row.TOTAL_WORKERS > 0 ? row.TOTAL_WORKERS : ''}</td>
      </tr>
    );
  };

  const renderGroupTotal = (label: string, lines: string[], bg: string) => {
    return (
      <tr style={{ fontWeight: 'bold', backgroundColor: bg }}>
        <td style={{ textAlign: 'center', border: '1px solid var(--border)', padding: '10px 4px' }}>{label}</td>
        <td className="text-center" style={{ border: '1px solid var(--border)', padding: '10px 4px' }}>{sumGroup(lines, 'TOTAL_MOR') || ''}</td>
        <td className="text-center" style={{ border: '1px solid var(--border)', padding: '10px 4px' }}>{sumGroup(lines, 'TOTAL_CHIEF') || ''}</td>
        <td className="text-center" style={{ border: '1px solid var(--border)', padding: '10px 4px' }}>{sumGroup(lines, 'TOTAL_SPV') || ''}</td>
        <td className="text-center" style={{ border: '1px solid var(--border)', padding: '10px 4px' }}>{sumGroup(lines, 'TOTAL_ASST') || ''}</td>
        <td className="text-center" style={{ border: '1px solid var(--border)', padding: '10px 4px' }}>{sumGroup(lines, 'TOTAL_ADM') || ''}</td>
        <td className="text-center" style={{ border: '1px solid var(--border)', padding: '10px 4px' }}>{sumGroup(lines, 'TOTAL_SPECIAL') || ''}</td>
        <td className="text-center" style={{ border: '1px solid var(--border)', padding: '10px 4px' }}>{sumGroup(lines, 'TOTAL_OPR') || ''}</td>
        <td className="text-center" style={{ border: '1px solid var(--border)', padding: '10px 4px' }}>{sumGroup(lines, 'TOTAL_HLP') || ''}</td>
        <td className="text-center" style={{ border: '1px solid var(--border)', padding: '10px 4px' }}>{sumGroup(lines, 'TOTAL_PLANTER') || ''}</td>
        <td className="text-center" style={{ border: '1px solid var(--border)', padding: '10px 4px' }}>{sumGroup(lines, 'TOTAL_WORKERS') || ''}</td>
      </tr>
    );
  };

  return (
    <div className="animate-fadeIn">
      <div className="page-header">
        <div>
          <h1 className="page-title">{lang === 'id' ? 'Surat Perintah Lembur (SPL)' : 'Overtime Order (SPL)'}</h1>
          <p className="page-subtitle">{lang === 'id' ? 'Pengelolaan dan perencanaan surat perintah lembur terintegrasi' : 'Integrated overtime order management and planning'}</p>
        </div>
      </div>

      <div className="no-print" style={{ display: 'flex', background: 'var(--bg-subtle)', borderRadius: '12px', padding: '6px', marginBottom: '20px', pointerEvents: 'none', border: '1px solid var(--border)' }}>
        <div style={{ flex: 1, padding: '10px', textAlign: 'center', background: activeTab === 'attendance' ? 'var(--bg-card)' : 'transparent', borderRadius: '8px', boxShadow: activeTab === 'attendance' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none', fontWeight: activeTab === 'attendance' ? 600 : 400, opacity: highestStep >= 1 ? 1 : 0.5, transition: 'all 0.3s' }}>
          1. {lang === 'id' ? 'Kehadiran Harian' : 'Daily Attendance'} {highestStep > 1 && '✓'}
        </div>
        <div style={{ flex: 1, padding: '10px', textAlign: 'center', background: activeTab === 'plan' ? 'var(--bg-card)' : 'transparent', borderRadius: '8px', boxShadow: activeTab === 'plan' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none', fontWeight: activeTab === 'plan' ? 600 : 400, opacity: highestStep >= 2 ? 1 : 0.5, transition: 'all 0.3s' }}>
          2. {lang === 'id' ? 'Perencanaan Lembur' : 'Plan Overtime'} {highestStep > 2 && '✓'}
        </div>
        <div style={{ flex: 1, padding: '10px', textAlign: 'center', background: activeTab === 'finance' ? 'var(--bg-card)' : 'transparent', borderRadius: '8px', boxShadow: activeTab === 'finance' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none', fontWeight: activeTab === 'finance' ? 600 : 400, opacity: highestStep >= 3 ? 1 : 0.5, transition: 'all 0.3s' }}>
          3. {lang === 'id' ? 'Otorisasi & Anggaran' : 'SPL Authorization & Budget'}
        </div>
      </div>

      <div className="glass-card" style={{ padding: '0', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 220px)' }}>
        
        {/* Fixed Header */}
        <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: '15px' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{lang === 'id' ? 'Tanggal Transaksi' : 'Transaction Date'}</label>
              <input 
                type="date" 
                className="form-input" 
                value={dateStr}
                onChange={e => {
                  setDateStr(e.target.value);
                  setIsAttendanceApproved(false);
                }}
                disabled={highestStep > 1}
              />
            </div>
            {highestStep > 1 && (
              <button className="btn btn-secondary" onClick={() => { setActiveTab('attendance'); setHighestStep(1); setIsAttendanceApproved(false); }} style={{ alignSelf: 'flex-end' }}>
                {lang === 'id' ? 'Ubah Tanggal' : 'Change Date'}
              </button>
            )}
          </div>
          {activeTab === 'plan' && (
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', alignSelf: 'flex-end', paddingBottom: '8px' }}>
              *{lang === 'id' ? 'Pastikan alokasi jam lembur sesuai dengan rencana operasional' : 'Ensure overtime allocation matches operational plans'}
            </div>
          )}
        </div>

        {/* Scrollable Content */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {activeTab === 'attendance' && (
            <div className="table-responsive" id="attendance-table-container" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              {data.reduce((sum, r) => sum + r.TOTAL_WORKERS, 0) === 0 && !isLoading ? (
                /* EMPTY STATE UI */
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', color: 'var(--text-secondary)' }}>
                  <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'var(--bg-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
                    <ClipboardList size={40} style={{ opacity: 0.5 }} />
                  </div>
                  <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: '8px' }}>{lang === 'id' ? 'Belum Ada Catatan Kehadiran' : 'No Attendance Records'}</h3>
                  <p style={{ fontSize: '13px', textAlign: 'center', maxWidth: '340px' }}>
                    {lang === 'id' ? `Catatan kehadiran harian untuk tanggal ${dateStr} belum tersedia atau belum diproses.` : `Daily attendance records for ${dateStr} are not available or not yet processed.`}
                  </p>
                </div>
              ) : (
                <>
                    <div style={{ display: 'none' }} className="pdf-header">
                      <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '14px', marginBottom: '15px', textDecoration: 'underline' }}>EMPLOYEE ATTENDANCE</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '5px', fontWeight: 'bold' }}>
                        <div>DATE: {dateStr}</div>
                      </div>
                    </div>
                  <table className="table" style={{ fontSize: '12px', width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ position: 'sticky', top: 0, background: '#c8e6c9', color: '#000', zIndex: 10, boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
                  <tr>
                    <th rowSpan={2} style={{ width: '220px', border: '1px solid var(--border)', textAlign: 'center', padding: '10px' }}>DEPARTMENT</th>
                    <th colSpan={9} className="text-center" style={{ border: '1px solid var(--border)', padding: '10px' }}>PRESENT (ALL SHIFT)</th>
                    <th rowSpan={2} className="text-center" style={{ width: '100px', verticalAlign: 'middle', border: '1px solid var(--border)', padding: '10px' }}>TOTAL ALL GEN</th>
                  </tr>
                  <tr>
                    <th className="text-center" style={{ width: '7%', border: '1px solid var(--border)', padding: '8px' }}>MOR</th>
                    <th className="text-center" style={{ width: '7%', border: '1px solid var(--border)', padding: '8px' }}>Chld</th>
                    <th className="text-center" style={{ width: '7%', border: '1px solid var(--border)', padding: '8px' }}>Syv</th>
                    <th className="text-center" style={{ width: '7%', border: '1px solid var(--border)', padding: '8px' }}>Asst</th>
                    <th className="text-center" style={{ width: '7%', border: '1px solid var(--border)', padding: '8px' }}>Adm</th>
                    <th className="text-center" style={{ width: '7%', border: '1px solid var(--border)', padding: '8px' }}>Special</th>
                    <th className="text-center" style={{ width: '7%', border: '1px solid var(--border)', padding: '8px' }}>Opr</th>
                    <th className="text-center" style={{ width: '7%', border: '1px solid var(--border)', padding: '8px' }}>Helper</th>
                    <th className="text-center" style={{ width: '7%', border: '1px solid var(--border)', padding: '8px' }}>Planter</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr><td colSpan={11} style={{ textAlign: 'center', padding: '40px' }}>{lang === 'id' ? 'Memuat data kehadiran...' : 'Loading attendance data...'}</td></tr>
                  ) : (
                    <>
                      {/* Direct Worker */}
                      {data.filter(r => DIRECT_WORKER_LINES.includes(r.LINE_NAME)).map(r => renderAttendanceRow(r))}
                      {renderGroupTotal('DIRECT WORKER', DIRECT_WORKER_LINES, 'rgba(255, 215, 0, 0.2)')}
                      
                      {/* Technical */}
                      {data.filter(r => TECHNICAL_LINES.includes(r.LINE_NAME)).map(r => renderAttendanceRow(r))}
                      {renderGroupTotal('TECHNICAL', TECHNICAL_LINES, 'rgba(173, 216, 230, 0.3)')}
                      
                      {/* Non-Technical */}
                      {data.filter(r => NON_TECHNICAL_LINES.includes(r.LINE_NAME)).map(r => renderAttendanceRow(r))}
                      {renderGroupTotal('NON-TECHNICAL', NON_TECHNICAL_LINES, 'rgba(255, 182, 193, 0.3)')}
                      
                      {/* Sample & Office */}
                      {data.filter(r => SAMPLE_LINES.includes(r.LINE_NAME) || OFFICE_LINES.includes(r.LINE_NAME)).map(r => renderAttendanceRow(r))}
                      {renderGroupTotal('INDIRECT WORKER', [...TECHNICAL_LINES, ...NON_TECHNICAL_LINES, ...SAMPLE_LINES, ...OFFICE_LINES], 'rgba(255, 215, 0, 0.2)')}
                      
                      {/* Indirect Worker Lines */}
                      {data.filter(r => INDIRECT_WORKER_LINES.includes(r.LINE_NAME)).map(r => renderAttendanceRow(r))}
                      {renderGroupTotal('TOTAL WORKER', data.map(r => r.LINE_NAME), 'rgba(255, 215, 0, 0.3)')}
                    </>
                  )}
                </tbody>
              </table>
            </>
          )}
            </div>
          )}

          {activeTab === 'plan' && (
            <div className="table-responsive" style={{ overflowX: 'auto' }}>
              <table className="table" style={{ minWidth: '1200px' }}>
                <thead style={{ position: 'sticky', top: 0, background: 'var(--glass-bg)', zIndex: 10, boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
                  <tr>
                    <th rowSpan={2} style={{ width: '150px' }}>Line</th>
                    <th rowSpan={2} style={{ width: '60px', textAlign: 'center' }}>Total<br/>Workers</th>
                    <th rowSpan={2} style={{ width: '250px' }}>JOB</th>
                    <th colSpan={2} style={{ textAlign: 'center', borderLeft: '1px solid var(--border)' }}>17:00</th>
                    <th colSpan={2} style={{ textAlign: 'center', borderLeft: '1px solid var(--border)' }}>18:00</th>
                    <th colSpan={2} style={{ textAlign: 'center', borderLeft: '1px solid var(--border)' }}>19:00</th>
                    <th colSpan={2} style={{ textAlign: 'center', borderLeft: '1px solid var(--border)' }}>20:30</th>
                  </tr>
                  <tr>
                    <th style={{ textAlign: 'center', fontSize: '11px', borderLeft: '1px solid var(--border)' }}>OPR</th>
                    <th style={{ textAlign: 'center', fontSize: '11px' }}>HLP</th>
                    <th style={{ textAlign: 'center', fontSize: '11px', borderLeft: '1px solid var(--border)' }}>OPR</th>
                    <th style={{ textAlign: 'center', fontSize: '11px' }}>HLP</th>
                    <th style={{ textAlign: 'center', fontSize: '11px', borderLeft: '1px solid var(--border)' }}>OPR</th>
                    <th style={{ textAlign: 'center', fontSize: '11px' }}>HLP</th>
                    <th style={{ textAlign: 'center', fontSize: '11px', borderLeft: '1px solid var(--border)' }}>OPR</th>
                    <th style={{ textAlign: 'center', fontSize: '11px' }}>HLP</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Plan OT only shows Direct Workers for now, but user can scroll. We'll just show DIRECT WORKER for Plan Overtime */}
                  {data.filter(r => DIRECT_WORKER_LINES.includes(r.LINE_NAME)).map((row, idx) => {
                    // Find actual index in state data array to update correctly
                    const realIdx = data.findIndex(d => d.LINE_NAME === row.LINE_NAME);
                    return (
                      <tr key={idx}>
                        <td style={{ fontWeight: 600, fontSize: '11px' }}>{row.LINE_NAME}</td>
                        <td style={{ textAlign: 'center', background: 'rgba(0,0,0,0.1)' }}>{row.TOTAL_WORKERS}</td>
                        <td style={{ padding: '4px' }}>
                          <input type="text" className="form-input" style={{ padding: '4px 8px', height: '28px', fontSize: '12px' }} value={row.JOB_DESC} onChange={(e) => handleInputChange(realIdx, 'JOB_DESC', e.target.value)} />
                        </td>
                        <td style={{ padding: '4px', borderLeft: '1px solid var(--border)' }}>
                          <input type="number" className="form-input" style={{ width: '40px', padding: '4px', height: '28px', textAlign: 'center' }} value={row.JAM_17_OPR || ''} onChange={(e) => handleInputChange(realIdx, 'JAM_17_OPR', e.target.value)} />
                        </td>
                        <td style={{ padding: '4px' }}>
                          <input type="number" className="form-input" style={{ width: '40px', padding: '4px', height: '28px', textAlign: 'center' }} value={row.JAM_17_HLP || ''} onChange={(e) => handleInputChange(realIdx, 'JAM_17_HLP', e.target.value)} />
                        </td>
                        <td style={{ padding: '4px', borderLeft: '1px solid var(--border)' }}>
                          <input type="number" className="form-input" style={{ width: '40px', padding: '4px', height: '28px', textAlign: 'center' }} value={row.JAM_18_OPR || ''} onChange={(e) => handleInputChange(realIdx, 'JAM_18_OPR', e.target.value)} />
                        </td>
                        <td style={{ padding: '4px' }}>
                          <input type="number" className="form-input" style={{ width: '40px', padding: '4px', height: '28px', textAlign: 'center' }} value={row.JAM_18_HLP || ''} onChange={(e) => handleInputChange(realIdx, 'JAM_18_HLP', e.target.value)} />
                        </td>
                        <td style={{ padding: '4px', borderLeft: '1px solid var(--border)' }}>
                          <input type="number" className="form-input" style={{ width: '40px', padding: '4px', height: '28px', textAlign: 'center' }} value={row.JAM_19_OPR || ''} onChange={(e) => handleInputChange(realIdx, 'JAM_19_OPR', e.target.value)} />
                        </td>
                        <td style={{ padding: '4px' }}>
                          <input type="number" className="form-input" style={{ width: '40px', padding: '4px', height: '28px', textAlign: 'center' }} value={row.JAM_19_HLP || ''} onChange={(e) => handleInputChange(realIdx, 'JAM_19_HLP', e.target.value)} />
                        </td>
                        <td style={{ padding: '4px', borderLeft: '1px solid var(--border)' }}>
                          <input type="number" className="form-input" style={{ width: '40px', padding: '4px', height: '28px', textAlign: 'center' }} value={row.JAM_20_OPR || ''} onChange={(e) => handleInputChange(realIdx, 'JAM_20_OPR', e.target.value)} />
                        </td>
                        <td style={{ padding: '4px' }}>
                          <input type="number" className="form-input" style={{ width: '40px', padding: '4px', height: '28px', textAlign: 'center' }} value={row.JAM_20_HLP || ''} onChange={(e) => handleInputChange(realIdx, 'JAM_20_HLP', e.target.value)} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'finance' && (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              <Clock size={48} style={{ margin: '0 auto 16px', opacity: 0.2 }} />
              <h3>{lang === 'id' ? 'Otorisasi & Rekapitulasi Anggaran SPL' : 'SPL Authorization & Budget Summary'}</h3>
              <p>{lang === 'id' ? 'Sistem sedang memproses rekapitulasi estimasi kompensasi lembur dan operasional...' : 'System is compiling overtime compensation estimates and operations...'}</p>
            </div>
          )}
        </div>

        {/* Fixed Footer Actions */}
        {activeTab === 'attendance' && data.reduce((sum, r) => sum + r.TOTAL_WORKERS, 0) > 0 && (
          <div className="no-print" style={{ padding: '16px 20px', borderTop: '1px solid var(--border)', background: 'var(--glass-bg)', flexShrink: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '13px', userSelect: 'none' }}>
                <input 
                  type="checkbox" 
                  checked={isAttendanceApproved}
                  onChange={(e) => setIsAttendanceApproved(e.target.checked)}
                  style={{ width: '18px', height: '18px', accentColor: 'var(--brand-primary)' }}
                />
                <span>{lang === 'id' ? 'Saya mengonfirmasi bahwa rekapitulasi kehadiran harian ini telah diverifikasi dan valid.' : 'I confirm that this daily attendance summary has been verified and is valid.'}</span>
              </label>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button className="btn btn-secondary" onClick={handleDownloadPdf} disabled={isGeneratingPdf}>
                  <Printer size={15} /> {isGeneratingPdf ? (lang === 'id' ? 'Menyusun Dokumen...' : 'Generating Document...') : (lang === 'id' ? 'Cetak Berkas (PDF)' : 'Print Document (PDF)')}
                </button>
                <button className="btn btn-primary" onClick={handleApproveAttendance} disabled={!isAttendanceApproved}>
                  <CheckSquare size={15} /> {lang === 'id' ? 'Verifikasi Kehadiran & Lanjut ke Perencanaan' : 'Verify Attendance & Proceed to Plan'} <ChevronRight size={15} />
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'plan' && (
          <div className="no-print" style={{ padding: '16px 20px', borderTop: '1px solid var(--border)', background: 'var(--glass-bg)', flexShrink: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button className="btn btn-secondary" onClick={() => window.print()}>
                  <Printer size={15} /> {lang === 'id' ? 'Cetak Berkas (PDF)' : 'Print Document (PDF)'}
                </button>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button className="btn btn-secondary" onClick={() => setActiveTab('attendance')}>
                  {lang === 'id' ? 'Kembali' : 'Back'}
                </button>
                <button className="btn btn-primary" onClick={() => { setActiveTab('finance'); setHighestStep(Math.max(highestStep, 3)); }}>
                  {lang === 'id' ? 'Lanjut ke Otorisasi Anggaran' : 'Proceed to Budget Authorization'} <ChevronRight size={15} />
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'finance' && (
          <div className="no-print" style={{ padding: '16px 20px', borderTop: '1px solid var(--border)', background: 'var(--glass-bg)', flexShrink: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button className="btn btn-secondary" onClick={() => setActiveTab('plan')}>
                {lang === 'id' ? 'Kembali ke Perencanaan' : 'Back to Planning'}
              </button>
              <button className="btn btn-primary">
                <Save size={15} /> {lang === 'id' ? 'Simpan & Terbitkan Dokumen SPL' : 'Save & Finalize SPL Document'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
