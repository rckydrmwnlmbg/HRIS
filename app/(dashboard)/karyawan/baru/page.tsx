'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/lib/context';
import { t } from '@/lib/i18n';
import type { Karyawan, Department, Seksi, Jabatan, Divisi, JenisKaryawan } from '@/types';
import { ArrowLeft, Save, CheckCircle, Loader2, Briefcase, User, Landmark } from 'lucide-react';
import styles from '../[id]/edit/edit.module.css';

export default function KaryawanBaruPage() {
  const router = useRouter();
  const { settings } = useApp();
  const lang = settings.language;

  const [form, setForm] = useState<Partial<Karyawan>>({
    Act_NonAct: true,
    FLAG_OT: '0',
    ALL_IN: '0',
    SX: 'L',
    agama: 'ISLAM',
    PTKP_ST: 'TK/0'
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<'pekerjaan' | 'pribadi' | 'bank'>('pekerjaan');
  const [loading, setLoading] = useState(true);

  // Master data
  const [masterDep, setMasterDep] = useState<Department[]>([]);
  const [masterSec, setMasterSec] = useState<Seksi[]>([]);
  const [masterJob, setMasterJob] = useState<Jabatan[]>([]);
  const [masterDiv, setMasterDiv] = useState<Divisi[]>([]);
  const [masterJns, setMasterJns] = useState<JenisKaryawan[]>([]);

  useEffect(() => {
    fetch('/api/master')
      .then(r => r.json())
      .then(masterData => {
        setMasterDep(masterData.departemen || []);
        setMasterSec(masterData.seksi || []);
        setMasterJob(masterData.jabatan || []);
        setMasterDiv(masterData.divisi || []);
        setMasterJns(masterData.jenisKaryawan || []);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  const set = (field: keyof Karyawan, value: string | boolean | null) => {
    setForm(p => ({ ...p, [field]: value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.EMP_CD || !form.EMP_NM) {
      alert(lang === 'id' ? 'NIK dan Nama wajib diisi' : 'ID and Name are required');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/karyawan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => {
          setSaved(false);
          router.push(`/karyawan/${form.EMP_CD}`);
        }, 1500);
      } else {
        const err = await res.json();
        alert((lang === 'id' ? 'Gagal menyimpan: ' : 'Failed to save: ') + (err.error || (lang === 'id' ? 'Terjadi kendala' : 'An error occurred')));
      }
    } catch (err) {
      console.error(err);
    }
    setSaving(false);
  };

  const seksiForDep = masterSec.filter(s => !form.DEP_CD || s.GRP_CD === form.DEP_CD);

  const tabs = [
    { key: 'pekerjaan', icon: <Briefcase size={16} />, label: lang === 'id' ? 'Data Pekerjaan' : 'Employment' },
    { key: 'pribadi', icon: <User size={16} />, label: lang === 'id' ? 'Data Pribadi' : 'Personal' },
    { key: 'bank', icon: <Landmark size={16} />, label: lang === 'id' ? 'Bank & Keuangan' : 'Bank & Finance' },
  ];

  if (loading) {
    return (
       <div className="animate-fadeIn">
         <div className="page-header">
           <button className="btn btn-secondary" onClick={() => router.back()}>
             <ArrowLeft size={15} /> {lang === 'id' ? 'Kembali' : 'Back'}
           </button>
         </div>
         <div className="glass-card" style={{ padding: '60px', textAlign: 'center' }}>
            <Loader2 className="spin" size={32} style={{ margin: '0 auto 16px', opacity: 0.5 }} />
            <div>{lang === 'id' ? 'Memuat form...' : 'Loading form...'}</div>
         </div>
       </div>
    );
  }

  return (
    <div className="animate-fadeIn">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button className="btn btn-secondary btn-icon" onClick={() => router.back()}>
            <ArrowLeft size={15} />
          </button>
          <div>
            <h1 className="page-title">{lang === 'id' ? 'Karyawan Baru' : 'New Employee'}</h1>
            <p className="page-subtitle">{lang === 'id' ? 'Pendaftaran data karyawan baru ke sistem' : 'Register new employee into the system'}</p>
          </div>
        </div>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? <><Loader2 size={16} className="spin" /> {lang === 'id' ? 'Menyimpan...' : 'Saving...'}</> : <><Save size={15} /> {t(lang, 'simpan')}</>}
        </button>
      </div>

      <div className={styles.tabsContainer}>
        {tabs.map(t => (
          <button key={t.key} className={`${styles.tab} ${activeTab === t.key ? styles.activeTab : ''}`} onClick={() => setActiveTab(t.key as any)}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      <div className="glass-card" style={{ padding: '24px' }}>
        <form id="addForm" onSubmit={handleSave}>
          {activeTab === 'pekerjaan' && (
            <div className={styles.formGrid}>
              <div className="form-group">
                <label className="form-label">{t(lang, 'nik')} *</label>
                <input className="form-input" value={form.EMP_CD || ''} onChange={e => set('EMP_CD', e.target.value)} required placeholder="Mis: 02140134" />
              </div>
              <div className="form-group">
                <label className="form-label">{t(lang, 'nama')} *</label>
                <input className="form-input" value={form.EMP_NM || ''} onChange={e => set('EMP_NM', e.target.value)} required />
              </div>

              <div className="form-group">
                <label className="form-label">{t(lang, 'departemen')}</label>
                <select className="form-select" value={form.DEP_CD || ''} onChange={e => { set('DEP_CD', e.target.value); set('SEC_CD', ''); }}>
                  <option value="">-- Pilih --</option>
                  {masterDep.map(d => <option key={d.DEP_CD} value={d.DEP_CD}>{d.DEP_DESC}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">{t(lang, 'bagian')}</label>
                <select className="form-select" value={form.SEC_CD || ''} onChange={e => set('SEC_CD', e.target.value)}>
                  <option value="">-- Pilih --</option>
                  {seksiForDep.map(s => <option key={s.SEC_CD} value={s.SEC_CD}>{s.SEC_DESC}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">{t(lang, 'jabatan')}</label>
                <select className="form-select" value={form.JOB_CD || ''} onChange={e => set('JOB_CD', e.target.value)}>
                  <option value="">-- {lang === 'id' ? 'Pilih' : 'Select'} --</option>
                  {masterJob.map(j => <option key={j.JOB_CD} value={j.JOB_CD}>{j.JOB_DESC}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">{lang === 'id' ? 'Divisi' : 'Division'}</label>
                <select className="form-select" value={form.DIV_CD || ''} onChange={e => set('DIV_CD', e.target.value)}>
                  <option value="">-- {lang === 'id' ? 'Pilih' : 'Select'} --</option>
                  {masterDiv.map(d => <option key={d.DIV_CD} value={d.DIV_CD}>{d.DIV_DESC}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">{t(lang, 'jenisKaryawan')}</label>
                <select className="form-select" value={form.JNS_KRY || ''} onChange={e => set('JNS_KRY', e.target.value)}>
                  <option value="">-- {lang === 'id' ? 'Pilih' : 'Select'} --</option>
                  {masterJns.map(j => <option key={j.JNS_CODE} value={j.JNS_CODE}>{j.JNS_DESC}</option>)}
                </select>
              </div>
              
              <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '28px' }}>
                <input type="checkbox" id="Act_NonAct" checked={!!form.Act_NonAct} onChange={e => set('Act_NonAct', e.target.checked)} style={{ width: 16, height: 16 }} />
                <label htmlFor="Act_NonAct" style={{ cursor: 'pointer', fontWeight: 500 }}>{lang === 'id' ? 'Karyawan Aktif' : 'Active Employee'}</label>
              </div>

              <div className="form-group">
                <label className="form-label">{t(lang, 'tanggalMasuk')}</label>
                <input type="date" className="form-input" value={form.DT_ENTRY || ''} onChange={e => set('DT_ENTRY', e.target.value)} />
              </div>

              <div className="form-group">
                <label className="form-label">{lang === 'id' ? 'Hak Lembur' : 'Overtime Eligibility'}</label>
                <select className="form-select" value={form.FLAG_OT || '0'} onChange={e => set('FLAG_OT', e.target.value)}>
                  <option value="0">0 - {lang === 'id' ? 'Tidak Lembur' : 'No OT'}</option>
                  <option value="1">1 - {lang === 'id' ? 'Berhak Lembur' : 'OT Eligible'}</option>
                </select>
              </div>
              
              <div className="form-group">
                <label className="form-label">{lang === 'id' ? 'Paket Lembur (ALL IN)' : 'Overtime Package (ALL IN)'}</label>
                <select className="form-select" value={form.ALL_IN || '0'} onChange={e => set('ALL_IN', e.target.value)}>
                  <option value="0">0 - {lang === 'id' ? 'Reguler (Non-ALL IN)' : 'Regular (Non-ALL IN)'}</option>
                  <option value="1">1 - {lang === 'id' ? 'Paket ALL IN' : 'ALL IN Package'}</option>
                </select>
              </div>
            </div>
          )}

          {activeTab === 'pribadi' && (
            <div className={styles.formGrid}>
              <div className="form-group">
                <label className="form-label">{t(lang, 'tempatLahir')}</label>
                <input className="form-input" value={form.PLC_BRT || ''} onChange={e => set('PLC_BRT', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">{t(lang, 'tanggalLahir')}</label>
                <input type="date" className="form-input" value={form.DT_BRT || ''} onChange={e => set('DT_BRT', e.target.value)} />
              </div>

              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">{t(lang, 'alamat')}</label>
                <textarea className="form-textarea" rows={2} value={form.ADRR || ''} onChange={e => set('ADRR', e.target.value)} />
              </div>

              <div className="form-group">
                <label className="form-label">{t(lang, 'kota')}</label>
                <input className="form-input" value={form.CT || ''} onChange={e => set('CT', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">{lang === 'id' ? 'Jenis Kelamin' : 'Gender'}</label>
                <select className="form-select" value={form.SX || ''} onChange={e => set('SX', e.target.value)}>
                  <option value="">-- Pilih --</option>
                  <option value="L">{lang === 'id' ? 'Laki-laki' : 'Male'}</option>
                  <option value="P">{lang === 'id' ? 'Perempuan' : 'Female'}</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">{t(lang, 'agama')}</label>
                <select className="form-select" value={form.agama || ''} onChange={e => set('agama', e.target.value)}>
                  <option value="">-- Pilih --</option>
                  <option value="ISLAM">Islam</option>
                  <option value="KRISTEN">Kristen</option>
                  <option value="KATHOLIK">Katholik</option>
                  <option value="HINDU">Hindu</option>
                  <option value="BUDHA">Budha</option>
                  <option value="KONGHUCU">Konghucu</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">{t(lang, 'noHP')}</label>
                <input className="form-input" value={form.telepon || ''} onChange={e => set('telepon', e.target.value)} />
              </div>
            </div>
          )}

          {activeTab === 'bank' && (
            <div className={styles.formGrid}>
              <div className="form-group">
                <label className="form-label">{t(lang, 'noKTP')}</label>
                <input className="form-input" value={form.noktp || ''} onChange={e => set('noktp', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">{t(lang, 'npwp')}</label>
                <input className="form-input" value={form.NPWP || ''} onChange={e => set('NPWP', e.target.value)} />
              </div>

              <div className="form-group">
                <label className="form-label">{t(lang, 'noRek')}</label>
                <input className="form-input" value={form.ACC_NO || ''} onChange={e => set('ACC_NO', e.target.value)} placeholder={lang === 'id' ? 'Contoh: BCA 1234567890' : 'Example: BCA 1234567890'} />
              </div>
              <div className="form-group">
                <label className="form-label">{lang === 'id' ? 'Status PTKP' : 'Tax Status (PTKP)'}</label>
                <select className="form-select" value={form.PTKP_ST || ''} onChange={e => set('PTKP_ST', e.target.value)}>
                  <option value="">-- {lang === 'id' ? 'Pilih' : 'Select'} --</option>
                  <option value="TK/0">TK/0</option>
                  <option value="TK/1">TK/1</option>
                  <option value="TK/2">TK/2</option>
                  <option value="TK/3">TK/3</option>
                  <option value="K/0">K/0</option>
                  <option value="K/1">K/1</option>
                  <option value="K/2">K/2</option>
                  <option value="K/3">K/3</option>
                </select>
              </div>
            </div>
          )}
        </form>
      </div>

      {saved && (
        <div className="toast-container">
          <div className="toast toast-success">
            <CheckCircle size={16} /> {lang === 'id' ? 'Karyawan berhasil ditambahkan!' : 'Employee successfully added!'}
          </div>
        </div>
      )}
    </div>
  );
}
