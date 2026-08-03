'use client';
import { useState, useEffect } from 'react';
import { useApp } from '@/lib/context';
import { t } from '@/lib/i18n';
import { Search } from 'lucide-react';

export default function DailyAttendancePage() {
  const { settings } = useApp();
  const lang = settings.language;
  const today = new Date();

  const [date, setDate] = useState(today.toISOString().split('T')[0]);
  const [search, setSearch] = useState('');
  const [records, setRecords] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadDaily() {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/daily?date=${date}`);
        if (res.ok) {
          const data = await res.json();
          setRecords(Array.isArray(data) ? data : []);
        }
      } catch (err) { console.error(err); }
      setIsLoading(false);
    }
    loadDaily();
  }, [date]);

  const filtered = records.filter(r =>
    String(r.EMP_NM || '').toLowerCase().includes(search.toLowerCase()) ||
    String(r.EMP_CD || '').toLowerCase().includes(search.toLowerCase())
  );

  const normalize = (s: string | null) => (s || '').trim().toUpperCase();

  const stats = {
    total: filtered.length,
    hadir: filtered.filter(r => ['KERJA', 'O'].includes(normalize(r.STATUS_HARI))).length,
    telat: filtered.filter(r => r.Time_Late && r.Time_Late > 0).length,
    absen: filtered.filter(r => ['ALPHA', 'A'].includes(normalize(r.STATUS_HARI))).length,
    cuti: filtered.filter(r => ['CUTI', 'C', 'IJIN', 'I', 'SAKIT', 'S'].includes(normalize(r.STATUS_HARI))).length,
  };

  const fmtTime = (d: string | null) => {
    if (!d) return null;
    const dt = new Date(d);
    return dt.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div className="animate-fadeIn">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t(lang, 'daily')}</h1>
          <p className="page-subtitle">{lang === 'id' ? 'Pantauan kehadiran karyawan per hari' : 'Daily employee attendance monitoring'}</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <input type="date" className="form-input" value={date} onChange={e => setDate(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="grid grid-4 gap-4" style={{ marginBottom: '24px' }}>
        <div className="glass-card stat-card">
          <div className="stat-label">{lang === 'id' ? 'Total Tercatat' : 'Total Recorded'}</div>
          <div className="stat-value" style={{ color: 'var(--text-primary)' }}>{stats.total}</div>
        </div>
        <div className="glass-card stat-card">
          <div className="stat-label">{t(lang, 'hadir')}</div>
          <div className="stat-value" style={{ color: 'var(--status-hadir)' }}>{stats.hadir}</div>
        </div>
        <div className="glass-card stat-card">
          <div className="stat-label">{lang === 'id' ? 'Terlambat' : 'Late'}</div>
          <div className="stat-value" style={{ color: 'var(--warning)' }}>{stats.telat}</div>
        </div>
        <div className="glass-card stat-card">
          <div className="stat-label">{lang === 'id' ? 'Tidak Hadir / Cuti' : 'Absent / Leave'}</div>
          <div className="stat-value" style={{ color: 'var(--status-alpha)' }}>{stats.absen + stats.cuti}</div>
        </div>
      </div>

      <div className="glass-card">
        <div style={{ padding: '16px', borderBottom: '1px solid var(--border)', display: 'flex', gap: '12px' }}>
          <div className="search-wrapper" style={{ flex: 1, maxWidth: '300px' }}>
            <Search size={15} className="search-icon" />
            <input className="form-input" placeholder={t(lang, 'cari')} value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        {isLoading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <div className="spinner" style={{ margin: '0 auto 16px' }}></div>
            {lang === 'id' ? 'Memuat data...' : 'Loading...'}
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t(lang, 'nik')}</th>
                  <th>{t(lang, 'nama')}</th>
                  <th>{t(lang, 'departemen')}</th>
                  <th>{t(lang, 'jamMasuk')}</th>
                  <th>{t(lang, 'jamPulang')}</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                    {lang === 'id' ? 'Tidak ada data absensi untuk tanggal ini' : 'No attendance data for this date'}
                  </td></tr>
                ) : filtered.slice(0, 100).map((r, i) => {
                  const isLate = r.Time_Late && r.Time_Late > 0;
                  const status = normalize(r.STATUS_HARI);
                  return (
                    <tr key={`${r.EMP_CD}-${i}`}>
                      <td><span style={{ fontFamily: 'monospace', color: 'var(--accent-blue)', fontSize: '12px' }}>{r.EMP_CD}</span></td>
                      <td style={{ fontWeight: 500 }}>{r.EMP_NM}</td>
                      <td style={{ fontSize: '12px' }}>{r.DEP_DESC || r.DEP_CD || '-'}</td>
                      <td>
                        {r.WORK_IN ? (
                          <span style={{ fontFamily: 'monospace', fontSize: '13px', color: isLate ? 'var(--warning)' : 'var(--success)' }}>
                            {fmtTime(r.WORK_IN)}
                            {isLate && <span style={{ marginLeft: '6px', fontSize: '10px' }}>⚠ Telat</span>}
                          </span>
                        ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                      </td>
                      <td>
                        {r.WORK_OUT ? (
                          <span style={{ fontFamily: 'monospace', fontSize: '13px', color: 'var(--info)' }}>{fmtTime(r.WORK_OUT)}</span>
                        ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                      </td>
                      <td>
                        {['KERJA', 'O'].includes(status) ? <span className="badge badge-hadir">{t(lang, 'hadir')}</span>
                          : ['ALPHA', 'A'].includes(status) ? <span className="badge badge-alpha">{t(lang, 'alpha')}</span>
                          : ['CUTI', 'C'].includes(status) ? <span className="badge badge-cuti">{t(lang, 'cuti')}</span>
                          : ['SAKIT', 'S'].includes(status) ? <span className="badge badge-sakit">{t(lang, 'sakit')}</span>
                          : ['IJIN', 'I'].includes(status) ? <span className="badge badge-izin">{t(lang, 'izin')}</span>
                          : <span className="badge badge-gray">{r.STATUS_HARI}</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
