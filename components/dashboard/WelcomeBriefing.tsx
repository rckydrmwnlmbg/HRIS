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
      padding: '16px 20px',
      marginBottom: '20px',
      borderRadius: '16px',
      borderLeft: '4px solid var(--accent-blue)',
      background: 'linear-gradient(145deg, var(--bg-secondary) 0%, rgba(37,99,235,0.05) 100%)',
      boxShadow: '0 8px 20px -5px rgba(0,0,0,0.15)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>

        <div>
          <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>{greeting}, {userName}!</h2>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0, marginTop: '2px' }}>
            {todayStr}.
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }}>

        {/* EMPTY STATE (ALL CLEAR) */}
        {insights.length === 0 && reminders.length === 0 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            background: 'rgba(16, 185, 129, 0.05)',
            padding: '8px 12px',
            borderRadius: '8px',
            border: '1px solid rgba(16, 185, 129, 0.2)',
            marginTop: '-10px'
          }}>
            <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '6px', borderRadius: '50%', display: 'flex' }}>
              <CheckCircle2 size={16} color="var(--success)" />
            </div>
            <div>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--success)' }}>Luar Biasa! Data Sangat Rapi. </span>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Tidak ada satupun anomali presensi atau tugas tertunda hari ini. Nikmati harimu!</span>
            </div>
          </div>
        )}

        {/* INSIGHTS SECTION */}
        {insights.length > 0 && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
              {insights.map(insight => {
                const isDanger = insight.type === 'danger';
                const isWarning = insight.type === 'warning';
                const isExpanded = expandedInsightId === insight.id;
                return (
                  <div key={insight.id} style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    background: isDanger ? 'rgba(239, 68, 68, 0.06)' : isWarning ? 'rgba(245, 158, 11, 0.06)' : 'rgba(59, 130, 246, 0.06)',
                    padding: '16px',
                    borderRadius: '12px',
                    border: '1px solid',
                    borderColor: isDanger ? 'rgba(239, 68, 68, 0.2)' : isWarning ? 'rgba(245, 158, 11, 0.2)' : 'rgba(59, 130, 246, 0.2)',
                    transition: 'all 0.2s ease',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
                      <div style={{ marginTop: '2px', background: isDanger ? 'rgba(239,68,68,0.1)' : isWarning ? 'rgba(245,158,11,0.1)' : 'rgba(59,130,246,0.1)', padding: '6px', borderRadius: '8px' }}>
                        {getIconForInsight(insight.type)}
                      </div>
                      <div style={{ fontSize: '14px', lineHeight: 1.5, color: 'var(--text-secondary)', flex: 1 }}>
                        {renderText(insight.text)}
                      </div>
                    </div>
                    {insight.details && insight.details.length > 0 && (
                      <div style={{ paddingLeft: '44px' }}>
                        <button
                          onClick={() => setExpandedInsightId(isExpanded ? null : insight.id)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--accent-blue)',
                            fontSize: '13px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '4px 8px',
                            marginLeft: '-8px',
                            borderRadius: '4px'
                          }}
                        >
                          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          {isExpanded ? 'Tutup Detail' : 'Lihat Detail Karyawan'}
                        </button>

                        {isExpanded && (
                          <div style={{
                            marginTop: '8px',
                            padding: '12px',
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--border)',
                            borderRadius: '6px',
                            maxHeight: '150px',
                            overflowY: 'auto',
                            fontSize: '13px',
                            color: 'var(--text-secondary)'
                          }}>
                            <ul style={{ margin: 0, paddingLeft: '16px' }}>
                              {insight.details.map((detail, idx) => (
                                <li key={idx} style={{ marginBottom: '4px' }}>{detail}</li>
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
          </div>
        )}

        {/* REMINDERS SECTION */}
        {reminders.length > 0 && (
          <div>
            <h3 style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CheckCircle2 size={14} /> Tugas Hari Ini
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {reminders.map(rem => {
                const isOverdue = rem.dueDate && rem.dueDate < new Date().toISOString().split('T')[0];
                const isUpcoming = rem.dueDate && rem.dueDate > new Date().toISOString().split('T')[0];
                
                return (
                <div
                  key={rem.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    background: 'var(--bg-primary)',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onClick={() => handleMarkDone(rem.id)}
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--success)'}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
                >
                  <Circle size={16} color="var(--text-secondary)" />
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '14px', color: 'var(--text-primary)' }}>{rem.title}</span>
                    {isOverdue && (
                      <span style={{ fontSize: '10px', background: 'rgba(239,68,68,0.1)', color: 'var(--danger)', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>Terlambat</span>
                    )}
                    {isUpcoming && (
                      <span style={{ fontSize: '10px', background: 'rgba(59,130,246,0.1)', color: 'var(--accent-blue)', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>{rem.dueDate}</span>
                    )}
                  </div>
                </div>
              )})}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
