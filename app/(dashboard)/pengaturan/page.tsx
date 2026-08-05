'use client';
import { useApp } from '@/lib/context';
import { t } from '@/lib/i18n';
import type { Language } from '@/lib/i18n';
import { Globe, Moon, User, Database, Info } from 'lucide-react';

export default function PengaturanPage() {
  const { settings, setLanguage, user } = useApp();
  const lang = settings.language;

  return (
    <div className="animate-fadeIn">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t(lang, 'pengaturan')}</h1>
          <p className="page-subtitle">{lang === 'id' ? 'Preferensi dan konfigurasi sistem' : 'System preferences and configuration'}</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {/* Language */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <Globe size={20} color="var(--accent-blue)" />
            <h3>{t(lang, 'bahasaAplikasi')}</h3>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            {(['id', 'en'] as Language[]).map(l => (
              <button
                key={l}
                className={`btn ${lang === l ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setLanguage(l)}
                style={{ flex: 1 }}
              >
                {l === 'id' ? 'Indonesia' : 'English'}
              </button>
            ))}
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '10px' }}>
            {lang === 'id' ? 'Bahasa akan diterapkan ke seluruh halaman aplikasi.' : 'Language will be applied to all pages.'}
          </p>
        </div>

        {/* Profile */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <User size={20} color="var(--accent-purple)" />
            <h3>{t(lang, 'profilPengguna')}</h3>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px', background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'linear-gradient(135deg,var(--accent-blue),var(--accent-purple))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: 800, color: '#fff' }}>
              {user?.nama?.charAt(0) || 'U'}
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '15px' }}>{user?.nama || '—'}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{user?.role || '—'} · {user?.username || '—'}</div>
              <span className="badge badge-info" style={{ marginTop: '4px', fontSize: '10px' }}>{lang === 'id' ? 'Akses' : 'Access'}: {user?.Gr_Id || '—'}</span>
            </div>
          </div>
        </div>

        {/* Database Info */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <Database size={20} color="var(--success)" />
            <h3>{lang === 'id' ? 'Status Koneksi Server' : 'Server Connection Status'}</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[
              { label: lang === 'id' ? 'Mode Saat Ini' : 'Current Mode', value: lang === 'id' ? '🟡 Lingkungan Pengembangan' : '🟡 Development Environment' },
              { label: lang === 'id' ? 'Server' : 'Server', value: lang === 'id' ? '192.168.0.4 (belum terhubung)' : '192.168.0.4 (not connected)' },
              { label: lang === 'id' ? 'Basis Data Utama' : 'Primary Database', value: 'PayrollSys' },
              { label: lang === 'id' ? 'Basis Data Uji Coba' : 'Trial Database', value: 'HRIS_Baru_Test' },
              { label: lang === 'id' ? 'Mode Penulisan' : 'Write Mode', value: lang === 'id' ? 'Uji Coba (belum aktif)' : 'Trial (inactive)' },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius-sm)', fontSize: '13px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>{item.label}</span>
                <span style={{ fontWeight: 500 }}>{item.value}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: '12px', padding: '10px 14px', background: 'rgba(245,158,11,0.08)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(245,158,11,0.2)', fontSize: '12px', color: 'var(--warning)' }}>
            ℹ {lang === 'id' ? 'Koneksi ke server pusat akan diaktifkan setelah fase uji coba selesai.' : 'Central server connection will be activated after the trial phase.'}
          </div>
        </div>

        {/* App Info */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <Info size={20} color="var(--accent-cyan)" />
            <h3>{lang === 'id' ? 'Informasi Aplikasi' : 'Application Info'}</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[
              { label: lang === 'id' ? 'Nama Aplikasi' : 'Application Name', value: 'HRIS TMNB' },
              { label: lang === 'id' ? 'Versi' : 'Version', value: '2.0.0' },
              { label: lang === 'id' ? 'Teknologi' : 'Framework', value: 'Next.js 14' },
              { label: lang === 'id' ? 'Penyimpanan Data' : 'Data Storage', value: 'Microsoft SQL Server' },
              { label: lang === 'id' ? 'Tahapan Saat Ini' : 'Current Phase', value: lang === 'id' ? 'Fase Uji Coba' : 'Trial Phase' },
              { label: lang === 'id' ? 'Pembaruan Terakhir' : 'Last Updated', value: new Date().toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-US') },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius-sm)', fontSize: '13px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>{item.label}</span>
                <span style={{ fontWeight: 500 }}>{item.value}</span>
              </div>
            ))}
          </div>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '12px', lineHeight: 1.6 }}>
            {lang === 'id'
              ? 'Sistem HRIS ini saat ini beroperasi dalam mode uji coba — data kehadiran utama tetap terlindungi. Seluruh penyesuaian yang dilakukan disimpan pada lingkungan terpisah sampai sistem siap dipindahkan ke lingkungan operasional.'
              : 'This HRIS system currently operates in trial mode — core attendance data remains protected. All adjustments are saved to a separate environment until the system is ready for production.'}
          </p>
        </div>
      </div>
    </div>
  );
}
