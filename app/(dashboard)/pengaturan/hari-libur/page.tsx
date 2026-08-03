'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';

import { Trash2 } from 'lucide-react';
import { ConfirmModal } from '@/components/ui/ConfirmModal';

interface Holiday {
  tanggal: string;
  keterangan: string;
  status_libur: string;
}

export default function HariLiburPage() {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [confirmTarget, setConfirmTarget] = useState<string | null>(null);
  const [year, setYear] = useState(new Date().getFullYear().toString());

  // Form states
  const [formTanggal, setFormTanggal] = useState('');
  const [formKeterangan, setFormKeterangan] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchHolidays();
  }, [year]);

  const fetchHolidays = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/pengaturan/hari-libur?year=${year}`);
      const data = await res.json();
      setHolidays(data);
    } catch (error) {
      console.error('Error fetching holidays', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/pengaturan/hari-libur', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tanggal: formTanggal, keterangan: formKeterangan })
      });
      const data = await res.json();
      if (data.success) {
        alert('Berhasil menyimpan hari libur');
        setFormTanggal('');
        setFormKeterangan('');
        fetchHolidays();
      } else {
        alert('Gagal: ' + data.error);
      }
    } catch (error) {
      alert('Terjadi kesalahan sistem.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = (tanggal: string) => {
    setConfirmTarget(tanggal);
  };

  const confirmDelete = async () => {
    if (!confirmTarget) return;
    
    try {
      const res = await fetch(`/api/pengaturan/hari-libur?tanggal=${confirmTarget}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        fetchHolidays();
      } else {
        alert('Gagal menghapus: ' + data.error);
      }
    } catch (error) {
      alert('Terjadi kesalahan sistem.');
    }
    setConfirmTarget(null);
  };

  return (
    <div className="animate-fadeIn">
      <div className="page-header">
        <div>
          <h1 className="page-title">Hari Libur</h1>
          <p className="page-subtitle">Kelola kalender libur nasional dan libur pabrik. Data ini otomatis dibaca oleh Mesin Tarik Absen.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px', alignItems: 'start' }}>
        {/* Form Tambah Libur */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '16px' }}>Tambah / Edit Libur</h2>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div className="form-group">
              <label className="form-label">Tanggal</label>
              <input 
                type="date" 
                required
                className="form-input"
                value={formTanggal}
                onChange={(e) => setFormTanggal(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Keterangan</label>
              <input 
                type="text" 
                required
                placeholder="Cth: Libur Nasional Idul Fitri"
                className="form-input"
                value={formKeterangan}
                onChange={(e) => setFormKeterangan(e.target.value)}
              />
            </div>
            <button 
              type="submit" 
              disabled={isSubmitting}
              className="btn btn-primary"
              style={{ marginTop: '8px' }}
            >
              {isSubmitting ? 'Menyimpan...' : 'Simpan Hari Libur'}
            </button>
          </form>
        </div>

        {/* Daftar Libur */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>Daftar Libur</h2>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <select 
                className="form-select"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                style={{ width: '100px' }}
              >
                <option value="2025">2025</option>
                <option value="2026">2026</option>
                <option value="2027">2027</option>
              </select>
            </div>
          </div>

          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Keterangan</th>
                  <th style={{ textAlign: 'center' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={3} style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>Memuat data kalender...</td>
                  </tr>
                ) : holidays.length === 0 ? (
                  <tr>
                    <td colSpan={3} style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>Belum ada hari libur di tahun {year}</td>
                  </tr>
                ) : (
                  holidays.map((h) => (
                    <tr key={h.tanggal}>
                      <td>
                        <div style={{ fontWeight: 500, color: 'var(--danger)' }}>
                          {format(new Date(h.tanggal), 'dd MMMM yyyy')}
                        </div>
                      </td>
                      <td>{h.keterangan}</td>
                      <td style={{ textAlign: 'center' }}>
                        <button 
                          onClick={() => handleDelete(h.tanggal)}
                          className="btn btn-sm btn-icon"
                          style={{ color: 'var(--danger)', background: 'rgba(239,68,68,0.1)' }}
                          title="Hapus"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={!!confirmTarget}
        title="Hapus Hari Libur"
        description={`Apakah Anda yakin ingin menghapus hari libur pada tanggal ${confirmTarget}?`}
        confirmText="Hapus"
        cancelText="Batal"
        onConfirm={confirmDelete}
        onCancel={() => setConfirmTarget(null)}
        variant="danger"
      />
    </div>
  );
}
