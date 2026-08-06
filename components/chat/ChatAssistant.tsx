'use client';
import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Sparkles, FileSpreadsheet, Paperclip, Check, AlertCircle, ThumbsUp, ThumbsDown } from 'lucide-react';
import { useApp } from '@/lib/context';
import styles from './ChatAssistant.module.css';

function renderInlineText(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={idx} className={styles.msgBold}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

function FormattedMessage({ content }: { content: string }) {
  // 1. Remove SQL code blocks
  const clean = content.replace(/```(?:sql|tsql|[\w]*)\s*[\s\S]*?(?:```|$)/gi, '').replace(/```/g, '').trim();
  if (!clean) return null;

  // 2. Split by double newlines for paragraph sections
  const sections = clean.split(/\n{2,}/);

  return (
    <div className={styles.formattedMsg}>
      {sections.map((sec, secIdx) => {
        const lines = sec.split('\n').map(l => l.trim()).filter(Boolean);
        if (lines.length === 0) return null;

        // Check if all lines are bullet points
        const isBulletList = lines.every(l => /^[-*•]\s+/.test(l));
        if (isBulletList) {
          return (
            <ul key={secIdx} className={styles.msgList}>
              {lines.map((l, lIdx) => (
                <li key={lIdx} className={styles.msgListItem}>
                  {renderInlineText(l.replace(/^[-*•]\s+/, ''))}
                </li>
              ))}
            </ul>
          );
        }

        // Check if all lines are numbered list
        const isNumberedList = lines.every(l => /^\d+\.\s+/.test(l));
        if (isNumberedList) {
          return (
            <ol key={secIdx} className={styles.msgOrderedList}>
              {lines.map((l, lIdx) => (
                <li key={lIdx} className={styles.msgListItem}>
                  {renderInlineText(l.replace(/^\d+\.\s+/, ''))}
                </li>
              ))}
            </ol>
          );
        }

        // Regular paragraph with potential single line breaks
        return (
          <p key={secIdx} className={styles.msgParagraph}>
            {lines.map((line, lIdx) => (
              <React.Fragment key={lIdx}>
                {lIdx > 0 && <br />}
                {renderInlineText(line)}
              </React.Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  rows?: any[];
  sql?: string;
  isExportable?: boolean;
  userPrompt?: string;
  feedback?: 'like' | 'dislike';
  feedbackNote?: string;
  showCorrectionInput?: boolean;
}

const SUGGESTIONS_DEFAULT_ID = ['Karyawan alpha hari ini?', 'Rekap absensi minggu ini'];
const SUGGESTIONS_DEFAULT_EN = ['Absent employees today?', 'Weekly attendance recap'];

export default function ChatAssistant() {
  const { user, settings } = useApp();
  const lang = settings.language;
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [ocrResult, setOcrResult] = useState<any>(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const userName = user?.nama?.split(' ')[0] || 'User';
  const userInitial = userName.charAt(0).toUpperCase();

  const loadSuggestions = async () => {
    try {
      const res = await fetch('/api/chat');
      const data = await res.json();
      if (data.suggestions?.length) setSuggestions(data.suggestions);
    } catch {
      setSuggestions(lang === 'id' ? SUGGESTIONS_DEFAULT_ID : SUGGESTIONS_DEFAULT_EN);
    }
  };

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => { if (open) { inputRef.current?.focus(); loadSuggestions(); } }, [open]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: Message = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const history = messages.slice(-4).map(m => ({ role: m.role, content: m.content }));
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history }),
      });
      const data = await res.json();
      const aiMsg: Message = {
        role: 'assistant',
        content: data.error || data.text || 'Maaf, tidak ada respons.',
        rows: data.rows || undefined,
        sql: data.sql || undefined,
        isExportable: !!(data.rows && data.rows.length > 0),
        userPrompt: text,
      };
      setMessages(prev => [...prev, aiMsg]);
      if (data.suggestions?.length) setSuggestions(data.suggestions);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Gagal menghubungi AI. Coba lagi.' }]);
    } finally {
      setLoading(false);
    }
  };

  const handleFeedback = async (msgIndex: number, rating: 'like' | 'dislike', note?: string) => {
    const msg = messages[msgIndex];
    if (!msg) return;

    setMessages(prev =>
      prev.map((m, idx) => (idx === msgIndex ? { ...m, feedback: rating, feedbackNote: note, showCorrectionInput: false } : m))
    );

    try {
      await fetch('/api/chat/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: msg.userPrompt || '',
          sql: msg.sql,
          rating,
          note,
        }),
      });
    } catch (err) {
      console.error('Feedback error:', err);
    }
  };

  const handleExport = async (sql: string, prompt?: string) => {
    try {
      const res = await fetch('/api/chat/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql, prompt }),
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `Laporan_HRIS_${new Date().toISOString().slice(0, 10)}.xlsx`;
        a.click(); URL.revokeObjectURL(url);
      }
    } catch { alert('Gagal export'); }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setOcrError(''); setOcrResult(null); setOcrLoading(true);
    try {
      const formData = new FormData(); formData.append('file', file);
      const res = await fetch('/api/chat/ocr', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.error) setOcrError(data.error);
      else setOcrResult(data);
    } catch { setOcrError('Gagal upload dokumen'); }
    finally { setOcrLoading(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
  };

  return (
    <>
      <button className={styles.fab} onClick={() => setOpen(!open)} title="Viditii AI">
        {open ? <X size={22} /> : <MessageSquare size={22} />}
      </button>
      {open && (
        <div className={styles.panel}>
          <div className={styles.header}>
            <div className={styles.headerLeft}>
              <div className={styles.headerAvatar}>V</div>
              <div>
                <div className={styles.headerName}>Viditii</div>
              </div>
              <div className={styles.headerDot} />
            </div>
            <button className={styles.closeBtn} onClick={() => setOpen(false)}><X size={16} /></button>
          </div>

          <div className={styles.messages}>
            {messages.length === 0 && (
              <div className={styles.emptyState}>
                <div className={styles.emptyStateIcon}><Sparkles size={20} /></div>
                <span>{lang === 'id' ? 'Tanya apa saja tentang data HR' : 'Ask anything about HR data'}</span>
                <div className={styles.suggestions}>
                  {suggestions.map((s, i) => (
                    <button key={i} className={styles.suggestionBtn} onClick={() => sendMessage(s)}>{s}</button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`${styles.messageRow} ${m.role === 'user' ? styles.messageRowUser : ''}`}>
                {m.role === 'user' ? (
                  <img src="/avatar-hr.png" alt="" className={styles.avatar}
                    onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                ) : (
                  <div className={`${styles.avatarPlaceholder} ${styles.avatarAi}`}>V</div>
                )}
                <div className={styles.messageContent}>
                  <div className={`${styles.bubble} ${m.role === 'user' ? styles.bubbleUser : styles.bubbleAi}`}>
                    <FormattedMessage content={m.content} />
                  </div>

                  {m.role === 'assistant' && (
                    <div className={styles.bubbleFooter}>
                      {m.isExportable && m.sql && (
                        <button className={styles.bubbleActionBtn} onClick={() => handleExport(m.sql!, m.userPrompt)}>
                          <FileSpreadsheet size={14} /> Unduh Laporan Lengkap Excel ({m.rows ? `${m.rows.length.toLocaleString('id-ID')} Baris Data` : 'Download'})
                        </button>
                      )}

                      <div className={styles.feedbackRow}>
                        <span className={styles.feedbackLabel}>Apakah jawaban ini membantu?</span>
                        <button
                          className={`${styles.feedbackBtn} ${m.feedback === 'like' ? styles.feedbackBtnActive : ''}`}
                          title="Bagus / Tepat"
                          onClick={() => handleFeedback(i, 'like')}
                        >
                          <ThumbsUp size={11} />
                        </button>
                        <button
                          className={`${styles.feedbackBtn} ${m.feedback === 'dislike' ? styles.feedbackBtnActiveDislike : ''}`}
                          title="Beri Masukan / Koreksi"
                          onClick={() => {
                            setMessages(prev =>
                              prev.map((msg, idx) => (idx === i ? { ...msg, showCorrectionInput: !msg.showCorrectionInput } : msg))
                            );
                          }}
                        >
                          <ThumbsDown size={11} />
                        </button>
                      </div>

                      {m.feedback && (
                        <div className={styles.feedbackThanks}>
                          <Check size={11} /> AI telah mempelajari masukan Anda
                        </div>
                      )}

                      {m.showCorrectionInput && (
                        <div className={styles.correctionBox}>
                          <input
                            type="text"
                            placeholder="Tulis koreksi agar AI memahaminya..."
                            className={styles.correctionInput}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleFeedback(i, 'dislike', (e.target as HTMLInputElement).value);
                              }
                            }}
                          />
                          <button
                            className={styles.correctionSubmitBtn}
                            onClick={(e) => {
                              const inputEl = (e.currentTarget.previousSibling as HTMLInputElement);
                              handleFeedback(i, 'dislike', inputEl?.value || '');
                            }}
                          >
                            Kirim Koreksi
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className={styles.messageRow}>
                <div className={`${styles.avatarPlaceholder} ${styles.avatarAi}`}>V</div>
                <div className={styles.messageContent}>
                  <div className={`${styles.bubble} ${styles.bubbleAi}`}>
                    <div className={styles.typing}>
                      <div className={styles.typingDot} /><div className={styles.typingDot} /><div className={styles.typingDot} />
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {ocrLoading && (
            <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)', fontSize: 12 }}>
              <div className="spinner" style={{ width: 14, height: 14 }} /> Memproses dokumen...
            </div>
          )}
          {ocrError && (
            <div className={styles.ocrResult} style={{ background: 'var(--danger-bg)', borderColor: 'rgba(225,29,72,0.22)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--danger)' }}><AlertCircle size={14} /> {ocrError}</div>
            </div>
          )}
          {ocrResult && (
            <div className={styles.ocrResult}>
              <div className={styles.ocrResultRow}><span className={styles.ocrResultLabel}>Nama</span><span className={styles.ocrResultValue}>{ocrResult.nama}</span></div>
              <div className={styles.ocrResultRow}><span className={styles.ocrResultLabel}>Tanggal</span><span className={styles.ocrResultValue}>{ocrResult.tanggal}</span></div>
              <div className={styles.ocrResultRow}><span className={styles.ocrResultLabel}>Jenis</span><span className={styles.ocrResultValue}>{ocrResult.jenis?.toUpperCase()}</span></div>
              {ocrResult.keterangan && <div className={styles.ocrResultRow}><span className={styles.ocrResultLabel}>Keterangan</span><span className={styles.ocrResultValue}>{ocrResult.keterangan}</span></div>}
              <div className={styles.ocrActions}>
                <button className="btn btn-sm btn-secondary" onClick={() => { setOcrResult(null); setOcrError(''); }}><X size={12} /> Batal</button>
                <button className="btn btn-sm btn-success" onClick={() => {
                  setMessages(prev => [...prev, { role: 'user', content: `Input ${ocrResult.jenis}: ${ocrResult.nama}, ${ocrResult.tanggal}${ocrResult.keterangan ? ` - ${ocrResult.keterangan}` : ''}` }]);
                  setOcrResult(null);
                }}><Check size={12} /> Konfirmasi</button>
              </div>
            </div>
          )}

          <form className={styles.inputArea} onSubmit={e => { e.preventDefault(); sendMessage(input); }}>
            <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" style={{ display: 'none' }} />
            <button type="button" className={styles.uploadBtn} disabled={loading} onClick={() => fileInputRef.current?.click()} title="Upload surat sakit/izin/cuti">
              <Paperclip size={14} />
            </button>
            <input ref={inputRef} className={styles.input} value={input} onChange={e => setInput(e.target.value)}
              placeholder={lang === 'id' ? 'Tanya data HR...' : 'Ask about HR data...'} disabled={loading} />
            <button className={styles.sendBtn} type="submit" disabled={!input.trim() || loading}><Send size={14} /></button>
          </form>
        </div>
      )}
    </>
  );
}