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
          <p className="page-subtitle">{lang === 'id' ? 'Konfigurasi aplikasi HRIS Widy' : 'HRIS Widy application configuration'}</p>
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
              <span className="badge badge-info" style={{ marginTop: '4px', fontSize: '10px' }}>Group: {user?.Gr_Id || '—'}</span>
            </div>
          </div>
        </div>

        {/* Database Info */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <Database size={20} color="var(--success)" />
            <h3>{lang === 'id' ? 'Koneksi Database' : 'Database Connection'}</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[
              { label: lang === 'id' ? 'Mode Saat Ini' : 'Current Mode', value: lang === 'id' ? '🟡 Data Lokal (Mock)' : '🟡 Local Data (Mock)' },
              { label: 'Server', value: '192.168.0.4 (belum aktif)' },
              { label: 'Database', value: 'PayrollSys' },
              { label: lang === 'id' ? 'Shadow DB' : 'Shadow DB', value: 'HRIS_Baru_Test' },
              { label: lang === 'id' ? 'Mode Tulis' : 'Write Mode', value: lang === 'id' ? 'Shadow DB (tidak aktif)' : 'Shadow DB (inactive)' },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius-sm)', fontSize: '13px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>{item.label}</span>
                <span style={{ fontFamily: 'monospace' }}>{item.value}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: '12px', padding: '10px 14px', background: 'rgba(245,158,11,0.08)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(245,158,11,0.2)', fontSize: '12px', color: 'var(--warning)' }}>
            ⚠ {lang === 'id' ? 'Untuk mengaktifkan koneksi DB server, ubah DATA_MODE=live di .env.local' : 'To enable DB server connection, set DATA_MODE=live in .env.local'}
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
              { label: 'Nama Aplikasi', value: 'HRIS Widy' },
              { label: 'Versi', value: '2.0.0-shadow' },
              { label: 'Framework', value: 'Next.js 14 (App Router)' },
              { label: 'Database', value: 'Microsoft SQL Server' },
              { label: lang === 'id' ? 'Status Pengembangan' : 'Development Status', value: 'Shadow Mode (Fase Uji Coba)' },
              { label: lang === 'id' ? 'Terakhir Update' : 'Last Update', value: new Date().toLocaleDateString('id-ID') },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius-sm)', fontSize: '13px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>{item.label}</span>
                <span style={{ fontWeight: 500 }}>{item.value}</span>
              </div>
            ))}
          </div>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '12px', lineHeight: 1.6 }}>
            {lang === 'id'
              ? 'Sistem HRIS baru ini berjalan dalam Shadow Mode — hanya membaca data dari PayrollSys. Semua perubahan tersimpan di database terpisah selama fase uji coba.'
              : 'This new HRIS system runs in Shadow Mode — read-only from PayrollSys. All changes are saved to a separate database during the trial phase.'}
          </p>
        </div>
      </div>
    </div>
  );
}
