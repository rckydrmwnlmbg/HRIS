'use client';
import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/lib/context';
import { t } from '@/lib/i18n';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { DataTable } from '@/components/ui/DataTable';
import type { Karyawan, Department, Seksi, JenisKaryawan, Jabatan } from '@/types';
import { Search, Plus, Eye, Edit2, Trash2, Users, Filter, X, MoreVertical } from 'lucide-react';
import styles from './karyawan.module.css';

const PAGE_SIZE = 15;

export default function KaryawanPage() {
  const { settings } = useApp();
  const lang = settings.language;
  const router = useRouter();

  const [search, setSearch] = useState('');
  const [filterSec, setFilterSec] = useState('');
  const [filterJob, setFilterJob] = useState('');
  const [filterJns, setFilterJns] = useState('');
  const [filterStatus, setFilterStatus] = useState('aktif');
  const [page, setPage] = useState(1);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [showFilter, setShowFilter] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Karyawan | null>(null);
  const [dataKaryawan, setDataKaryawan] = useState<Karyawan[]>([]);
  const [totalData, setTotalData] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [masterSec, setMasterSec] = useState<Seksi[]>([]);
  const [masterJob, setMasterJob] = useState<Jabatan[]>([]);
  const [masterJns, setMasterJns] = useState<JenisKaryawan[]>([]);
  const [masterTeams, setMasterTeams] = useState<string[]>([]);

  useEffect(() => {
    async function loadMaster() {
      try {
        const res = await fetch('/api/master');
        if (res.ok) {
          const data = await res.json();
          setMasterSec(data.seksi || []);
          setMasterJob(data.jabatan || []);
          setMasterJns(data.jenisKaryawan || []);
          setMasterTeams(data.teams || []);
        }
      } catch (err) { console.error('Failed to load master data', err); }
    }
    loadMaster();
  }, []);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const params = new URLSearchParams({
          q: search,
          page: page.toString(),
          limit: PAGE_SIZE.toString(),
          status: filterStatus === 'semua' ? '' : filterStatus,
          sec: filterSec,
          job: filterJob,
          jns: filterJns
        });
        const res = await fetch(`/api/karyawan?${params.toString()}`);
        if (res.ok) {
          const result = await res.json();
          if (result.data) {
            setDataKaryawan(result.data);
            setTotalData(result.meta.total);
            setTotalPages(result.meta.totalPages);
          } else if (Array.isArray(result)) {
            // Fallback if backend hasn't reloaded yet
            setDataKaryawan(result);
            setTotalData(result.length);
            setTotalPages(Math.ceil(result.length / PAGE_SIZE));
          }
        }
      } catch (err) {
        console.error('Failed to fetch data', err);
      } finally {
        setIsLoading(false);
      }
    }
    const timer = setTimeout(loadData, 300); // Debounce search
    return () => clearTimeout(timer);
  }, [search, page, filterStatus, filterSec, filterJob, filterJns]);

  const resetFilter = () => {
    setFilterSec(''); setFilterJob(''); setFilterJns(''); setFilterStatus('aktif');
    setSearch(''); setPage(1);
  };

  const seksiForDep = masterSec;

  const getStatusBadge = (k: Karyawan) => {
    if (!k.Act_NonAct) return <span className="badge badge-danger">{t(lang, 'tidakAktif')}</span>;
    return <span className="badge badge-success">{t(lang, 'aktif')}</span>;
  };

  const getJnsBadge = (jns: string | null) => {
    const map: Record<string, string> = { '100': 'badge-info', '101': 'badge-warning', '102': 'badge-purple' };
    const cls = map[jns || ''] || 'badge-gray';
    const jnsItem = masterJns.find(j => j.JNS_CODE === jns);
    return <span className={`badge ${cls}`}>{jnsItem?.JNS_DESC || jns || '-'}</span>;
  };

  return (
    <div className="animate-fadeIn">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t(lang, 'daftarKaryawan')}</h1>
          <p className="page-subtitle">{totalData} {t(lang, 'data')}</p>
        </div>
        <button className="btn btn-primary" onClick={() => router.push('/karyawan/baru')}>
          <Plus size={15} /> {t(lang, 'tambahKaryawan')}
        </button>
      </div>

      <div className={styles.toolbar}>
        <div className="search-wrapper" style={{ flex: 1, maxWidth: 320 }}>
          <Search size={15} className="search-icon" />
          <input className="form-input" placeholder={t(lang, 'cariKaryawan')} value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {(['aktif', 'tidakAktif', 'semua'] as const).map(s => (
            <button key={s} className={`btn btn-sm ${filterStatus === s ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => { setFilterStatus(s === 'tidakAktif' ? 'tidak' : s); setPage(1); }}>
              {s === 'aktif' ? t(lang, 'aktif') : s === 'tidakAktif' ? t(lang, 'tidakAktif') : t(lang, 'semua')}
            </button>
          ))}
          <button className={`btn btn-sm ${showFilter ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setShowFilter(!showFilter)}>
            <Filter size={13} /> {t(lang, 'filter')}
          </button>
          {(filterSec || filterJob || filterJns) && (
            <button className="btn btn-sm btn-danger" onClick={resetFilter}><X size={13} /> {t(lang, 'reset')}</button>
          )}
        </div>
      </div>

      {showFilter && (
        <div className={styles.filterPanel}>
          <div className="form-group">
            <label className="form-label">{t(lang, 'bagian')}</label>
            <select className="form-select" value={filterSec} onChange={e => { setFilterSec(e.target.value); setPage(1); }}>
              <option value="">{t(lang, 'semua')}</option>
              {masterSec.map(s => <option key={s.SEC_CD} value={s.SEC_CD}>{s.SEC_DESC}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">{t(lang, 'jabatan')}</label>
            <select className="form-select" value={filterJob} onChange={e => { setFilterJob(e.target.value); setPage(1); }}>
              <option value="">{t(lang, 'semua')}</option>
              {masterTeams.map(team => <option key={team} value={team}>{team}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">{t(lang, 'jenisKaryawan')}</label>
            <select className="form-select" value={filterJns} onChange={e => { setFilterJns(e.target.value); setPage(1); }}>
              <option value="">{t(lang, 'semua')}</option>
              {masterJns.map(j => <option key={j.JNS_CODE} value={j.JNS_CODE}>{j.JNS_DESC}</option>)}
            </select>
          </div>
        </div>
      )}

      <div className="glass-card" style={{ marginTop: '16px', minHeight: '400px' }}>
        <DataTable wrapperClassName="karyawan-table">
            <thead>
              <tr>
                <th>{t(lang, 'nik')}</th>
                <th>{t(lang, 'nama')}</th>
                <th>{t(lang, 'bagian')}</th>
                <th>{t(lang, 'jabatan')}</th>
                <th>{t(lang, 'jenisKaryawan')}</th>
                <th>{t(lang, 'tanggalMasuk')}</th>
                <th>{t(lang, 'status')}</th>
                <th style={{ width: '50px' }}></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td><Skeleton width={60} height={16} /></td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <Skeleton variant="circle" width={32} height={32} />
                        <div>
                          <Skeleton width={120} height={16} style={{ marginBottom: '4px' }} />
                          <Skeleton width={80} height={12} />
                        </div>
                      </div>
                    </td>
                    <td><Skeleton width={100} height={16} /></td>
                    <td><Skeleton width={100} height={16} /></td>
                    <td><Skeleton width={60} height={20} style={{ borderRadius: '100px' }} /></td>
                    <td><Skeleton width={80} height={16} /></td>
                    <td><Skeleton width={60} height={20} style={{ borderRadius: '100px' }} /></td>
                    <td><Skeleton variant="circle" width={24} height={24} /></td>
                  </tr>
                ))
              ) : dataKaryawan.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: 0 }}>
                    <EmptyState 
                      icon="search"
                      title="Karyawan Tidak Ditemukan"
                      description="Tidak ada karyawan yang cocok dengan pencarian atau filter Anda."
                    />
                  </td>
                </tr>
              ) : (
                    dataKaryawan.map(k => (
                      <tr 
                        key={k.EMP_CD} 
                        className={!k.Act_NonAct ? 'row-danger' : ''}
                        onClick={() => router.push(`/karyawan/${k.EMP_CD}`)}
                        style={{ cursor: 'pointer' }}
                      >
                        <td><span style={{ fontFamily: 'monospace', fontSize: '12px', color: 'var(--accent-blue)' }}>{k.EMP_CD}</span></td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div className={styles.avatar}>{(k.EMP_NM || '?').charAt(0)}</div>
                            <div>
                              <div style={{ fontWeight: '500' }}>{k.EMP_NM}</div>
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{k.SX === 'L' ? '♂' : k.SX === 'P' ? '♀' : ''} · {k.agama || '-'}</div>
                            </div>
                          </div>
                        </td>
                        <td><span style={{ fontSize: '12px' }}>{k.SEC_DESC || k.SEC_CD || '-'}</span></td>
                        <td><span style={{ fontSize: '12px' }}>{k.TEAM || k.JOB_DESC || k.JOB_CD || '-'}</span></td>
                        <td>{getJnsBadge(k.JNS_KRY)}</td>
                        <td><span style={{ fontSize: '12px' }}>{k.DT_ENTRY ? new Date(k.DT_ENTRY).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}</span></td>
                        <td>{getStatusBadge(k)}</td>
                        <td style={{ position: 'relative' }}>
                          <button 
                            className="btn btn-sm btn-icon" 
                            style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)' }}
                            onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === k.EMP_CD ? null : k.EMP_CD); }}
                          >
                            <MoreVertical size={16} />
                          </button>
                          
                          {openMenuId === k.EMP_CD && (
                            <>
                              <div 
                                style={{
                                  position: 'fixed', inset: 0, zIndex: 40
                                }}
                                onClick={(e) => { e.stopPropagation(); setOpenMenuId(null); }}
                              />
                              <div className={styles.glassDropdown} style={{ zIndex: 50 }}>
                              <button 
                                className="btn btn-sm w-full" 
                                style={{ justifyContent: 'flex-start', background: 'transparent', border: 'none', color: 'var(--text-primary)' }}
                                onClick={(e) => { e.stopPropagation(); router.push(`/karyawan/${k.EMP_CD}/edit`); }}
                              >
                                <Edit2 size={13} style={{ marginRight: '6px' }} /> {t(lang, 'edit')}
                              </button>
                              <button 
                                className="btn btn-sm w-full" 
                                style={{ justifyContent: 'flex-start', background: 'transparent', border: 'none', color: 'var(--danger)' }}
                                onClick={(e) => { e.stopPropagation(); setDeleteTarget(k); setOpenMenuId(null); }}
                              >
                                <Trash2 size={13} style={{ marginRight: '6px' }} /> {t(lang, 'hapus')}
                              </button>
                            </div>
                            </>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
        </DataTable>
            {totalPages > 1 && (
              <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', borderTop: '1px solid var(--border)' }}>
                <span className="page-info">{t(lang, 'halaman')} {page} {t(lang, 'dari')} {totalPages} — {totalData} {t(lang, 'data')}</span>
                <div className="pagination">
                  <button className="btn btn-sm btn-secondary" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>{t(lang, 'sebelumnya')}</button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const pg = Math.max(1, Math.min(page - 2, totalPages - 4)) + i;
                    return <button key={pg} className={`btn btn-sm ${pg === page ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setPage(pg)}>{pg}</button>;
                  })}
                  <button className="btn btn-sm btn-secondary" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>{t(lang, 'selanjutnya')}</button>
                </div>
              </div>
            )}
          </div>

      {deleteTarget && (
        <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="modal-header"><h3 className="modal-title">🗑️ {t(lang, 'hapusKaryawan')}</h3></div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>{t(lang, 'konfirmasiHapus')}</p>
              <div style={{ marginTop: '12px', padding: '12px', background: 'var(--danger-bg)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(239,68,68,0.2)' }}>
                <div style={{ fontWeight: '600' }}>{deleteTarget.EMP_NM}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{deleteTarget.EMP_CD}</div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDeleteTarget(null)}>{t(lang, 'batal')}</button>
              <button className="btn btn-danger" onClick={() => {
                alert(lang === 'id' ? 'Fitur hapus belum diaktifkan untuk keamanan data.' : 'Delete is disabled for data safety.');
                setDeleteTarget(null);
              }}>{t(lang, 'yaHapus')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
