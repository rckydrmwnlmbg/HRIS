'use client';
import React, { useState, useEffect } from 'react';
import { useApp } from '@/lib/context';
import { Sparkles, CheckCircle2, Circle, AlertTriangle, AlertCircle, Gift, Loader2, ChevronDown, ChevronUp } from 'lucide-react';

interface Reminder {
  id: string;
  title: string;
  dueDate: string | null;
  status: 'pending' | 'done';
}

interface Insight {
  id: string;
  type: 'warning' | 'danger' | 'success' | 'info';
  text: string;
  priority: 'high' | 'medium' | 'low';
  details?: string[];
}

export default function WelcomeBriefing() {
  const { user } = useApp();
  const userName = user?.nama?.split(' ')[0] || 'Administrator';

  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedInsightId, setExpandedInsightId] = useState<string | null>(null);

  useEffect(() => {
    const fetchBriefing = async () => {
      try {
        // Fetch Reminders
        const remRes = await fetch('/api/assistant/reminders');
        if (remRes.ok) {
          const data = await remRes.json();
          const today = new Date().toISOString().split('T')[0];
          let pendingReminders = (data.reminders || []).filter((r: Reminder) => r.status === 'pending');
          pendingReminders.sort((a: Reminder, b: Reminder) => {
            const dateA = a.dueDate || today;
            const dateB = b.dueDate || today;
            return dateA.localeCompare(dateB);
          });
          setReminders(pendingReminders);
        }

        // Fetch Insights
        const insRes = await fetch('/api/assistant/briefing');
        if (insRes.ok) {
          const data = await insRes.json();
          setInsights(data.insights || []);
        }
      } catch (err) {
        console.error('Failed to load briefing', err);
      } finally {
        setLoading(false);
      }
    };

    fetchBriefing();
  }, []);

  const handleMarkDone = async (id: string) => {
    try {
      // Optimistic update
      setReminders(prev => prev.filter(r => r.id !== id));

      await fetch('/api/assistant/reminders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'done' })
      });
    } catch (err) {
      console.error('Failed to mark reminder done', err);
    }
  };

  const getIconForInsight = (type: string) => {
    switch (type) {
      case 'danger': return <AlertCircle size={16} color="var(--danger)" />;
      case 'warning': return <AlertTriangle size={16} color="var(--warning)" />;
      case 'success': return <Gift size={16} color="var(--success)" />;
      default: return <Sparkles size={16} color="var(--info)" />;
    }
  };

  const todayStr = new Date().toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });

  if (loading) {
    return (
      <div className="glass-card" style={{ padding: '24px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <Loader2 className="spinner" size={20} color="var(--text-muted)" />
        <span style={{ color: 'var(--text-secondary)' }}>Menyiapkan briefing harian Viditii...</span>
      </div>
    );
  }

  const currentHour = new Date().getHours();
  let greeting = 'Selamat Pagi';
  if (currentHour >= 11 && currentHour < 15) greeting = 'Selamat Siang';
  else if (currentHour >= 15 && currentHour < 18) greeting = 'Selamat Sore';
  else if (currentHour >= 18) greeting = 'Selamat Malam';

  // Helper to parse **bold** text inline
  const renderText = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{part.slice(2, -2)}</strong>;
      }
      return <span key={i}>{part}</span>;
    });
  };

  return (
    <div className="glass-card animate-fadeIn" style={{
      padding: '14px 18px',
      marginBottom: '18px',
    }}>
      {/* Top Header Row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: (insights.length > 0 || reminders.length > 0) ? '12px' : '0', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '26px',
            height: '26px',
            borderRadius: 'var(--radius-sm)',
            background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.2), rgba(99, 102, 241, 0.15))',
            border: '1px solid rgba(14, 165, 233, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--accent)',
            boxShadow: '0 2px 8px rgba(14, 165, 233, 0.2)'
          }}>
            <Sparkles size={14} />
          </div>
          <div>
            <h2 style={{ fontSize: '13.5px', fontWeight: 750, margin: 0, color: 'var(--text-primary)', letterSpacing: '-0.015em', display: 'inline' }}>
              {greeting}, {userName}!
            </h2>
            <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginLeft: '8px' }}>
              {todayStr}
            </span>
          </div>
        </div>

        {insights.length > 0 && (
          <span className="badge badge-info badge-sm">
            {insights.length} Wawasan Presensi
          </span>
        )}
      </div>

      <div>
        {/* EMPTY STATE (ALL CLEAR) */}
        {insights.length === 0 && reminders.length === 0 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            background: 'rgba(16, 185, 129, 0.08)',
            padding: '8px 12px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid rgba(16, 185, 129, 0.22)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            marginTop: '8px'
          }}>
            <CheckCircle2 size={15} color="var(--success)" style={{ flexShrink: 0 }} />
            <div style={{ fontSize: '12px' }}>
              <span style={{ fontWeight: 650, color: 'var(--success)' }}>Luar Biasa! Data Sangat Rapi. </span>
              <span style={{ color: 'var(--text-secondary)' }}>Tidak ada satupun anomali presensi atau tugas tertunda hari ini.</span>
            </div>
          </div>
        )}

        {/* INSIGHTS SECTION */}
        {insights.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '10px', marginBottom: reminders.length > 0 ? '12px' : '0' }}>
            {insights.map(insight => {
              const isDanger = insight.type === 'danger';
              const isWarning = insight.type === 'warning';
              const isExpanded = expandedInsightId === insight.id;
              const accentColor = isDanger ? 'var(--danger)' : isWarning ? 'var(--warning)' : 'var(--accent)';
              const bgTint = isDanger ? 'rgba(225, 29, 72, 0.06)' : isWarning ? 'rgba(217, 119, 6, 0.06)' : 'rgba(14, 165, 233, 0.06)';
              const borderTint = isDanger ? 'rgba(225, 29, 72, 0.22)' : isWarning ? 'rgba(217, 119, 6, 0.22)' : 'rgba(14, 165, 233, 0.22)';

              return (
                <div key={insight.id} style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  background: bgTint,
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-md)',
                  border: `1px solid ${borderTint}`,
                  transition: 'all 0.2s ease',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <div style={{
                      marginTop: '1px',
                      background: bgTint,
                      padding: '4px',
                      borderRadius: 'var(--radius-sm)',
                      display: 'flex',
                      flexShrink: 0
                    }}>
                      {getIconForInsight(insight.type)}
                    </div>
                    <div style={{ fontSize: '12px', lineHeight: 1.5, color: 'var(--text-secondary)', flex: 1 }}>
                      {renderText(insight.text)}
                    </div>
                  </div>

                  {insight.details && insight.details.length > 0 && (
                    <div style={{ paddingLeft: '32px' }}>
                      <button
                        onClick={() => setExpandedInsightId(isExpanded ? null : insight.id)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: accentColor,
                          fontSize: '11px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '3px',
                          padding: '2px 4px',
                          marginLeft: '-4px',
                          borderRadius: '4px'
                        }}
                      >
                        {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        {isExpanded ? 'Tutup Detail' : 'Lihat Detail Karyawan'}
                      </button>

                      {isExpanded && (
                        <div style={{
                          marginTop: '6px',
                          padding: '8px 10px',
                          background: 'var(--glass-bg)',
                          border: '1px solid var(--border)',
                          borderRadius: 'var(--radius-sm)',
                          maxHeight: '120px',
                          overflowY: 'auto',
                          fontSize: '11.5px',
                          color: 'var(--text-secondary)'
                        }}>
                          <ul style={{ margin: 0, paddingLeft: '14px' }}>
                            {insight.details.map((detail, idx) => (
                              <li key={idx} style={{ marginBottom: '3px' }}>{detail}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* REMINDERS SECTION */}
        {reminders.length > 0 && (
          <div style={{ marginTop: insights.length > 0 ? '10px' : '0' }}>
            <div style={{ fontSize: '11px', fontWeight: 650, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <CheckCircle2 size={12} /> Tugas Hari Ini
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '6px' }}>
              {reminders.map(rem => {
                const isOverdue = rem.dueDate && rem.dueDate < new Date().toISOString().split('T')[0];
                const isUpcoming = rem.dueDate && rem.dueDate > new Date().toISOString().split('T')[0];
                
                return (
                  <div
                    key={rem.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      background: 'var(--glass-bg)',
                      padding: '7px 10px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                    onClick={() => handleMarkDone(rem.id)}
                    onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--success)'}
                    onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
                  >
                    <Circle size={13} color="var(--text-secondary)" style={{ flexShrink: 0 }} />
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{rem.title}</span>
                      {isOverdue && (
                        <span className="badge badge-danger badge-sm" style={{ padding: '1px 5px', fontSize: '9px' }}>Terlambat</span>
                      )}
                      {isUpcoming && (
                        <span className="badge badge-info badge-sm" style={{ padding: '1px 5px', fontSize: '9px' }}>{rem.dueDate}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
