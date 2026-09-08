'use client';
import { useState, useEffect } from 'react';
import { useApp } from '@/lib/context';
import { t } from '@/lib/i18n';
import { Search } from 'lucide-react';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { MarqueeBadge } from '@/components/ui/Badge';

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

  const getRecordStatus = (r: any): { key: 'hadir' | 'sakit' | 'izin' | 'cuti' | 'alpha' | 'libur'; label: string; badgeClass: string } => {
    const statusHari = normalize(r.STATUS_HARI);
    const rg = normalize(r.REASON_GROUP);
    const reason = normalize(r.REASON);

    if (statusHari === 'LIBUR' || statusHari === 'L') {
      return { key: 'libur', label: lang === 'id' ? 'Hari Libur' : 'Holiday', badgeClass: 'badge-gray' };
    }

    if (rg === 'S' || ['15', '03'].includes(reason)) {
      return { key: 'sakit', label: r.REASON_DESC || t(lang, 'sakit'), badgeClass: 'badge-sakit' };
    }

    if (rg === 'I' || ['04', '05', '06', '07'].includes(reason)) {
      return { key: 'izin', label: r.REASON_DESC || t(lang, 'izin'), badgeClass: 'badge-izin' };
    }

    if (['C', 'H'].includes(rg) || ['18', '13', '17'].includes(reason)) {
      return { key: 'cuti', label: r.REASON_DESC || t(lang, 'cuti'), badgeClass: 'badge-cuti' };
    }

    if (r.WORK_IN || r.WORK_OUT) {
      return { key: 'hadir', label: t(lang, 'hadir'), badgeClass: 'badge-hadir' };
    }

    if (rg === 'A' || statusHari === 'KERJA') {
      return { key: 'alpha', label: t(lang, 'alpha'), badgeClass: 'badge-alpha' };
    }

    return { key: 'libur', label: r.STATUS_HARI || '-', badgeClass: 'badge-gray' };
  };

  const stats = {
    total: filtered.length,
    hadir: filtered.filter(r => getRecordStatus(r).key === 'hadir').length,
    telat: filtered.filter(r => r.Time_Late && r.Time_Late > 0).length,
    sakit: filtered.filter(r => getRecordStatus(r).key === 'sakit').length,
    izin: filtered.filter(r => getRecordStatus(r).key === 'izin').length,
    cuti: filtered.filter(r => getRecordStatus(r).key === 'cuti').length,
    alpha: filtered.filter(r => getRecordStatus(r).key === 'alpha').length,
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
          <p className="page-subtitle">{lang === 'id' ? 'Pemantauan kehadiran karyawan secara harian' : 'Daily employee attendance monitoring'}</p>
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
          <div className="stat-label">{lang === 'id' ? 'Izin / Sakit / Cuti' : 'Permit / Sick / Leave'}</div>
          <div className="stat-value" style={{ color: 'var(--accent)' }}>{stats.sakit + stats.izin + stats.cuti}</div>
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
          <div style={{ padding: '16px' }}>
            <SkeletonTable rows={7} cols={6} />
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
                  <th style={{ minWidth: 120, width: 120, whiteSpace: 'nowrap' }}>{t(lang, 'statusHari')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                    {lang === 'id' ? 'Tidak ada catatan kehadiran untuk tanggal ini' : 'No attendance records for this date'}
                  </td></tr>
                ) : filtered.slice(0, 100).map((r, i) => {
                  const isLate = r.Time_Late && r.Time_Late > 0;
                  const st = getRecordStatus(r);
                  return (
                    <tr key={`${r.EMP_CD}-${i}`}>
                      <td><span style={{ color: 'var(--accent-blue)', fontSize: '12px', fontWeight: 500 }}>{r.EMP_CD}</span></td>
                      <td style={{ fontWeight: 500 }}>{r.EMP_NM}</td>
                      <td style={{ fontSize: '12px' }}>{r.DEP_DESC || r.DEP_CD || '-'}</td>
                      <td>
                        {r.WORK_IN ? (
                           <span style={{ fontSize: '13px', color: isLate ? 'var(--warning)' : 'var(--success)' }}>
                            {fmtTime(r.WORK_IN)}
                            {isLate && <span style={{ marginLeft: '6px', fontSize: '10px' }}>⚠ {lang === 'id' ? 'Terlambat' : 'Late'}</span>}
                          </span>
                        ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                      </td>
                      <td>
                        {r.WORK_OUT ? (
                          <span style={{ fontSize: '13px', color: 'var(--info)' }}>{fmtTime(r.WORK_OUT)}</span>
                        ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <MarqueeBadge
                          variant={st.key === 'libur' ? 'gray' : st.key}
                          width={110}
                          height={23}
                        >
                          {st.label}
                        </MarqueeBadge>
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
