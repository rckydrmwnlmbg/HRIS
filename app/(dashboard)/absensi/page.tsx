'use client';
import React, { useState, useEffect, Suspense, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useApp } from '@/lib/context';
import { useToast } from '@/components/ui/ToastProvider';
import type { Karyawan, AbsensiRecord, Reason, Shift } from '@/types';
import { EmptyState } from '@/components/ui/EmptyState';
import { DataTable } from '@/components/ui/DataTable';
import { Skeleton } from '@/components/ui/Skeleton';
import { AbsensiFilterBar } from '@/components/absensi/AbsensiFilterBar';
import { AbsensiRekapCards } from '@/components/absensi/AbsensiRekapCards';
import { AbsensiMonthlyTable } from '@/components/absensi/AbsensiMonthlyTable';
import { AbsensiSyncModal } from '@/components/absensi/AbsensiSyncModal';
import { AbsensiShiftModal } from '@/components/absensi/AbsensiShiftModal';

function AbsensiContent() {
  const { settings, user } = useApp();
  const lang = settings.language;
  const { showToast } = useToast();
  const searchParams = useSearchParams();
  const empParam = searchParams.get('emp');

  const now = new Date();
  const [searchEmp, setSearchEmp] = useState('');
  const [selectedEmp, setSelectedEmp] = useState<Karyawan | null>(null);
  const [bulan, setBulan] = useState(now.getMonth() + 1);
  const [tahun, setTahun] = useState(now.getFullYear());
  const [records, setRecords] = useState<AbsensiRecord[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [corrections, setCorrections] = useState<Map<string, AbsensiRecord>>(new Map());
  const [masterReasons, setMasterReasons] = useState<Reason[]>([]);
  const [masterShifts, setMasterShifts] = useState<Shift[]>([]);
  const [karyawanList, setKaryawanList] = useState<Karyawan[]>([]);

  // Shift Modal State
  const [syncShiftModal, setSyncShiftModal] = useState(false);
  const [syncShiftLoading, setSyncShiftLoading] = useState(false);
  const [syncShiftData, setSyncShiftData] = useState<any>(null);

  // DataSolution Sync Modal State
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [syncStartDate, setSyncStartDate] = useState('');
  const [syncEndDate, setSyncEndDate] = useState('');
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncMessage, setSyncMessage] = useState('');

  // Load masters & karyawan
  useEffect(() => {
    async function loadMaster() {
      try {
        const [mRes, kRes] = await Promise.all([
          fetch('/api/master'),
          fetch('/api/karyawan?status=aktif&limit=10000')
        ]);
        if (mRes.ok) {
          const mData = await mRes.json();
          setMasterReasons(mData.reasons || []);
          setMasterShifts(mData.shifts || []);
        }
        if (kRes.ok) {
          const json = await kRes.json();
          const list = Array.isArray(json) ? json : json.data || [];
          setKaryawanList(list);
          if (empParam) {
            const found = list.find((k: Karyawan) => k.EMP_CD.trim() === empParam.trim());
            if (found) {
              setSelectedEmp(found);
            }
          }
        }
      } catch (err) {
        console.error('Failed to load initial masters', err);
      }
    }
    loadMaster();
  }, [empParam]);

  const loadAbsensi = useCallback(async (empCd: string, bln: number, thn: number) => {
    setLoaded(false);
    try {
      const res = await fetch(`/api/absensi?emp=${empCd}&bulan=${bln}&tahun=${thn}`);
      if (res.ok) {
        setRecords(await res.json());
      } else {
        setRecords([]);
      }
    } catch (error) {
      console.error(error);
      setRecords([]);
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (selectedEmp) {
      loadAbsensi(selectedEmp.EMP_CD, bulan, tahun);
    }
  }, [selectedEmp, bulan, tahun, loadAbsensi]);

  const filteredKaryawan = karyawanList.filter(k =>
    k.EMP_CD.toLowerCase().includes(searchEmp.toLowerCase()) ||
    k.EMP_NM.toLowerCase().includes(searchEmp.toLowerCase())
  ).slice(0, 8);

  const isSecurityEmployee = (emp: Karyawan | null) => {
    if (!emp) return false;
    const job = (emp.JOB_DESC || emp.JOB_CD || '').toUpperCase();
    const sec = (emp.SEC_DESC || emp.SEC_CD || '').toUpperCase();
    return job.includes('SECURITY') || job.includes('SATPAM') || sec.includes('SECURITY') || sec.includes('SATPAM');
  };

  const handleApplyCorrection = async (key: string) => {
    const rec = corrections.get(key);
    if (!rec) return;

    try {
      const res = await fetch('/api/absensi/koreksi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          DATE_TRANS: rec.DATE_TRANS,
          EMP_CD: rec.EMP_CD,
          WORK_IN: rec.WORK_IN,
          WORK_OUT: rec.WORK_OUT,
          corrected_status: rec.corrected_status,
          corrected_reason: rec.corrected_reason,
          corrected_shift: rec.corrected_shift,
          notes: '',
          correction_by: user?.nama || 'Admin'
        })
      });

      if (res.ok) {
        setCorrections(prev => {
          const map = new Map(prev);
          map.set(key, { ...rec, correction_status: 'applied' });
          return map;
        });
        showToast(lang === 'id' ? 'Penyesuaian presensi berhasil diterapkan!' : 'Attendance adjustment applied successfully!', 'success');
        if (selectedEmp) loadAbsensi(selectedEmp.EMP_CD, bulan, tahun);
      } else {
        const err = await res.json();
        showToast(lang === 'id' ? 'Gagal menyimpan: ' + err.error : 'Failed to save: ' + err.error, 'warning');
      }
    } catch (err) {
      console.error(err);
      showToast(lang === 'id' ? 'Terjadi kendala pada sistem' : 'A system error occurred', 'error');
    }
  };

  const handleApplyAllCorrections = async () => {
    const drafts = Array.from(corrections.entries()).filter(([_, rec]) => rec.correction_status !== 'applied');
    if (drafts.length === 0) return;

    let successCount = 0;
    for (const [key, rec] of drafts) {
      try {
        const res = await fetch('/api/absensi/koreksi', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            DATE_TRANS: rec.DATE_TRANS,
            EMP_CD: rec.EMP_CD,
            WORK_IN: rec.WORK_IN,
            WORK_OUT: rec.WORK_OUT,
            corrected_status: rec.corrected_status,
            corrected_reason: rec.corrected_reason,
            corrected_shift: rec.corrected_shift,
            notes: '',
            correction_by: user?.nama || 'Admin'
          })
        });

        if (res.ok) {
          setCorrections(prev => {
            const map = new Map(prev);
            map.set(key, { ...rec, correction_status: 'applied' });
            return map;
          });
          successCount++;
        }
      } catch (e) {
        console.error(e);
      }
    }

    if (successCount > 0) {
      showToast(lang === 'id' ? `${successCount} koreksi berhasil diterapkan!` : `${successCount} corrections applied!`, 'success');
      if (selectedEmp) loadAbsensi(selectedEmp.EMP_CD, bulan, tahun);
    }
  };

  const handleSyncShiftPreview = async () => {
    if (!selectedEmp) return;
    setSyncShiftLoading(true);
    setSyncShiftData(null);
    setSyncShiftModal(true);
    try {
      const res = await fetch('/api/absensi/sync-shift-security', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bulan, tahun, emp_cd: selectedEmp.EMP_CD, mode: 'preview' }),
      });
      if (res.ok) {
        setSyncShiftData(await res.json());
      } else {
        const err = await res.json();
        showToast(err.error || 'Gagal memuat preview', 'warning');
        setSyncShiftModal(false);
      }
    } catch (e) {
      console.error(e);
      showToast('Terjadi kesalahan koneksi', 'error');
      setSyncShiftModal(false);
    }
    setSyncShiftLoading(false);
  };

  const handleSyncShiftApply = async () => {
    if (!selectedEmp) return;
    setSyncShiftLoading(true);
    try {
      const res = await fetch('/api/absensi/sync-shift-security', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bulan, tahun, emp_cd: selectedEmp.EMP_CD, mode: 'apply' }),
      });
      if (res.ok) {
        const result = await res.json();
        showToast(result.message || `${result.updated} shift diperbarui`, 'success');
        setSyncShiftModal(false);
        if (selectedEmp) loadAbsensi(selectedEmp.EMP_CD, bulan, tahun);
      } else {
        const err = await res.json();
        showToast(err.error || 'Gagal menerapkan', 'warning');
      }
    } catch (e) {
      console.error(e);
      showToast('Terjadi kesalahan koneksi', 'error');
    }
    setSyncShiftLoading(false);
  };

  const openSyncModal = () => {
    const end = new Date(tahun, bulan, 0);
    const pad = (n: number) => String(n).padStart(2, '0');
    setSyncStartDate(`${tahun}-${pad(bulan)}-01`);
    setSyncEndDate(`${tahun}-${pad(bulan)}-${pad(end.getDate())}`);
    setSyncModalOpen(true);
  };

  const handleSyncDataSolution = async () => {
    if (!syncStartDate || !syncEndDate) {
      showToast(lang === 'id' ? 'Tanggal mulai dan selesai harus diisi' : 'Start and end dates are required', 'warning');
      return;
    }
    setSyncLoading(true);
    setSyncProgress(0);
    setSyncMessage(lang === 'id' ? 'Menghubungkan ke server...' : 'Connecting to server...');
    try {
      const res = await fetch('/api/absensi/sync-datasolution', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate: syncStartDate, endDate: syncEndDate })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        showToast(err.error || (lang === 'id' ? 'Gagal sinkronisasi' : 'Sync failed'), 'warning');
        setSyncLoading(false);
        return;
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error('Stream not supported');

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.replace('data: ', ''));
              if (data.type === 'progress') {
                setSyncMessage(data.message);
                setSyncProgress(data.progress);
              } else if (data.type === 'done') {
                setSyncMessage(data.message);
                setSyncProgress(100);
                showToast(data.message || 'Sinkronisasi berhasil', 'success');
                setTimeout(() => {
                  setSyncModalOpen(false);
                  if (selectedEmp) loadAbsensi(selectedEmp.EMP_CD, bulan, tahun);
                }, 1500);
              } else if (data.type === 'error') {
                showToast(data.message || 'Gagal sinkronisasi', 'warning');
              }
            } catch (e) {}
          }
        }
      }
    } catch (e) {
      showToast(lang === 'id' ? 'Terjadi kesalahan koneksi' : 'Connection error occurred', 'error');
    }
    setSyncLoading(false);
  };

  const rekap = records.reduce((acc, r) => {
    let key = 'O';
    const statusHari = (r.STATUS_HARI || '').trim().toUpperCase();
    const reasonGroup = r.REASON_GROUP ? (r.REASON_GROUP || '').trim().toUpperCase() : '';

    if (statusHari === 'L' || statusHari === 'LIBUR') {
      key = 'L';
    } else if (r.REASON && reasonGroup) {
      if (['C', 'CUTI'].includes(reasonGroup)) key = 'C';
      else if (['S', 'SAKIT'].includes(reasonGroup)) key = 'S';
      else if (['A', 'ALPHA'].includes(reasonGroup)) key = 'A';
      else if (['I', 'IJIN'].includes(reasonGroup)) key = 'I';
    }

    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="animate-fadeIn">
      <AbsensiFilterBar
        searchEmp={searchEmp}
        setSearchEmp={setSearchEmp}
        selectedEmp={selectedEmp}
        setSelectedEmp={k => {
          setSelectedEmp(k);
          setCorrections(new Map());
        }}
        filteredKaryawan={filteredKaryawan}
        bulan={bulan}
        setBulan={setBulan}
        tahun={tahun}
        setTahun={setTahun}
        months={Array.from({ length: 12 }, (_, i) => i + 1)}
        years={[2024, 2025, 2026]}
        loaded={loaded}
        syncLoading={syncLoading}
        isSecurity={isSecurityEmployee(selectedEmp)}
        onSyncModalOpen={openSyncModal}
        onSyncShiftPreview={handleSyncShiftPreview}
        onLoadAbsensi={() => selectedEmp && loadAbsensi(selectedEmp.EMP_CD, bulan, tahun)}
        onClearEmp={() => {
          setSelectedEmp(null);
          setSearchEmp('');
          setRecords([]);
          setLoaded(false);
          setCorrections(new Map());
        }}
        lang={lang}
      />

      {loaded && records.length > 0 && (
        <>
          <AbsensiRekapCards
            rekap={rekap}
            records={records}
            masterReasons={masterReasons}
            lang={lang}
          />
          <AbsensiMonthlyTable
            records={records}
            corrections={corrections}
            setCorrections={setCorrections}
            masterReasons={masterReasons}
            masterShifts={masterShifts}
            onApply={handleApplyCorrection}
            onApplyAll={handleApplyAllCorrections}
            lang={lang}
            user={user}
          />
        </>
      )}

      {loaded && records.length === 0 && (
        <div className="glass-card">
          <EmptyState
            icon="document"
            title={lang === 'id' ? 'Tidak Ada Data' : 'No Data Found'}
            description={lang === 'id' ? 'Tidak ada data absensi untuk periode ini.' : 'No attendance data for this period.'}
          />
        </div>
      )}

      {!selectedEmp && !loaded && (
        <div className="glass-card">
          <EmptyState
            icon="search"
            title={lang === 'id' ? 'Cari Karyawan' : 'Search Employee'}
            description={lang === 'id' ? 'Ketik NIK atau nama di kolom pencarian di atas untuk mulai melihat dan mengoreksi data absensi.' : 'Type employee ID or name in the search field above to view and correct attendance.'}
          />
        </div>
      )}

      {!loaded && selectedEmp && (
        <div className="glass-card">
          <DataTable>
            <thead>
              <tr>
                <th>Tanggal</th>
                <th>Status Hari</th>
                <th style={{ textAlign: 'center' }}>Shift</th>
                <th>Data Asli</th>
                <th>Data Koreksi</th>
                <th>Jam Kerja</th>
                <th>OT</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 8 }).map((_, i) => (
                <tr key={i}>
                  <td><Skeleton width={90} height={16} /></td>
                  <td><Skeleton width={60} height={20} style={{ borderRadius: '100px' }} /></td>
                  <td style={{ textAlign: 'center' }}><Skeleton width={30} height={20} style={{ margin: '0 auto', borderRadius: '100px' }} /></td>
                  <td><Skeleton width={120} height={14} /></td>
                  <td><Skeleton width={120} height={14} /></td>
                  <td><Skeleton width={50} height={14} /></td>
                  <td><Skeleton width={40} height={14} /></td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </div>
      )}

      <AbsensiSyncModal
        isOpen={syncModalOpen}
        onClose={() => setSyncModalOpen(false)}
        startDate={syncStartDate}
        setStartDate={setSyncStartDate}
        endDate={syncEndDate}
        setEndDate={setSyncEndDate}
        loading={syncLoading}
        progress={syncProgress}
        message={syncMessage}
        onStartSync={handleSyncDataSolution}
        lang={lang}
      />

      <AbsensiShiftModal
        isOpen={syncShiftModal}
        onClose={() => setSyncShiftModal(false)}
        loading={syncShiftLoading}
        data={syncShiftData}
        onApply={handleSyncShiftApply}
        lang={lang}
      />
    </div>
  );
}

export default function AbsensiPage() {
  return (
    <Suspense fallback={<div className="loading-overlay"><div className="spinner" /></div>}>
      <AbsensiContent />
    </Suspense>
  );
}
