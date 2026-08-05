'use client';
import { useState, useEffect } from 'react';
import { Search, Save, Download, Clock, DollarSign, Calendar, Trash2 } from 'lucide-react';
import { useApp } from '@/lib/context';
import { t } from '@/lib/i18n';
import { ConfirmModal } from '@/components/ui/ConfirmModal';

export default function LemburAllInPage() {
  const { user, settings } = useApp();
  const lang = settings.language;

  const [dateStr, setDateStr] = useState(new Date().toISOString().split('T')[0]);
  const [bulan, setBulan] = useState(new Date().getMonth() + 1);
  const [tahun, setTahun] = useState(new Date().getFullYear());
  const [isHoliday, setIsHoliday] = useState(false);

  const [searchEmp, setSearchEmp] = useState('');
  const [selectedEmp, setSelectedEmp] = useState<any>(null);

  const [jamMulai, setJamMulai] = useState('21:00');
  const [jamSelesai, setJamSelesai] = useState('00:00');
  const [nominal, setNominal] = useState(100000);

  const [records, setRecords] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<string | null>(null);

  // Fetch ALL IN employees
  useEffect(() => {
    fetch('/api/karyawan?allIn=1&limit=1000')
      .then(res => res.json())
      .then(res => {
        if (res.data) setEmployees(res.data);
      })
      .catch(err => console.error('Error fetching ALL IN employees:', err));
  }, []);

  const filteredKaryawan = employees.filter(k =>
    searchEmp && (
      String(k.EMP_CD || '').toLowerCase().includes(searchEmp.toLowerCase()) ||
      String(k.EMP_NM || '').toLowerCase().includes(searchEmp.toLowerCase())
    )
  ).slice(0, 5);

  const selectEmployee = (k: any) => {
    setSelectedEmp(k);
    setSearchEmp('');
  };

  // Fetch records
  const fetchRecords = () => {
    setIsLoading(true);
    fetch(`/api/lembur/all-in?bulan=${bulan}&tahun=${tahun}`)
      .then(res => res.json())
      .then(data => setRecords(Array.isArray(data) ? data : []))
      .catch(err => console.error(err))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    fetchRecords();
  }, [bulan, tahun]);

  // Auto calculate nominal
  useEffect(() => {
    if (isHoliday) {
      setNominal(100000);
      return;
    }

    if (!jamSelesai) {
      setNominal(0);
      return;
    }

    const [hStr, mStr] = jamSelesai.split(':');
    const h = parseInt(hStr, 10);
    const m = parseInt(mStr, 10);

    if (h >= 21 && h <= 23) {
      setNominal(100000);
    } else if (h === 0 && m === 0) {
      setNominal(100000);
    } else if ((h === 0 && m > 0) || h === 1 || h === 2 || (h === 3 && m === 0)) {
      setNominal(125000);
    } else if ((h === 3 && m > 0) || (h > 3 && h < 12)) {
      setNominal(150000);
    } else {
      setNominal(0); // Jam nanggung/tidak valid
    }
  }, [jamSelesai, isHoliday]);

  const handleSave = async () => {
    if (!selectedEmp) {
      alert(lang === 'id' ? 'Pilih karyawan terlebih dahulu!' : 'Please select an employee first!');
      return;
    }
    if (nominal <= 0) {
      alert(lang === 'id' ? 'Nominal tidak boleh 0. Periksa kembali jam selesai Anda.' : 'Amount cannot be 0. Check end time.');
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch('/api/lembur/all-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          empCd: selectedEmp.EMP_CD,
          dateTrans: dateStr,
          jamMulai,
          jamSelesai,
          nominal,
          createdBy: user?.nama || 'Admin'
        })
      });

      if (!res.ok) throw new Error(await res.text());

      alert(lang === 'id' ? 'Data lembur berhasil disimpan!' : 'Overtime data saved successfully!');

      // Check if saved date belongs to currently viewed month/year, if so refresh
      const d = new Date(dateStr);
      if (d.getMonth() + 1 === bulan && d.getFullYear() === tahun) {
        fetchRecords();
      }

      // Reset form briefly
      setSelectedEmp(null);
      setSearchEmp('');
      setJamMulai('21:00');
      setJamSelesai('00:00');
    } catch (err: any) {
      alert((lang === 'id' ? 'Gagal menyimpan: ' : 'Failed to save: ') + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (id: string) => {
    setConfirmTarget(id);
  };

  const confirmDelete = async () => {
    if (!confirmTarget) return;
    try {
      const res = await fetch(`/api/lembur/all-in?id=${confirmTarget}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(await res.text());
      fetchRecords();
    } catch (err: any) {
      alert((lang === 'id' ? 'Gagal menghapus: ' : 'Failed to delete: ') + err.message);
    }
    setConfirmTarget(null);
  };

  const handleExport = () => {
    window.open(`/api/lembur/all-in/export?bulan=${bulan}&tahun=${tahun}`, '_blank');
  };

  return (
    <div style={{ animation: 'fadeIn 0.3s ease', paddingBottom: '40px' }}>
      <div className="page-header" style={{ position: 'relative', zIndex: 1 }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-cyan))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              {lang === 'id' ? 'Lembur ALL IN' : 'ALL IN Overtime'}
            </span>
          </h1>
          <p className="page-subtitle">{lang === 'id' ? 'Rekapitulasi Lembur Karyawan ALL IN' : 'ALL IN Employee Overtime Summary'}</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: '24px', alignItems: 'stretch' }}>

        {/* FORM PANEL */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'visible', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', height: '100%' }}>
          {/* Decorative Glow */}
          <div style={{ position: 'absolute', top: '-20%', right: '-10%', width: '150px', height: '150px', background: 'var(--accent-glow)', borderRadius: '50%', filter: 'blur(40px)', pointerEvents: 'none', zIndex: 0 }}></div>

          <div style={{ padding: '24px', borderBottom: '1px solid var(--border)', position: 'relative', zIndex: 1 }}>
            <h3 style={{ margin: 0, fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
              <Calendar size={18} style={{ color: 'var(--accent)' }} />
              {lang === 'id' ? 'Formulir Lembur' : 'Overtime Form'}
            </h3>
          </div>

          <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', position: 'relative', zIndex: 1, flex: 1 }}>
            <div className="form-group" style={{ position: 'relative' }}>
              <label className="form-label">{lang === 'id' ? 'Karyawan' : 'Employee'}</label>

              {selectedEmp ? (
                <div style={{ padding: '12px 16px', background: 'rgba(79,158,248,0.1)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>{selectedEmp.EMP_NM || '-'}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>{selectedEmp.EMP_CD}</div>
                  </div>
                  <button type="button" className="btn btn-sm btn-secondary" onClick={() => { setSelectedEmp(null); setSearchEmp(''); }}>{lang === 'id' ? 'Ganti' : 'Change'}</button>
                </div>
              ) : (
                <div style={{ position: 'relative' }}>
                  <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    className="form-input"
                    style={{ paddingLeft: '36px' }}
                    placeholder={lang === 'id' ? 'Ketik NIK atau Nama...' : 'Type ID or Name...'}
                    value={searchEmp}
                    onChange={e => setSearchEmp(e.target.value)}
                  />
                  {searchEmp && filteredKaryawan.length > 0 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', boxShadow: '0 10px 30px rgba(0,0,0,0.2)', marginTop: '4px', zIndex: 50, overflow: 'hidden' }}>
                      {filteredKaryawan.map(k => (
                        <div
                          key={k.EMP_CD}
                          onClick={() => selectEmployee(k)}
                          style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', transition: 'background 0.2s' }}
                          onMouseOver={e => e.currentTarget.style.background = 'var(--bg-subtle)'}
                          onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <span style={{ color: 'var(--accent)', fontWeight: 500, minWidth: '70px' }}>{k.EMP_CD}</span>
                          <span style={{ color: 'var(--text-primary)' }}>{k.EMP_NM}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">{lang === 'id' ? 'Tanggal Lembur' : 'Overtime Date'}</label>
              <input
                type="date"
                value={dateStr}
                onChange={e => setDateStr(e.target.value)}
                className="form-input"
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
              <input
                type="checkbox"
                id="isHoliday"
                checked={isHoliday}
                onChange={e => setIsHoliday(e.target.checked)}
                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
              />
              <label htmlFor="isHoliday" style={{ fontSize: '13px', fontWeight: 500, cursor: 'pointer', color: 'var(--text-primary)' }}>
                {lang === 'id' ? 'Lembur Hari Libur' : 'Holiday Overtime'}
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Clock size={14} /> {lang === 'id' ? 'Mulai' : 'Start'}
                </label>
                <input
                  type="time"
                  value={jamMulai}
                  onChange={e => setJamMulai(e.target.value)}
                  className="form-input"
                />
              </div>
              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Clock size={14} /> {lang === 'id' ? 'Selesai' : 'End'}
                </label>
                <input
                  type="time"
                  value={jamSelesai}
                  onChange={e => setJamSelesai(e.target.value)}
                  className="form-input"
                />
              </div>
            </div>

            <div style={{ marginTop: '12px', padding: '12px', background: 'var(--info-bg)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(59, 130, 246, 0.2)', fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              <strong style={{ color: 'var(--text-primary)' }}>{lang === 'id' ? 'Ketentuan Tarif Lembur:' : 'Overtime Rate Policy:'}</strong><br />
              {lang === 'id' ? (
                <>
                  s/d 24:00 = Rp 100.000 | 00:01 - 03:00 = Rp 125.000 | &gt; 03:01 = Rp 150.000<br />
                  Hari Libur (07:00 - 16:00) = Rp 100.000
                </>
              ) : (
                <>
                  Up to 24:00 = Rp 100,000 | 00:01 - 03:00 = Rp 125,000 | &gt; 03:01 = Rp 150,000<br />
                  Holiday (07:00 - 16:00) = Rp 100,000
                </>
              )}
            </div>

            <div style={{ padding: '16px 20px', background: 'rgba(178, 178, 178, 0.05)', border: '1px solid rgba(79,158,248,0.2)', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>{lang === 'id' ? 'Estimasi Nominal:' : 'Estimated Compensation:'}</div>
                <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--accent-blue)', lineHeight: 1 }}>
                  Rp {nominal.toLocaleString('id-ID')}
                </div>
              </div>
              <button
                onClick={handleSave}
                disabled={isSaving || !selectedEmp || nominal <= 0}
                className="btn btn-primary"
                style={{ padding: '10px 24px', fontWeight: 600 }}
              >
                {isSaving ? (lang === 'id' ? 'Menyimpan...' : 'Saving...') : (lang === 'id' ? 'Simpan' : 'Save')}
              </button>
            </div>
          </div>
        </div>

        {/* DATA PANEL */}
        <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', position: 'relative', overflow: 'visible', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', height: '100%' }}>
          {/* Decorative Glow */}
          <div style={{ position: 'absolute', bottom: '-10%', left: '-5%', width: '200px', height: '200px', background: 'var(--accent-cyan)', opacity: 0.1, borderRadius: '50%', filter: 'blur(50px)', pointerEvents: 'none', zIndex: 0 }}></div>

          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '16px', position: 'relative', zIndex: 1 }}>
            <h3 style={{ fontSize: '15px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)', margin: 0 }}>
              <DollarSign size={18} style={{ color: 'var(--accent)' }} />
              {lang === 'id' ? 'Riwayat Lembur Bulan Ini' : 'Overtime History This Month'}
            </h3>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <select
                value={bulan}
                onChange={e => setBulan(Number(e.target.value))}
                className="form-input"
                style={{ padding: '6px 12px', minWidth: '130px' }}
              >
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {new Date(2024, i).toLocaleString(lang === 'id' ? 'id-ID' : 'en-US', { month: 'long' })}
                  </option>
                ))}
              </select>
              <select
                value={tahun}
                onChange={e => setTahun(Number(e.target.value))}
                className="form-input"
                style={{ padding: '6px 12px', minWidth: '80px' }}
              >
                {[tahun - 1, tahun, tahun + 1].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <button
                onClick={handleExport}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '8px 16px',
                  background: 'rgba(16, 185, 129, 0.15)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  borderRadius: '100px',
                  color: 'var(--success)',
                  fontWeight: 600,
                  fontSize: '13px',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  boxShadow: '0 4px 15px rgba(16, 185, 129, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
                  cursor: 'pointer',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                }}
                onMouseOver={e => {
                  e.currentTarget.style.background = 'rgba(16, 185, 129, 0.25)';
                  e.currentTarget.style.boxShadow = '0 8px 25px rgba(16, 185, 129, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.2)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseOut={e => {
                  e.currentTarget.style.background = 'rgba(16, 185, 129, 0.15)';
                  e.currentTarget.style.boxShadow = '0 4px 15px rgba(16, 185, 129, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.1)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <Download size={15} />
                {lang === 'id' ? 'Ekspor Excel' : 'Export Excel'}
              </button>
            </div>
          </div>

          <div className="table-wrapper" style={{ position: 'relative', zIndex: 1 }}>
            {isLoading ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                <div className="spinner" style={{ margin: '0 auto 16px' }}></div>
                Memuat data...
              </div>
            ) : records.length === 0 ? (
              <div className="empty-state" style={{ padding: '60px 20px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                <Calendar size={48} style={{ opacity: 0.2, marginBottom: '16px' }} />
                <div style={{ fontWeight: 500, color: 'var(--text-muted)' }}>
                  {lang === 'id' ? 'Belum ada data lembur di bulan ini.' : 'No overtime records this month.'}
                </div>
              </div>
            ) : (
              <div className="table-responsive" style={{ flex: 1, overflow: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ width: '50px', textAlign: 'center' }}>No</th>
                      <th>{lang === 'id' ? 'Tanggal' : 'Date'}</th>
                      <th>{lang === 'id' ? 'Karyawan' : 'Employee'}</th>
                      <th>{lang === 'id' ? 'Jam Lembur' : 'Hours'}</th>
                      <th style={{ textAlign: 'right' }}>Nominal</th>
                      <th style={{ width: '80px', textAlign: 'center' }}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((r, i) => (
                      <tr key={r.ID}>
                        <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>{i + 1}</td>
                        <td style={{ fontWeight: 500 }}>{r.DATE_TRANS}</td>
                        <td>
                          <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{r.EMP_NM}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{r.SEC_DESC || '-'}</div>
                        </td>
                        <td style={{ fontFamily: 'monospace', fontSize: '12px' }}>
                          {r.JAM_MULAI} - {r.JAM_SELESAI}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--accent)' }}>
                          Rp {r.NOMINAL?.toLocaleString('id-ID')}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            onClick={() => handleDelete(r.ID)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: '6px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}
                            title={lang === 'id' ? 'Hapus' : 'Delete'}
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      </div>
      
      <ConfirmModal
        isOpen={!!confirmTarget}
        title={lang === 'id' ? 'Hapus Data Lembur' : 'Delete Overtime Record'}
        description={lang === 'id' ? 'Apakah Anda yakin ingin menghapus data lembur All-In ini?' : 'Are you sure you want to delete this All-In overtime record?'}
        confirmText={lang === 'id' ? 'Hapus' : 'Delete'}
        cancelText={lang === 'id' ? 'Batal' : 'Cancel'}
        onConfirm={confirmDelete}
        onCancel={() => setConfirmTarget(null)}
        variant="danger"
      />
    </div>
  );
}
