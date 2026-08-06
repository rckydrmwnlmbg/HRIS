'use client';
import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Upload, Loader2, Download, Image as ImageIcon } from 'lucide-react';
import { useApp } from '@/lib/context';
import { t } from '@/lib/i18n';

interface Props {
  karyawan: any;
  onClose: () => void;
}

export default function IDCardModal({ karyawan, onClose }: Props) {
  const { settings } = useApp();
  const lang = settings.language;
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resultImg, setResultImg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    // 1. Menutup dengan tombol ESC
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      setFile(selected);
      setPreview(URL.createObjectURL(selected));
      setResultImg(null);
      setError(null);
    }
  };

  const handleGenerate = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      // 1. Remove BG
      const formData = new FormData();
      formData.append('image_file', file);

      const removeBgRes = await fetch('/api/idcard/removebg', {
        method: 'POST',
        body: formData,
      });

      if (!removeBgRes.ok) {
        const err = await removeBgRes.json();
        throw new Error(err.details || 'Terjadi kendala saat memproses foto');
      }

      const noBgBlob = await removeBgRes.blob();
      const reader = new FileReader();

      reader.onloadend = async () => {
        const base64data = reader.result as string;

        // 2. Generate ID Card Composite
        const generateRes = await fetch('/api/idcard/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nama: karyawan.EMP_NM,
            nik: karyawan.EMP_CD,
            jabatan: karyawan.JOB_DESC || karyawan.JOB_CD || '',
            departemen: karyawan.DEP_DESC || karyawan.DEP_CD || '',
            fotoBase64: base64data,
          }),
        });

        if (!generateRes.ok) {
          const err = await generateRes.json();
          throw new Error(err.details || 'Terjadi kendala saat menyusun kartu identitas');
        }

        const finalBlob = await generateRes.blob();
        setResultImg(URL.createObjectURL(finalBlob));
        setLoading(false);
      };

      reader.readAsDataURL(noBgBlob);

    } catch (err: any) {
      console.error(err);
      setError(err.message);
      setLoading(false);
    }
  };

  if (!mounted) return null;

  return createPortal(
    <div className="liquid-glass-overlay" onClick={onClose} style={{ cursor: 'pointer' }}>
      {/* Hidden SVG Filter for Convex Lens Distortion */}
      <svg style={{ position: 'absolute', width: 0, height: 0 }} aria-hidden="true">
        <filter id="glass-distortion" x="0%" y="0%" width="100%" height="100%">
          {/* X Displacement Map (Magnify IN: Left edge pulls from right, right edge pulls from left) */}
          <feImage result="mapX" preserveAspectRatio="none" href="data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPScxMDAnIGhlaWdodD0nMTAwJz48bGluZWFyR3JhZGllbnQgaWQ9J2cnIHgxPScwJyB5MT0nMCcgeDI9JzEwMCUnIHkyPScwJz48c3RvcCBvZmZzZXQ9JzAnIHN0b3AtY29sb3I9JyNmZjAwMDAnLz48c3RvcCBvZmZzZXQ9JzE1JScgc3RvcC1jb2xvcj0nI2MwMDAwMCcvPjxzdG9wIG9mZnNldD0nODUlJyBzdG9wLWNvbG9yPScjNDAwMDAwJy8+PHN0b3Agb2Zmc2V0PScxMDAlJyBzdG9wLWNvbG9yPScjMDAwMDAwJy8+PC9saW5lYXJHcmFkaWVudD48cmVjdCB3aWR0aD0nMTAwJyBoZWlnaHQ9JzEwMCcgZmlsbD0ndXJsKCNnKScvPjwvc3ZnPg==" />

          {/* Y Displacement Map (Magnify IN: Top edge pulls from bottom, bottom edge pulls from top) */}
          <feImage result="mapY" preserveAspectRatio="none" href="data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPScxMDAnIGhlaWdodD0nMTAwJz48bGluZWFyR3JhZGllbnQgaWQ9J2cnIHgxPScwJyB5MT0nMCcgeDI9JzAnIHkyPScxMDAlJz48c3RvcCBvZmZzZXQ9JzAnIHN0b3AtY29sb3I9JyMwMGZmMDAnLz48c3RvcCBvZmZzZXQ9JzE1JScgc3RvcC1jb2xvcj0nIzAwYzAwMCcvPjxzdG9wIG9mZnNldD0nODUlJyBzdG9wLWNvbG9yPScjMDA0MDAwJy8+PHN0b3Agb2Zmc2V0PScxMDAlJyBzdG9wLWNvbG9yPScjMDAwMDAwJy8+PC9saW5lYXJHcmFkaWVudD48cmVjdCB3aWR0aD0nMTAwJyBoZWlnaHQ9JzEwMCcgZmlsbD0ndXJsKCNnKScvPjwvc3ZnPg==" />

          {/* Combine X and Y maps perfectly to form a convex lens normal map */}
          <feBlend mode="screen" in="mapX" in2="mapY" result="lensMap" />

          {/* Apply the lens displacement to the background */}
          <feDisplacementMap in="SourceGraphic" in2="lensMap" scale="50" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </svg>
      <div className="liquid-glass-modal" onClick={(e) => e.stopPropagation()} style={{ cursor: 'default' }}>
        <button onClick={onClose} className="liquid-glass-close" style={{ position: 'absolute', right: '12px', top: '12px', cursor: 'pointer', zIndex: 10 }}>
          <X size={16} />
        </button>

        <h2 className="liquid-glass-modal-title" style={{ marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px', zIndex: 10, position: 'relative', fontSize: '14.5px', fontWeight: 700 }}>
          <ImageIcon size={18} color="currentColor" />
          {lang === 'id' ? 'Generate ID Card' : 'Generate ID Card'}
        </h2>
        <p className="liquid-glass-modal-desc" style={{ marginBottom: '16px', zIndex: 10, position: 'relative', fontSize: '11.5px' }}>
          {lang === 'id' ? 'Unggah foto karyawan. Sistem akan otomatis menghapus latar belakang dan memasukkannya ke template.' : 'Upload employee photo. The system will automatically remove the background and place it into the template.'}
        </p>

        {error && (
          <div style={{ padding: '8px 12px', backgroundColor: 'var(--danger-light)', color: 'var(--danger)', borderRadius: 'var(--radius-sm)', marginBottom: '12px', fontSize: '11.5px', zIndex: 10, position: 'relative' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: '14px', flexDirection: 'column', zIndex: 10, position: 'relative' }}>

          {/* Upload Section */}
          {!resultImg && (
            <div
              style={{
                border: '1.5px dashed var(--border)', borderRadius: 'var(--radius-md)', padding: '20px',
                textAlign: 'center', cursor: 'pointer', backgroundColor: 'var(--bg-subtle)'
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" style={{ display: 'none' }} />
              {preview ? (
                <img src={preview} alt="Preview" style={{ maxWidth: '160px', maxHeight: '160px', borderRadius: 'var(--radius-sm)', margin: '0 auto' }} />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', color: 'var(--text-muted)' }}>
                  <Upload size={24} />
                  <span style={{ fontSize: '12px' }}>{lang === 'id' ? 'Klik untuk memilih foto (Pas Foto)' : 'Click to select photo (Portrait)'}</span>
                </div>
              )}
            </div>
          )}

          {/* Result Section */}
          {resultImg && (
            <div style={{ textAlign: 'center', backgroundColor: 'var(--bg-card)', padding: '16px', borderRadius: '12px' }}>
              <img src={resultImg} alt="ID Card Final" style={{ width: '100%', maxWidth: '300px', borderRadius: '12px', boxShadow: '0 8px 16px rgba(0,0,0,0.2)' }} />
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '12px' }}>
            {resultImg ? (
              <>
                <button className="btn btn-secondary" onClick={() => { setResultImg(null); setFile(null); setPreview(null); }}>
                  {lang === 'id' ? 'Buat Ulang' : 'Re-generate'}
                </button>
                <a className="btn btn-primary" href={resultImg} download={`IDCARD_${karyawan.EMP_CD}.png`} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Download size={16} /> {lang === 'id' ? 'Download ID Card' : 'Download ID Card'}
                </a>
              </>
            ) : (
              <button
                className="btn btn-primary w-full"
                onClick={handleGenerate}
                disabled={!file || loading}
                style={{ justifyContent: 'center' }}
              >
                {loading ? <Loader2 size={16} className="spin" /> : <ImageIcon size={16} />}
                {loading ? (lang === 'id' ? 'Memproses (Remove BG & Render)...' : 'Processing...') : (lang === 'id' ? 'Generate ID Card' : 'Generate ID Card')}
              </button>
            )}
          </div>

        </div>
      </div>
    </div>,
    document.body
  );
}
