'use client';
import { use, useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/lib/context';
import { t } from '@/lib/i18n';
import {
  ArrowLeft, Edit2, ClipboardList, User, Building2, Briefcase,
  Phone, CreditCard, Calendar, MapPin, Users, BadgeInfo, Hash,
  Loader2, ImageIcon, Eye, EyeOff, Landmark
} from 'lucide-react';
import styles from './detail.module.css';
import editStyles from './edit/edit.module.css';
import type { Karyawan } from '@/types';
import IDCardModal from '@/components/karyawan/IDCardModal';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';

export default function KaryawanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { settings } = useApp();
  const lang = settings.language;
  const [karyawan, setKaryawan] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showIDCard, setShowIDCard] = useState(false);
  const [showSalary, setShowSalary] = useState(false);
  const [activeTab, setActiveTab] = useState<'pekerjaan' | 'pribadi' | 'bank'>('pekerjaan');

  const tabs = [
    { key: 'pekerjaan', icon: <Briefcase size={16} />, label: lang === 'id' ? 'Data Pekerjaan' : 'Employment' },
    { key: 'pribadi', icon: <User size={16} />, label: lang === 'id' ? 'Data Pribadi' : 'Personal' },
    { key: 'bank', icon: <Landmark size={16} />, label: lang === 'id' ? 'Bank & Keuangan' : 'Bank & Finance' },
  ];

  useEffect(() => {
    fetch(`/api/karyawan/${id}`)
      .then(res => res.json())
      .then(data => {
        if (!data.error) {
          setKaryawan(data);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return (
      <div className="animate-fadeIn">
         <div className="page-header">
           <Skeleton width={80} height={32} />
         </div>
         
         <Skeleton width="100%" height={200} style={{ borderRadius: 'var(--radius-xl)', marginBottom: '24px' }} />
         
         <div className="glass-card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '32px' }}>
              <Skeleton width={120} height={40} />
              <Skeleton width={120} height={40} />
              <Skeleton width={120} height={40} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '24px' }}>
               {Array.from({ length: 6 }).map((_, i) => (
                 <div key={i}>
                   <Skeleton width={100} height={14} style={{ marginBottom: '8px' }} />
                   <Skeleton width="100%" height={40} />
                 </div>
               ))}
            </div>
         </div>
      </div>
    );
  }

  if (!karyawan) {
    return (
      <div className="animate-fadeIn">
        <div className="page-header">
          <button className="btn btn-secondary" onClick={() => router.back()}>
            <ArrowLeft size={15} /> {lang === 'id' ? 'Kembali' : 'Back'}
          </button>
        </div>
        <div className="glass-card">
          <EmptyState 
            icon="user"
            title={lang === 'id' ? 'Karyawan Tidak Ditemukan' : 'Employee Not Found'}
            description={lang === 'id' ? `Data karyawan dengan NIK ${id} tidak ditemukan dalam sistem atau telah dinonaktifkan.` : `Employee with ID ${id} was not found in the system or has been deactivated.`}
          />
        </div>
      </div>
    );
  }

  const InfoRow = ({ icon, label, value, mono = false }: { icon: React.ReactNode; label: string; value: string | null | undefined; mono?: boolean }) => (
    <div className={styles.infoRow}>
      <div className={styles.infoIcon}>{icon}</div>
      <div className={styles.infoContent}>
        <div className={styles.infoLabel}>{label}</div>
        <div className={styles.infoValue} style={mono ? { fontFamily: 'monospace', fontSize: '13px' } : {}}>
          {value || <span style={{ color: 'var(--text-muted)' }}>—</span>}
        </div>
      </div>
    </div>
  );

  return (
    <div className="animate-fadeIn">
      {/* Header */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button className="btn btn-secondary btn-icon" onClick={() => router.back()}>
            <ArrowLeft size={15} />
          </button>
          <div>
            <h1 className="page-title">{t(lang, 'detailKaryawan')}</h1>
            <p className="page-subtitle">{karyawan.EMP_CD}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-secondary" onClick={() => router.push(`/absensi?emp=${karyawan.EMP_CD}`)}>
            <ClipboardList size={14} /> {t(lang, 'absensi')}
          </button>
          <button className="btn btn-primary" onClick={() => router.push(`/karyawan/${karyawan.EMP_CD}/edit`)}>
            <Edit2 size={14} /> {t(lang, 'edit')}
          </button>
        </div>
      </div>

      {/* Profile Hero */}
      <div className={styles.profileHero}>
        <div className={styles.profileHeroBg} />
        <div className={styles.heroAvatar}>
          {karyawan.EMP_NM?.charAt(0)}
        </div>
        <div className={styles.heroInfo}>
          <h2 className={styles.heroName}>{karyawan.EMP_NM}</h2>
          <div className={styles.heroMeta}>
            <span className="badge badge-info" style={{ fontSize: '12px' }}>{karyawan.EMP_CD}</span>
            <span className={`badge ${karyawan.Act_NonAct ? 'badge-success' : 'badge-danger'}`}>
              {karyawan.Act_NonAct ? t(lang, 'aktif') : t(lang, 'tidakAktif')}
            </span>
            {karyawan.JNS_DESC && <span className="badge badge-purple">{karyawan.JNS_DESC}</span>}
            <span className="badge badge-gray">{karyawan.SX === 'L' ? (lang === 'id' ? '♂ Laki-laki' : '♂ Male') : (lang === 'id' ? '♀ Perempuan' : '♀ Female')}</span>
          </div>
          <div className={styles.heroSub}>
            {['1', 'Y', 'TRUE'].includes(String(karyawan.ALL_IN).toUpperCase()) ? 'ALL IN' : 'HARIAN'} · {karyawan.TEAM || karyawan.JOB_DESC || karyawan.JOB_CD} · {karyawan.SEC_DESC || karyawan.SEC_CD}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className={editStyles.tabsContainer}>
        {tabs.map(t => (
          <button key={t.key} className={`${editStyles.tab} ${activeTab === t.key ? editStyles.activeTab : ''}`} onClick={() => setActiveTab(t.key as any)}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Info Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '20px' }}>
        <div>
          {/* Data Pekerjaan */}
          {activeTab === 'pekerjaan' && (
        <div className="glass-card" style={{ padding: '24px' }}>
          <div className={styles.sectionHeader}>
            <Briefcase size={18} color="var(--accent-blue)" />
            <h3>{lang === 'id' ? 'Data Pekerjaan' : 'Employment Data'}</h3>
          </div>
          <div className={styles.infoList}>
            <InfoRow icon={<Hash size={14} />} label={t(lang, 'nik')} value={karyawan.EMP_CD} mono />
            <InfoRow icon={<Building2 size={14} />} label={t(lang, 'departemen')} value={karyawan.DEP_DESC || karyawan.DEP_CD} />
            <InfoRow icon={<Building2 size={14} />} label={t(lang, 'bagian')} value={karyawan.SEC_DESC || karyawan.SEC_CD} />
            <InfoRow icon={<Briefcase size={14} />} label={t(lang, 'jabatan')} value={karyawan.TEAM || karyawan.JOB_DESC || karyawan.JOB_CD} />
            <InfoRow icon={<Users size={14} />} label={t(lang, 'jenisKaryawan')} value={karyawan.JNS_DESC || karyawan.JNS_KRY} />
            <InfoRow icon={<Calendar size={14} />} label={t(lang, 'tanggalMasuk')} value={karyawan.DT_ENTRY ? new Date(karyawan.DT_ENTRY).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }) : null} />
            {karyawan.DT_RSG && (
              <InfoRow icon={<Calendar size={14} />} label={lang === 'id' ? 'Tanggal Resign' : 'Resignation Date'} value={new Date(karyawan.DT_RSG).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })} />
            )}
            <InfoRow icon={<BadgeInfo size={14} />} label={lang === 'id' ? 'No. SPSI' : 'SPSI No.' } value={karyawan.SPSI_NO} mono />
            <InfoRow icon={<BadgeInfo size={14} />} label={lang === 'id' ? 'No. Reg' : 'Reg No.'} value={karyawan.No_Reg} mono />
            <InfoRow icon={<BadgeInfo size={14} />} label="Flag OT" value={karyawan.FLAG_OT === '1' ? (lang === 'id' ? 'Berhak Lembur' : 'OT Eligible') : (lang === 'id' ? 'Tidak Lembur' : 'No OT')} />
            <InfoRow icon={<BadgeInfo size={14} />} label="ALL IN" value={karyawan.ALL_IN === '1' ? 'Ya / Yes' : 'Tidak / No'} />
          </div>
        </div>
          )}

          {/* Data Pribadi */}
          {activeTab === 'pribadi' && (
            <div className="glass-card" style={{ padding: '24px' }}>
          <div className={styles.sectionHeader}>
            <User size={18} color="var(--accent-purple)" />
            <h3>{lang === 'id' ? 'Data Pribadi' : 'Personal Data'}</h3>
          </div>
          <div className={styles.infoList}>
            <InfoRow icon={<Calendar size={14} />} label={t(lang, 'tanggalLahir')} value={karyawan.DT_BRT ? new Date(karyawan.DT_BRT).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }) : null} />
            <InfoRow icon={<MapPin size={14} />} label={t(lang, 'tempatLahir')} value={karyawan.PLC_BRT} />
            <InfoRow icon={<MapPin size={14} />} label={t(lang, 'alamat')} value={karyawan.ADRR} />
            <InfoRow icon={<MapPin size={14} />} label={t(lang, 'kota')} value={karyawan.CT} />
            <InfoRow icon={<BadgeInfo size={14} />} label={t(lang, 'agama')} value={karyawan.agama} />
            <InfoRow icon={<CreditCard size={14} />} label={t(lang, 'noKTP')} value={karyawan.noktp} mono />
            <InfoRow icon={<Phone size={14} />} label={t(lang, 'noHP')} value={karyawan.telepon} mono />
            <InfoRow icon={<CreditCard size={14} />} label={t(lang, 'npwp')} value={karyawan.NPWP} mono />
            <InfoRow icon={<BadgeInfo size={14} />} label="PTKP" value={karyawan.PTKP_ST} />
          </div>
        </div>
          )}

          {/* Data Bank */}
          {activeTab === 'bank' && (
            <div className="glass-card" style={{ padding: '24px' }}>
          <div className={styles.sectionHeader}>
            <CreditCard size={18} color="var(--success)" />
            <h3>{lang === 'id' ? 'Data Bank & Keuangan' : 'Bank & Financial Data'}</h3>
          </div>
          <div className={styles.infoList}>
            <InfoRow icon={<CreditCard size={14} />} label={t(lang, 'noRek')} value={karyawan.ACC_NO} mono />
            <InfoRow icon={<CreditCard size={14} />} label={t(lang, 'npwp')} value={karyawan.NPWP} mono />
            <InfoRow icon={<BadgeInfo size={14} />} label="PTKP Status" value={karyawan.PTKP_ST} />
            <div className={styles.infoRow}>
              <div className={styles.infoIcon}><CreditCard size={14} /></div>
              <div className={styles.infoContent}>
                <div className={styles.infoLabel}>{lang === 'id' ? 'Gaji Pokok' : 'Basic Salary'}</div>
                <div className={styles.infoValue} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'monospace', fontSize: '13px' }}>
                  {showSalary ? (
                    karyawan.BS_SLR != null
                      ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(karyawan.BS_SLR)
                      : '-'
                  ) : (
                    <span style={{ letterSpacing: '2px', color: 'var(--text-muted)' }}>Rp ••••••••</span>
                  )}
                  <button 
                    onClick={() => setShowSalary(!showSalary)} 
                    style={{ padding: '2px', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                    title={showSalary ? (lang === 'id' ? 'Sembunyikan' : 'Hide') : (lang === 'id' ? 'Tampilkan' : 'Show')}
                  >
                    {showSalary ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
            </div>
          </div>
            </div>
          )}
        </div>

        <div>
          {/* Aksi Cepat */}
          <div className="glass-card" style={{ padding: '24px' }}>
          <div className={styles.sectionHeader}>
            <BadgeInfo size={18} color="var(--warning)" />
            <h3>{lang === 'id' ? 'Aksi Cepat' : 'Quick Actions'}</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px' }}>
            <button className="btn btn-secondary w-full" onClick={() => router.push(`/absensi?emp=${karyawan.EMP_CD}`)}>
              <ClipboardList size={14} /> {lang === 'id' ? 'Lihat Absensi Bulan Ini' : 'View This Month Attendance'}
            </button>
            <button className="btn btn-secondary w-full" onClick={() => router.push(`/lembur`)}>
              <BadgeInfo size={14} /> {lang === 'id' ? 'Input Lembur' : 'Input Overtime'}
            </button>
            <button className="btn btn-primary w-full" onClick={() => router.push(`/karyawan/${karyawan.EMP_CD}/edit`)}>
              <Edit2 size={14} /> {lang === 'id' ? 'Edit Data Karyawan' : 'Edit Employee Data'}
            </button>
            <button className="btn btn-secondary w-full" style={{ backgroundColor: 'var(--accent-blue)', color: 'white', borderColor: 'var(--accent-blue)' }} onClick={() => setShowIDCard(true)}>
              <ImageIcon size={14} /> {lang === 'id' ? 'Generate ID Card' : 'Generate ID Card'}
            </button>
          </div>
        </div>
      </div>
      </div>
      
      {showIDCard && (
        <IDCardModal karyawan={karyawan} onClose={() => setShowIDCard(false)} />
      )}
    </div>
  );
}
