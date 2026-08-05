'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';

import { Trash2 } from 'lucide-react';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { useApp } from '@/lib/context';

interface Holiday {
  tanggal: string;
  keterangan: string;
  status_libur: string;
}

export default function HariLiburPage() {
  const { settings } = useApp();
  const lang = settings.language;
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
        alert(lang === 'id' ? 'Hari libur berhasil ditambahkan' : 'Holiday added successfully');
        setFormTanggal('');
        setFormKeterangan('');
        fetchHolidays();
      } else {
        alert(lang === 'id' ? 'Terjadi kendala saat menyimpan data' : 'Failed to save data');
      }
    } catch (error) {
      alert(lang === 'id' ? 'Terjadi kendala pada sistem' : 'A system error occurred');
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
        alert(lang === 'id' ? 'Terjadi kendala saat menghapus data' : 'Failed to delete data');
      }
    } catch (error) {
      alert(lang === 'id' ? 'Terjadi kendala pada sistem' : 'A system error occurred');
    }
    setConfirmTarget(null);
  };

  return (
    <div className="animate-fadeIn">
      <div className="page-header">
        <div>
          <h1 className="page-title">{lang === 'id' ? 'Kalender Hari Libur' : 'Holiday Calendar'}</h1>
          <p className="page-subtitle">{lang === 'id' ? 'Pengelolaan kalender libur nasional dan libur perusahaan yang diterapkan secara otomatis pada seluruh catatan kehadiran.' : 'Manage national and company holidays automatically applied to all attendance records.'}</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px', alignItems: 'start' }}>
        {/* Form Tambah Libur */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '16px' }}>{lang === 'id' ? 'Tambah Hari Libur Baru' : 'Add New Holiday'}</h2>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div className="form-group">
              <label className="form-label">{lang === 'id' ? 'Tanggal' : 'Date'}</label>
              <input 
                type="date" 
                required
                className="form-input"
                value={formTanggal}
                onChange={(e) => setFormTanggal(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">{lang === 'id' ? 'Keterangan' : 'Description'}</label>
              <input 
                type="text" 
                required
                placeholder={lang === 'id' ? 'Cth: Hari Raya Idul Fitri' : 'E.g: National Holiday'}
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
              {isSubmitting ? (lang === 'id' ? 'Menyimpan...' : 'Saving...') : (lang === 'id' ? 'Simpan Hari Libur' : 'Save Holiday')}
            </button>
          </form>
        </div>

        {/* Daftar Libur */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>{lang === 'id' ? 'Daftar Hari Libur' : 'Holiday List'}</h2>
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
                  <th>{lang === 'id' ? 'Tanggal' : 'Date'}</th>
                  <th>{lang === 'id' ? 'Keterangan' : 'Description'}</th>
                  <th style={{ textAlign: 'center' }}>{lang === 'id' ? 'Tindakan' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={3} style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>{lang === 'id' ? 'Memuat kalender hari libur...' : 'Loading holiday calendar...'}</td>
                  </tr>
                ) : holidays.length === 0 ? (
                  <tr>
                    <td colSpan={3} style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>{lang === 'id' ? `Belum ada hari libur yang terdaftar di tahun ${year}` : `No holidays registered for ${year}`}</td>
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
                          title={lang === 'id' ? 'Hapus' : 'Delete'}
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
        title={lang === 'id' ? 'Hapus Hari Libur' : 'Delete Holiday'}
        description={lang === 'id' ? `Apakah Anda yakin ingin menghapus hari libur pada tanggal ${confirmTarget}?` : `Are you sure you want to delete the holiday on ${confirmTarget}?`}
        confirmText={lang === 'id' ? 'Hapus' : 'Delete'}
        cancelText={lang === 'id' ? 'Batal' : 'Cancel'}
        onConfirm={confirmDelete}
        onCancel={() => setConfirmTarget(null)}
        variant="danger"
      />
    </div>
  );
}
