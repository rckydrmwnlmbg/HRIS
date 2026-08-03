'use client';
import { useState, useEffect } from 'react';
import { Clock, Search, FileText, Download } from 'lucide-react';
import { useApp } from '@/lib/context';
import { t } from '@/lib/i18n';

export default function LemburCateringPage() {
  const { settings } = useApp();
  const lang = settings.language;
  const [bulan, setBulan] = useState(new Date().getMonth() + 1);
  const [tahun, setTahun] = useState(new Date().getFullYear());
  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch only ALL IN employees
  useEffect(() => {
    // API logic will go here
  }, [bulan, tahun]);

  return (
    <div className="animate-fadeIn">
      <div className="page-header">
        <div>
          <h1 className="page-title">{lang === 'id' ? 'Lembur & Catering (ALL IN)' : 'Overtime & Catering (ALL IN)'}</h1>
          <p className="page-subtitle">Kelola jam lembur dan jatah catering karyawan berstatus ALL IN</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-secondary">
            <Download size={15} /> Export Laporan (Excel)
          </button>
        </div>
      </div>

      <div className="glass-card">
        <div style={{ display: 'flex', gap: '15px', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <select className="form-input" value={bulan} onChange={e => setBulan(Number(e.target.value))} style={{ width: '150px' }}>
            {Array.from({length: 12}, (_, i) => (
              <option key={i+1} value={i+1}>{new Date(0, i).toLocaleString('id-ID', { month: 'long' })}</option>
            ))}
          </select>
          <select className="form-input" value={tahun} onChange={e => setTahun(Number(e.target.value))} style={{ width: '100px' }}>
            {[2023, 2024, 2025, 2026].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Tanggal</th>
                <th>Karyawan (ALL IN)</th>
                <th>Jam Masuk - Keluar</th>
                <th>Leaving / Early</th>
                <th>Total Jam OT</th>
                <th>Catering</th>
              </tr>
            </thead>
            <tbody>
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: '30px' }}><Clock size={32} style={{ margin: '0 auto 10px', opacity: 0.2 }} />Segera Hadir: Sinkronisasi Data ALL IN</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
