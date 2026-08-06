'use client';
import { useState, useEffect } from 'react';
import { useApp } from '@/lib/context';
import { t } from '@/lib/i18n';
import type { Karyawan } from '@/types';
import { Search, Calendar as CalendarIcon, CheckCircle, Plus, Trash2 } from 'lucide-react';
import { ConfirmModal } from '@/components/ui/ConfirmModal';

interface LeaveRequest {
  id: number;
  EMP_CD: string;
  EMP_NM: string;
  startDate: string;
  endDate: string;
  days: number;
  type: string;
  reason: string;
  reasonGroup?: string;
  status: 'approved' | 'pending';
  TEAM?: string;
  JOB_DESC?: string;
  JOB_CD?: string;
  SEC_DESC?: string;
  SEC_CD?: string;
}

export default function CutiPage() {
  const { settings } = useApp();
  const lang = settings.language;
  const today = new Date().toISOString().split('T')[0];

  const [searchEmp, setSearchEmp] = useState('');
  const [selectedEmp, setSelectedEmp] = useState<Karyawan | null>(null);
  const [form, setForm] = useState({
    startDate: today,
    endDate: today,
    type: '' // Will be set after masterReasons is loaded
  });
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [karyawanList, setKaryawanList] = useState<Karyawan[]>([]);
  const [masterReasons, setMasterReasons] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<LeaveRequest | null>(null);

  // Batas maksimal hak cuti tahunan per karyawan
  const BATAS_CUTI = 12;

  useEffect(() => {
    fetch('/api/karyawan?status=aktif&limit=10000')
      .then(res => res.json())
      .then(json => {
        const data = Array.isArray(json) ? json : (json.data || []);
        setKaryawanList(data);
      })
      .catch(err => console.error(err));

    fetch('/api/master')
      .then(res => res.json())
      .then(data => {
        const reasons = data.reasons || [];
        setMasterReasons(reasons);
        if (reasons.length > 0) {
          setForm(f => ({ ...f, type: reasons.find((r: any) => r.REASON_DESC === 'Cuti')?.REASON_CODE || reasons[0].REASON_CODE }));
        }
      })
      .catch(err => console.error(err));
  }, []);

  const loadRequests = async (empCd?: string) => {
    setIsLoading(true);
    try {
      const url = `/api/cuti${empCd ? `?emp=${encodeURIComponent(empCd.trim())}&` : '?'}t=${Date.now()}`;
      const res = await fetch(url, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setRequests(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error(err);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    if (selectedEmp) {
      loadRequests(selectedEmp.EMP_CD);
    } else {
      setRequests([]);
    }
  }, [selectedEmp]);

  const filteredEmp = karyawanList
    .filter(k =>
      searchEmp && (
        String(k.EMP_CD || '').toLowerCase().includes(searchEmp.toLowerCase()) ||
        String(k.EMP_NM || '').toLowerCase().includes(searchEmp.toLowerCase())
      )
    )
    .slice(0, 6);

  const calculateDays = (start: string, end: string) => {
    if (!start || !end) return 0;
    const s = new Date(start);
    const e = new Date(end);
    if (e < s) return 0;

    let daysCount = 0;
    let curr = new Date(s);
    while (curr <= e) {
      const day = curr.getDay();
      if (day !== 0 && day !== 6) { // Skip weekends
        daysCount++;
      }
      curr.setDate(curr.getDate() + 1);
    }
    return daysCount;
  };

  const days = calculateDays(form.startDate, form.endDate);

  const totalCutiTerpakai = requests.reduce((sum, r) => sum + ((r.reasonGroup?.trim() === 'C' || r.reasonGroup?.trim() === 'H') ? r.days : 0), 0);
  
  const selectedReasonObj = masterReasons.find(r => r.REASON_CODE === form.type);
  const isCutiType = selectedReasonObj && (selectedReasonObj.REASON_GROUP?.trim() === 'C' || selectedReasonObj.REASON_GROUP?.trim() === 'H');
  
  const isExceedingQuota = isCutiType && (totalCutiTerpakai + days > BATAS_CUTI);

  const handleDelete = (r: LeaveRequest) => {
    setConfirmTarget(r);
  };

  const confirmDelete = async () => {
    if (!confirmTarget) return;
    const r = confirmTarget;
    try {
      const params = new URLSearchParams({
        emp: r.EMP_CD,
        start: r.startDate,
        end: r.endDate
      });
      const res = await fetch(`/api/cuti?${params.toString()}`, { method: 'DELETE' });
      if (res.ok) {
        setToast(lang === 'id' ? 'Data cuti berhasil dihapus' : 'Leave record deleted');
        setTimeout(() => setToast(null), 3000);
        loadRequests(selectedEmp?.EMP_CD);
      } else {
        const err = await res.json();
        alert(lang === 'id' ? 'Gagal menghapus data' : 'Failed to delete record');
      }
    } catch (err) {
      console.error(err);
      alert(lang === 'id' ? 'Terjadi kendala saat menghapus data cuti' : 'Failed to delete leave record');
    }
    setConfirmTarget(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmp || days <= 0 || isExceedingQuota) return;
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/cuti', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          EMP_CD: selectedEmp.EMP_CD,
          EMP_NM: selectedEmp.EMP_NM,
          startDate: form.startDate,
          endDate: form.endDate,
          days,
          type: form.type,
          reason: '',
        })
      });

      if (res.ok) {
        setToast(lang === 'id' ? 'Pengajuan cuti berhasil disimpan' : 'Leave request saved');
        setTimeout(() => setToast(null), 3000);

        // Reset form
        setForm(f => ({
          ...f,
          startDate: today,
          endDate: today
        }));

        loadRequests(selectedEmp.EMP_CD);
      }
    } catch (err) {
      console.error(err);
    }
    setIsSubmitting(false);
  };

  return (
    <div className="animate-fadeIn">
      <div className="page-header">
        <div>
          <h1 className="page-title">{lang === 'id' ? 'Manajemen Cuti & Perizinan' : 'Leave & Permission Management'}</h1>
          <p className="page-subtitle">{lang === 'id' ? 'Pengajuan, pengelolaan, dan riwayat hak cuti karyawan' : 'Leave request, management, and employee leave history'}</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: '22px', alignItems: 'stretch', minHeight: 'calc(100vh - 150px)' }}>
        {/* FORM PANEL */}
        <div className="glass-card" style={{ overflow: 'visible', zIndex: 10, display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)' }}>
            <h3 style={{ margin: 0, fontWeight: 650, fontSize: '15px' }}>{lang === 'id' ? 'Formulir Pengajuan' : 'Request Form'}</h3>
          </div>
          <form onSubmit={handleSubmit} style={{ padding: '22px', display: 'flex', flexDirection: 'column', flex: 1, gap: '14px' }}>
            <div className="form-group" style={{ position: 'relative' }}>
              <label className="form-label">{lang === 'id' ? 'Karyawan' : 'Employee'}</label>
              {selectedEmp ? (
                <div style={{ padding: '12px 14px', background: 'rgba(2, 132, 199, 0.06)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '13.5px', color: 'var(--text-primary)' }}>{selectedEmp.EMP_NM}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>{selectedEmp.EMP_CD} · {selectedEmp.SEC_DESC || selectedEmp.SEC_CD || '-'}</div>
                  </div>
                  <button type="button" className="btn btn-sm btn-secondary" onClick={() => { setSelectedEmp(null); setSearchEmp(''); }}>{lang === 'id' ? 'Ganti' : 'Change'}</button>
                </div>
              ) : (
                <div className="search-wrapper">
                  <Search size={15} className="search-icon" />
                  <input className="form-input" placeholder={lang === 'id' ? 'Ketik NIK atau Nama...' : 'Type ID or Name...'} value={searchEmp} onChange={e => setSearchEmp(e.target.value)} required />
                </div>
              )}
              {searchEmp && !selectedEmp && filteredEmp.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', zIndex: 50, marginTop: '4px', overflow: 'hidden', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
                  {filteredEmp.map(k => (
                    <div key={k.EMP_CD} onClick={() => { setSelectedEmp(k); setSearchEmp(''); }} style={{ padding: '10px 12px', cursor: 'pointer', display: 'flex', gap: '10px', alignItems: 'center', borderBottom: '1px solid var(--border)', fontSize: '12.5px' }}>
                      <span style={{ color: 'var(--accent)', fontWeight: 600, minWidth: 65 }}>{k.EMP_CD}</span>
                      <span>{k.EMP_NM}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {selectedEmp && (
              <div style={{ padding: '12px 14px', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  {lang === 'id' ? 'Status Kuota Cuti Tahunan' : 'Annual Leave Quota Status'}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', textAlign: 'center' }}>
                  <div style={{ padding: '6px 4px', background: 'var(--bg-card)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Hak Cuti</div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>{BATAS_CUTI}</div>
                  </div>
                  <div style={{ padding: '6px 4px', background: 'var(--bg-card)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Terpakai</div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--warning)' }}>{totalCutiTerpakai}</div>
                  </div>
                  <div style={{ padding: '6px 4px', background: 'var(--bg-card)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Sisa</div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: Math.max(0, BATAS_CUTI - totalCutiTerpakai) > 0 ? 'var(--success)' : 'var(--danger)' }}>
                      {Math.max(0, BATAS_CUTI - totalCutiTerpakai)}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">{lang === 'id' ? 'Jenis Cuti' : 'Leave Type'}</label>
              <select className="form-select" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                {masterReasons.map(r => (
                  <option key={r.REASON_CODE} value={r.REASON_CODE}>
                    {r.REASON_DESC}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label">{lang === 'id' ? 'Mulai' : 'Start Date'}</label>
                <input type="date" className="form-input" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label className="form-label">{lang === 'id' ? 'Selesai' : 'End Date'}</label>
                <input type="date" className="form-input" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} required />
              </div>
            </div>

            <div style={{ padding: '12px 14px', background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '2px' }}>{lang === 'id' ? 'Total Hari Kerja :' : 'Total Working Days :'}</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: isExceedingQuota ? 'var(--danger)' : 'var(--accent)', lineHeight: 1 }}>{days} <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-secondary)' }}>{lang === 'id' ? 'hari' : 'days'}</span></div>
                {isExceedingQuota && (
                  <div style={{ fontSize: '10.5px', color: 'var(--danger)', marginTop: '3px', fontWeight: 500 }}>
                    ⚠ {lang === 'id' ? `Sisa jatah cuti tidak mencukupi (Maks: ${BATAS_CUTI} hari/tahun)` : `Leave quota exceeded (Max: ${BATAS_CUTI} days/year)`}
                  </div>
                )}
              </div>
              <button type="submit" className="btn btn-primary" style={{ padding: '7px 18px', fontWeight: 600 }} disabled={!selectedEmp || days <= 0 || isSubmitting || (isExceedingQuota as boolean)}>
                {isSubmitting ? (lang === 'id' ? 'Menyimpan...' : 'Saving...') : (lang === 'id' ? 'Ajukan Pengajuan' : 'Submit Request')}
              </button>
            </div>
          </form>
        </div>

        {/* List Riwayat */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: '400px' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontWeight: 650, fontSize: '15px' }}>{lang === 'id' ? 'Riwayat Cuti' : 'Leave History'}</h3>
            {!isLoading && requests.length > 0 && selectedEmp && (
              <div style={{ 
                fontSize: '12px', 
                fontWeight: 600, 
                padding: '6px 14px', 
                background: 'rgba(2, 132, 199, 0.08)', 
                border: '1px solid rgba(2, 132, 199, 0.25)', 
                color: 'var(--accent)', 
                borderRadius: '9999px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <span>{lang === 'id' ? 'Total Cuti Terpakai:' : 'Total Leave Used:'}</span>
                <span style={{ fontSize: '14px', fontWeight: 800 }}>
                  {totalCutiTerpakai} <span style={{fontSize: '11px', fontWeight: 500}}>{lang === 'id' ? 'hari' : 'days'}</span>
                </span>
              </div>
            )}
          </div>
          {isLoading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
              <div className="spinner" style={{ margin: '0 auto 16px' }}></div>
              {lang === 'id' ? 'Memuat riwayat cuti...' : 'Loading history...'}
            </div>
          ) : requests.length === 0 ? (
            <div className="empty-state" style={{ padding: '60px 20px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
              <CalendarIcon size={48} style={{ opacity: 0.2, marginBottom: '16px' }} />
              <div style={{ fontWeight: 500 }}>{lang === 'id' ? 'Belum ada data cuti' : 'No leave records yet'}</div>
            </div>
          ) : (
            <div className="table-wrapper" style={{ flex: 1, overflow: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{lang === 'id' ? 'Informasi Karyawan' : 'Employee'}</th>
                    <th>{lang === 'id' ? 'Unit Kerja & Tim' : 'Section & Team'}</th>
                    <th>{lang === 'id' ? 'Jenis' : 'Type'}</th>
                    <th>{lang === 'id' ? 'Periode' : 'Period'}</th>

                    <th style={{ textAlign: 'center' }}>{lang === 'id' ? 'Status' : 'Status'}</th>
                    <th style={{ textAlign: 'center', width: '60px' }}>{lang === 'id' ? 'Tindakan' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map(r => (
                    <tr key={r.id}>
                      <td>
                        <div style={{ fontWeight: 500 }}>{r.EMP_NM}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{r.EMP_CD}</div>
                      </td>
                      <td>
                        <div style={{ fontSize: '12px', fontWeight: 500 }}>{r.TEAM || r.JOB_DESC || r.JOB_CD || '-'}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{r.SEC_DESC || r.SEC_CD || '-'}</div>
                      </td>
                      <td>
                        <span className={`badge ${r.type?.toLowerCase().includes('sakit') ? 'badge-sakit' :
                          r.type?.toLowerCase().includes('cuti') ? 'badge-cuti' : 'badge-gray'
                          }`}>{r.type}</span>
                      </td>
                      <td>
                        <div style={{ fontSize: '12px' }}>
                          {new Date(r.startDate).toLocaleDateString('id-ID')} - {new Date(r.endDate).toLocaleDateString('id-ID')}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>{r.days} {lang === 'id' ? 'hari' : 'days'}</div>
                      </td>

                      <td style={{ textAlign: 'center' }}>
                        <span className={`badge badge-success`}>
                          {lang === 'id' ? 'Disetujui' : 'Approved'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          onClick={() => handleDelete(r)}
                          title={lang === 'id' ? 'Hapus' : 'Delete'}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: '4px', borderRadius: '4px', opacity: 0.7, transition: 'opacity 0.2s' }}
                          onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                          onMouseLeave={e => (e.currentTarget.style.opacity = '0.7')}
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

      {toast && (
        <div className="toast-container">
          <div className="toast toast-success">
            <CheckCircle size={16} /> {toast}
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={!!confirmTarget}
        title={lang === 'id' ? 'Hapus Data Cuti' : 'Delete Leave Record'}
        description={confirmTarget ? (lang === 'id' ? `Apakah Anda yakin ingin menghapus data ${confirmTarget.type} untuk ${confirmTarget.EMP_NM}? (${confirmTarget.startDate} s.d. ${confirmTarget.endDate}, ${confirmTarget.days} hari)` : `Are you sure you want to delete ${confirmTarget.type} for ${confirmTarget.EMP_NM}? (${confirmTarget.startDate} to ${confirmTarget.endDate}, ${confirmTarget.days} days)`) : ''}
        confirmText={lang === 'id' ? 'Hapus' : 'Delete'}
        cancelText={lang === 'id' ? 'Batal' : 'Cancel'}
        onConfirm={confirmDelete}
        onCancel={() => setConfirmTarget(null)}
        variant="danger"
      />
    </div>
  );
}
