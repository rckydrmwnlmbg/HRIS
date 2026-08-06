'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/lib/context';
import { t } from '@/lib/i18n';
import { User, Lock, Eye, EyeOff, Shield } from 'lucide-react';
import styles from './login.module.css';

// Daftar pengguna sistem
const MOCK_USERS = [
  { id: '1', username: 'widy', password: 'Widy123', nama: 'Widya Etika', role: 'HR', Gr_Id: 'ADMIN' },
  { id: '2', username: 'hr01', password: 'hr2024', nama: 'Staf HRD', role: 'HR Staff', Gr_Id: 'HR' },
  { id: '3', username: 'spv01', password: 'spv2024', nama: 'Supervisor Produksi', role: 'Supervisor', Gr_Id: 'SPV' },
];

export default function LoginPage() {
  const { setUser, settings } = useApp();
  const lang = settings.language;
  const router = useRouter();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    await new Promise(r => setTimeout(r, 800));

    const user = MOCK_USERS.find(u => u.username === username && u.password === password);
    if (user) {
      setUser({ id: user.id, username: user.username, nama: user.nama, role: user.role, Gr_Id: user.Gr_Id });
      router.push('/dashboard');
    } else {
      setError(t(lang, 'loginError'));
    }
    setLoading(false);
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        {/* Logo / Brand */}
        <div className={styles.brand}>
          <div className={styles.logoIcon}>
            <Shield size={28} strokeWidth={1.5} />
          </div>
          <div>
            <h1 className={styles.title}>{t(lang, 'loginTitle')}</h1>
            <p className={styles.subtitle}>{t(lang, 'loginSubtitle')}</p>
          </div>
        </div>

        <div className={styles.divider} />

        <form onSubmit={handleLogin} className={styles.form}>
          <div className="form-group">
            <label className="form-label">{t(lang, 'username')}</label>
            <div className="search-wrapper">
              <User size={15} className="search-icon" />
              <input
                type="text"
                className="form-input"
                placeholder={lang === 'id' ? 'Masukkan nama pengguna' : 'Enter your username'}
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
                autoFocus
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">{t(lang, 'password')}</label>
            <div className="search-wrapper">
              <Lock size={15} className="search-icon" />
              <input
                type={showPass ? 'text' : 'password'}
                className="form-input"
                style={{ paddingRight: '40px' }}
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}
              >
                {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          <div style={{ minHeight: '32px', display: 'flex', alignItems: 'center' }}>
            {error && (
              <div className={styles.error} style={{ width: '100%', margin: 0 }}>
                <span>⚠️ {error}</span>
              </div>
            )}
          </div>

          <button type="submit" className="btn btn-primary w-full btn-lg" disabled={loading}>
            {loading ? <><div className="spinner" /> {lang === 'id' ? 'Memverifikasi...' : 'Verifying...'}</> : t(lang, 'masuk')}
          </button>


        </form>
      </div>
    </div>
  );
}
