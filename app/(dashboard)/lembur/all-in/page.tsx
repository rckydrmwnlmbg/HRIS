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
            <span style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              {lang === 'id' ? 'Lembur ALL IN' : 'ALL IN Overtime'}
            </span>
          </h1>
          <p className="page-subtitle">{lang === 'id' ? 'Rekapitulasi Lembur Karyawan ALL IN' : 'ALL IN Employee Overtime Summary'}</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '360px minmax(0, 1fr)', gap: '22px', alignItems: 'stretch', minHeight: 'calc(100vh - 150px)' }}>

        {/* FORM PANEL */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'visible', height: '100%' }}>
          <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)', position: 'relative', zIndex: 1 }}>
            <h3 style={{ margin: 0, fontWeight: 650, fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
              <Calendar size={17} style={{ color: 'var(--accent)' }} />
              {lang === 'id' ? 'Formulir Lembur' : 'Overtime Form'}
            </h3>
          </div>

          <div style={{ padding: '22px', display: 'flex', flexDirection: 'column', gap: '14px', position: 'relative', zIndex: 1, flex: 1 }}>
            <div className="form-group" style={{ position: 'relative' }}>
              <label className="form-label">{lang === 'id' ? 'Karyawan' : 'Employee'}</label>

              {selectedEmp ? (
                <div style={{ padding: '12px 14px', background: 'rgba(2, 132, 199, 0.06)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '13.5px', color: 'var(--text-primary)' }}>{selectedEmp.EMP_NM || '-'}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>{selectedEmp.EMP_CD} · {selectedEmp.SEC_DESC || '-'}</div>
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
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', boxShadow: '0 10px 25px rgba(0,0,0,0.2)', marginTop: '4px', zIndex: 50, overflow: 'hidden' }}>
                      {filteredKaryawan.map(k => (
                        <div
                          key={k.EMP_CD}
                          onClick={() => selectEmployee(k)}
                          style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12.5px', transition: 'background 0.2s' }}
                          onMouseOver={e => e.currentTarget.style.background = 'var(--bg-subtle)'}
                          onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <span style={{ color: 'var(--accent)', fontWeight: 600, minWidth: '65px' }}>{k.EMP_CD}</span>
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

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
              <input
                type="checkbox"
                id="isHoliday"
                checked={isHoliday}
                onChange={e => setIsHoliday(e.target.checked)}
                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
              />
              <label htmlFor="isHoliday" style={{ fontSize: '12.5px', fontWeight: 500, cursor: 'pointer', color: 'var(--text-primary)' }}>
                {lang === 'id' ? 'Lembur Hari Libur' : 'Holiday Overtime'}
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Clock size={13} /> {lang === 'id' ? 'Mulai' : 'Start'}
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
                  <Clock size={13} /> {lang === 'id' ? 'Selesai' : 'End'}
                </label>
                <input
                  type="time"
                  value={jamSelesai}
                  onChange={e => setJamSelesai(e.target.value)}
                  className="form-input"
                />
              </div>
            </div>

            <div style={{ padding: '10px 12px', background: 'rgba(2, 132, 199, 0.05)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(2, 132, 199, 0.2)', fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
              <strong style={{ color: 'var(--text-primary)' }}>{lang === 'id' ? 'Ketentuan Tarif Lembur:' : 'Overtime Policy:'}</strong><br />
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

            <div style={{ padding: '12px 14px', background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '2px' }}>{lang === 'id' ? 'Estimasi Nominal:' : 'Estimated Amount:'}</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--accent)', lineHeight: 1 }}>
                  Rp {nominal.toLocaleString('id-ID')}
                </div>
              </div>
              <button
                onClick={handleSave}
                disabled={isSaving || !selectedEmp || nominal <= 0}
                className="btn btn-primary"
                style={{ padding: '7px 18px', fontWeight: 600 }}
              >
                {isSaving ? (lang === 'id' ? 'Menyimpan...' : 'Saving...') : (lang === 'id' ? 'Simpan' : 'Save')}
              </button>
            </div>
          </div>
        </div>

        {/* DATA PANEL */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', height: '100%', minWidth: 0, overflow: 'hidden' }}>

          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexShrink: 0 }}>
            <h3 style={{ fontSize: '15px', fontWeight: 650, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)', margin: 0, whiteSpace: 'nowrap' }}>
              <DollarSign size={17} style={{ color: 'var(--accent)' }} />
              {lang === 'id' ? 'Riwayat Lembur Bulan Ini' : 'Overtime History This Month'}
            </h3>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
              <select
                value={bulan}
                onChange={e => setBulan(Number(e.target.value))}
                className="form-select"
                style={{ padding: '6px 12px', width: '130px', fontSize: '12px', cursor: 'pointer', flexShrink: 0 }}
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
                className="form-select"
                style={{ padding: '6px 10px', width: '85px', fontSize: '12px', cursor: 'pointer', flexShrink: 0 }}
              >
                {[tahun - 1, tahun, tahun + 1].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <button
                onClick={handleExport}
                className="btn btn-secondary"
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '6px 12px',
                  fontSize: '12px',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  flexShrink: 0
                }}
              >
                <Download size={14} />
                {lang === 'id' ? 'Ekspor Excel' : 'Export Excel'}
              </button>
            </div>
          </div>

          <div style={{ flex: 1, overflow: 'auto', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            {isLoading ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                <div className="spinner" style={{ margin: '0 auto 16px' }}></div>
                {lang === 'id' ? 'Memuat data...' : 'Loading data...'}
              </div>
            ) : records.length === 0 ? (
              <div className="empty-state" style={{ padding: '60px 20px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                <Calendar size={44} style={{ opacity: 0.2, marginBottom: '14px' }} />
                <div style={{ fontWeight: 500, color: 'var(--text-muted)', fontSize: '13px' }}>
                  {lang === 'id' ? 'Belum ada data lembur di bulan ini.' : 'No overtime records this month.'}
                </div>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: '45px', textAlign: 'center' }}>No</th>
                    <th style={{ width: '100px' }}>{lang === 'id' ? 'Tanggal' : 'Date'}</th>
                    <th style={{ minWidth: '150px' }}>{lang === 'id' ? 'Karyawan' : 'Employee'}</th>
                    <th style={{ width: '120px' }}>{lang === 'id' ? 'Jam Lembur' : 'Hours'}</th>
                    <th style={{ width: '110px', textAlign: 'right' }}>Nominal</th>
                    <th style={{ width: '50px', textAlign: 'center' }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r, i) => (
                    <tr key={r.ID}>
                      <td style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '11.5px' }}>{i + 1}</td>
                      <td style={{ fontWeight: 500, fontSize: '12px', whiteSpace: 'nowrap' }}>{r.DATE_TRANS}</td>
                      <td>
                        <div style={{ fontWeight: 500, color: 'var(--text-primary)', fontSize: '12.5px' }}>{r.EMP_NM}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px' }}>{r.EMP_CD} · {r.SEC_DESC || '-'}</div>
                      </td>
                      <td style={{ fontFamily: 'monospace', fontSize: '11.5px', whiteSpace: 'nowrap' }}>
                        {r.JAM_MULAI} - {r.JAM_SELESAI}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--accent)', fontSize: '12px' }}>
                        Rp {r.NOMINAL?.toLocaleString('id-ID')}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          onClick={() => handleDelete(r.ID)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: '5px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}
                          title={lang === 'id' ? 'Hapus' : 'Delete'}
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
