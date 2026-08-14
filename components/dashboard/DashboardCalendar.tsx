'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  AlertCircle,
  Check,
  Clock,
  Sparkles,
  DollarSign,
  Flag,
  Trash2,
  Briefcase,
  FileCheck,
  ShieldCheck,
  Info
} from 'lucide-react';
import { useApp } from '@/lib/context';
import { useToast } from '@/components/ui/ToastProvider';
import { getIndonesianNationalHolidays, calculatePayrollDate, formatLocalDate } from '@/lib/holidays';
import { Modal } from '@/components/ui/Modal';
import styles from './DashboardCalendar.module.css';

interface RegisteredHoliday {
  tanggal: string; // YYYY-MM-DD
  keterangan: string;
  status_libur?: string;
}

interface Reminder {
  id: string;
  title: string;
  dueDate: string | null;
  status: 'pending' | 'done';
  source?: string;
}

interface Milestone {
  id: string;
  title: string;
  date: string;
  category: 'payroll' | 'contract' | 'audit' | 'general';
}

const MONTH_NAMES_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const MONTH_NAMES_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function DashboardCalendar() {
  const { settings } = useApp();
  const { showToast } = useToast();
  const lang = settings.language || 'id';

  const today = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => formatLocalDate(today), [today]);

  const [currentYear, setCurrentYear] = useState<number>(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(today.getMonth() + 1); // 1 - 12
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);

  // Data states
  const [registeredHolidays, setRegisteredHolidays] = useState<RegisteredHoliday[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [syncingHoliday, setSyncingHoliday] = useState<boolean>(false);

  // Quick Add Modal state
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [addType, setAddType] = useState<'reminder' | 'milestone'>('reminder');
  const [addTitle, setAddTitle] = useState<string>('');
  const [addCategory, setAddCategory] = useState<'payroll' | 'contract' | 'audit' | 'general'>('payroll');
  const [isSubmittingAdd, setIsSubmittingAdd] = useState<boolean>(false);

  // 1. Fetch Registered Holidays for the viewed year
  const fetchHolidays = async (year: number) => {
    try {
      const res = await fetch(`/api/pengaturan/hari-libur?year=${year}`);
      if (res.ok) {
        const data = await res.json();
        setRegisteredHolidays(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Failed to fetch holidays:', err);
    }
  };

  // 2. Fetch Reminders & Milestones
  const fetchAssistantData = async () => {
    try {
      const res = await fetch('/api/assistant/reminders');
      if (res.ok) {
        const data = await res.json();
        setReminders(data.reminders || []);
        setMilestones(data.milestones || []);
      }
    } catch (err) {
      console.error('Failed to fetch assistant data:', err);
    }
  };

  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      await Promise.all([fetchHolidays(currentYear), fetchAssistantData()]);
      setLoading(false);
    };
    loadAll();
  }, [currentYear]);

  // Indonesian National Holidays list for current viewed year
  const nationalHolidays = useMemo(() => {
    return getIndonesianNationalHolidays(currentYear);
  }, [currentYear]);

  // Set of registered holiday dates for fast lookup
  const registeredHolidayDateSet = useMemo(() => {
    return new Set(registeredHolidays.map(h => h.tanggal));
  }, [registeredHolidays]);

  // Map of registered holidays { 'YYYY-MM-DD': 'Nama Libur' }
  const registeredHolidayMap = useMemo(() => {
    const map = new Map<string, string>();
    registeredHolidays.forEach(h => map.set(h.tanggal, h.keterangan));
    return map;
  }, [registeredHolidays]);

  // Unregistered national holidays in current viewed month
  const unregisteredNationalHolidaysInMonth = useMemo(() => {
    const prefix = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
    return nationalHolidays.filter(nh => nh.date.startsWith(prefix) && !registeredHolidayDateSet.has(nh.date));
  }, [nationalHolidays, currentYear, currentMonth, registeredHolidayDateSet]);

  // Calculated Smart Payroll Date for current month (strictly using local time without UTC offset)
  const payrollDateStr = useMemo(() => {
    const holidayDates = registeredHolidays.map(h => h.tanggal);
    return calculatePayrollDate(currentYear, currentMonth, holidayDates);
  }, [currentYear, currentMonth, registeredHolidays]);

  // Navigate Months
  const handlePrevMonth = () => {
    if (currentMonth === 1) {
      setCurrentMonth(12);
      setCurrentYear(y => y - 1);
    } else {
      setCurrentMonth(m => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 12) {
      setCurrentMonth(1);
      setCurrentYear(y => y + 1);
    } else {
      setCurrentMonth(m => m + 1);
    }
  };

  const handleGoToday = () => {
    setCurrentYear(today.getFullYear());
    setCurrentMonth(today.getMonth() + 1);
    setSelectedDate(todayStr);
  };

  // 1-Click Sync Missing National Holiday to Database MS_LIBUR_KERJA
  const handleSyncHoliday = async (holiday: { date: string; name: string }) => {
    setSyncingHoliday(true);
    // Optimistic Update
    setRegisteredHolidays(prev => [
      ...prev,
      { tanggal: holiday.date, keterangan: holiday.name, status_libur: '1' }
    ]);

    try {
      const res = await fetch('/api/pengaturan/hari-libur', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tanggal: holiday.date,
          keterangan: holiday.name
        })
      });
      if (res.ok) {
        showToast(
          lang === 'id'
            ? `Berhasil menyimpan "${holiday.name}" ke Master Libur DB`
            : `Successfully added "${holiday.name}" to Holidays Master DB`,
          'success'
        );
        await fetchHolidays(currentYear);
      } else {
        const errData = await res.json();
        showToast(errData.error || (lang === 'id' ? 'Gagal menyimpan hari libur' : 'Failed to save holiday'), 'error');
        await fetchHolidays(currentYear); // Rollback
      }
    } catch (err) {
      showToast(lang === 'id' ? 'Terjadi kesalahan sistem' : 'System error', 'error');
      await fetchHolidays(currentYear); // Rollback
    } finally {
      setSyncingHoliday(false);
    }
  };

  // Mark Reminder as Done
  const handleMarkReminderDone = async (id: string) => {
    // Optimistic
    setReminders(prev => prev.map(r => r.id === id ? { ...r, status: 'done' as const } : r));
    try {
      await fetch('/api/assistant/reminders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'done' })
      });
      showToast(lang === 'id' ? 'Tugas ditandai selesai' : 'Task marked as done', 'success');
    } catch (err) {
      console.error(err);
    }
  };

  // Delete Milestone
  const handleDeleteMilestone = async (id: string) => {
    setMilestones(prev => prev.filter(m => m.id !== id));
    try {
      await fetch(`/api/assistant/reminders?id=${id}&type=milestone`, {
        method: 'DELETE'
      });
      showToast(lang === 'id' ? 'Milestone berhasil dihapus' : 'Milestone deleted', 'info');
    } catch (err) {
      console.error(err);
    }
  };

  // Handle Quick Add Submit
  const handleQuickAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addTitle.trim()) return;

    setIsSubmittingAdd(true);
    try {
      const payload: any = {
        type: addType,
        content: addTitle.trim(),
        date: selectedDate
      };
      if (addType === 'reminder') {
        payload.dueDate = selectedDate;
      } else {
        payload.category = addCategory;
      }

      const res = await fetch('/api/assistant/reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        showToast(
          addType === 'reminder'
            ? (lang === 'id' ? 'Pengingat berhasil disimpan ke JSON & AI' : 'Reminder saved to JSON & AI')
            : (lang === 'id' ? 'Milestone berhasil ditambahkan ke kalender' : 'Milestone added to calendar'),
          'success'
        );
        setAddTitle('');
        setShowAddModal(false);
        await fetchAssistantData();
      } else {
        showToast(lang === 'id' ? 'Gagal menyimpan agenda' : 'Failed to save agenda', 'warning');
      }
    } catch (err) {
      showToast(lang === 'id' ? 'Terjadi kesalahan sistem' : 'System error', 'error');
    } finally {
      setIsSubmittingAdd(false);
    }
  };

  // Build Calendar Days Grid
  const calendarDays = useMemo(() => {
    const year = currentYear;
    const month = currentMonth; // 1-indexed

    // First day of month (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
    const firstDayDate = new Date(year, month - 1, 1, 12, 0, 0);
    let startDayOfWeek = firstDayDate.getDay(); // 0 is Sunday
    // Adjust to Monday-first (0 = Monday, 6 = Sunday)
    startDayOfWeek = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;

    // Total days in current month
    const totalDays = new Date(year, month, 0).getDate();

    // Total days in previous month
    const prevMonthTotalDays = new Date(year, month - 1, 0).getDate();

    const days = [];

    // Previous month filler days
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const d = prevMonthTotalDays - i;
      const prevM = month === 1 ? 12 : month - 1;
      const prevY = month === 1 ? year - 1 : year;
      const dateStr = `${prevY}-${String(prevM).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({
        dayNum: d,
        dateStr,
        isCurrentMonth: false
      });
    }

    // Current month days
    for (let d = 1; d <= totalDays; d++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({
        dayNum: d,
        dateStr,
        isCurrentMonth: true
      });
    }

    // Next month filler days to complete 35 or 42 grid cells
    const remainingCells = 35 - days.length > 0 ? 35 - days.length : (42 - days.length > 0 ? 42 - days.length : 0);
    for (let d = 1; d <= remainingCells; d++) {
      const nextM = month === 12 ? 1 : month + 1;
      const nextY = month === 12 ? year + 1 : year;
      const dateStr = `${nextY}-${String(nextM).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({
        dayNum: d,
        dateStr,
        isCurrentMonth: false
      });
    }

    return days;
  }, [currentYear, currentMonth]);

  // Selected date's events
  const selectedEvents = useMemo(() => {
    const isPayroll = selectedDate === payrollDateStr;
    const registeredHoliday = registeredHolidayMap.get(selectedDate);
    const nationalHoliday = nationalHolidays.find(nh => nh.date === selectedDate);
    const dateReminders = reminders.filter(r => r.dueDate === selectedDate && r.status === 'pending');
    const dateMilestones = milestones.filter(m => m.date === selectedDate);

    return {
      isPayroll,
      registeredHoliday,
      nationalHoliday,
      dateReminders,
      dateMilestones
    };
  }, [selectedDate, payrollDateStr, registeredHolidayMap, nationalHolidays, reminders, milestones]);

  const monthLabel = lang === 'id' ? MONTH_NAMES_ID[currentMonth - 1] : MONTH_NAMES_EN[currentMonth - 1];

  const getMilestoneBadge = (cat: string) => {
    switch (cat) {
      case 'payroll':
        return { label: 'Payroll', bg: 'rgba(251, 191, 36, 0.15)', color: '#f59e0b', icon: <DollarSign size={11} /> };
      case 'contract':
        return { label: 'Kontrak PKWT', bg: 'rgba(59, 130, 246, 0.15)', color: 'var(--accent)', icon: <FileCheck size={11} /> };
      case 'audit':
        return { label: 'Audit K3', bg: 'rgba(239, 68, 68, 0.15)', color: 'var(--danger)', icon: <ShieldCheck size={11} /> };
      default:
        return { label: 'Operasional', bg: 'rgba(168, 85, 247, 0.15)', color: '#a855f7', icon: <Briefcase size={11} /> };
    }
  };

  return (
    <div className={`glass-card stagger-3 ${styles.calendarCard}`}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <div style={{
            width: '24px',
            height: '24px',
            borderRadius: 'var(--radius-sm)',
            background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.2), rgba(99, 102, 241, 0.15))',
            border: '1px solid rgba(14, 165, 233, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--accent)',
            boxShadow: '0 2px 6px rgba(14, 165, 233, 0.2)'
          }}>
            <CalendarIcon size={13} />
          </div>
          <h3 className={styles.title}>
            {lang === 'id' ? 'Kalender Operasional HR' : 'HR Calendar'}
          </h3>
        </div>

        <div className={styles.navButtons}>
          <button className={styles.todayBtn} onClick={handleGoToday} title="Kembali ke Hari Ini">
            {lang === 'id' ? 'Hari Ini' : 'Today'}
          </button>
          <button className={styles.navBtn} onClick={handlePrevMonth} title="Bulan Sebelumnya">
            <ChevronLeft size={13} />
          </button>
          <span className={styles.monthLabel}>
            {monthLabel} {currentYear}
          </span>
          <button className={styles.navBtn} onClick={handleNextMonth} title="Bulan Berikutnya">
            <ChevronRight size={13} />
          </button>
        </div>
      </div>

      {/* Smart Alert: Missing National Holiday from Database */}
      {unregisteredNationalHolidaysInMonth.length > 0 && (
        <div className={styles.syncBanner}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', minWidth: 0 }}>
            <AlertCircle size={13} color="#f59e0b" style={{ flexShrink: 0 }} />
            <span style={{ color: 'var(--text-primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
              <strong>{unregisteredNationalHolidaysInMonth[0].name}</strong> ({unregisteredNationalHolidaysInMonth[0].date}) {lang === 'id' ? 'belum ada di Master Libur DB' : 'not in DB'}
            </span>
          </div>
          <button
            className={styles.syncBtn}
            onClick={() => handleSyncHoliday(unregisteredNationalHolidaysInMonth[0])}
            disabled={syncingHoliday}
          >
            {syncingHoliday ? 'Menyimpan...' : (lang === 'id' ? '+ Tambah ke DB' : '+ Add to DB')}
          </button>
        </div>
      )}

      {/* Day of Week Headers */}
      <div className={styles.weekGrid}>
        {['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map((day, idx) => (
          <div key={day} className={`${styles.weekDay} ${idx >= 5 ? styles.weekDayWeekend : ''}`}>
            {day}
          </div>
        ))}
      </div>

      {/* Days Grid */}
      <div className={styles.daysGrid}>
        {calendarDays.map(({ dayNum, dateStr, isCurrentMonth }) => {
          const isToday = dateStr === todayStr;
          const isSelected = dateStr === selectedDate;

          // Check Weekend (Sabtu & Minggu)
          const dObj = new Date(dateStr + 'T12:00:00');
          const dayOfWeek = dObj.getDay();
          const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

          // Event indicators
          const hasReminder = reminders.some(r => r.dueDate === dateStr && r.status === 'pending');
          const isRegisteredHoliday = registeredHolidayDateSet.has(dateStr);
          const isNationalHoliday = nationalHolidays.some(nh => nh.date === dateStr);
          const isUnregisteredNational = isNationalHoliday && !isRegisteredHoliday;
          const isPayroll = dateStr === payrollDateStr;
          const hasMilestone = milestones.some(m => m.date === dateStr);

          return (
            <div
              key={dateStr}
              className={`
                ${styles.dayCell} 
                ${!isCurrentMonth ? styles.otherMonth : ''} 
                ${isToday ? styles.isToday : ''} 
                ${isSelected ? styles.isSelected : ''}
                ${isWeekend && isCurrentMonth ? styles.isWeekend : ''}
              `}
              onClick={() => setSelectedDate(dateStr)}
            >
              <span>{dayNum}</span>

              {/* Dots Container */}
              <div className={styles.dotsContainer}>
                {isPayroll && <div className={styles.dotPayroll} title="Jadwal Penggajian / Payroll" />}
                {isRegisteredHoliday && <div className={styles.dotHoliday} title="Hari Libur Resmi Terdaftar" />}
                {isUnregisteredNational && <div className={styles.dotUnregisteredHoliday} title="Libur Nasional (Belum Sync DB)" />}
                {hasReminder && <div className={styles.dotReminder} title="Ada Pengingat / Tugas AI" />}
                {hasMilestone && <div className={styles.dotMilestone} title="Milestone HR" />}
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Date Agenda Box */}
      <div className={styles.agendaBox}>
        <div className={styles.agendaHeader}>
          <div className={styles.agendaDateTitle}>
            📅 {new Date(selectedDate + 'T12:00:00').toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-US', {
              weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
            })}
          </div>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
            {selectedDate === todayStr ? (lang === 'id' ? '(Hari Ini)' : '(Today)') : ''}
          </span>
        </div>

        <div className={styles.agendaItemsList}>
          {/* Payroll notice */}
          {selectedEvents.isPayroll && (
            <div className={styles.agendaItem} style={{ background: 'rgba(251, 191, 36, 0.08)', borderColor: 'rgba(251, 191, 36, 0.3)' }}>
              <DollarSign size={12} color="#f59e0b" />
              <span style={{ fontWeight: 650, color: '#f59e0b', fontSize: '10.5px' }}>
                {lang === 'id' ? 'Jadwal Penggajian (Payroll Payout)' : 'Payroll Payout Schedule'}
              </span>
            </div>
          )}

          {/* Registered Holiday Notice */}
          {selectedEvents.registeredHoliday && (
            <div className={styles.agendaItem} style={{ background: 'rgba(225, 29, 72, 0.08)', borderColor: 'rgba(225, 29, 72, 0.3)' }}>
              <Flag size={12} color="var(--danger)" />
              <span style={{ fontWeight: 600, color: 'var(--danger)', fontSize: '10.5px' }}>
                🌴 {selectedEvents.registeredHoliday} (Libur Terdaftar)
              </span>
            </div>
          )}

          {/* Unregistered National Holiday Warning */}
          {selectedEvents.nationalHoliday && !selectedEvents.registeredHoliday && (
            <div className={styles.agendaItem} style={{ background: 'rgba(245, 158, 11, 0.08)', borderColor: 'rgba(245, 158, 11, 0.3)' }}>
              <AlertCircle size={12} color="#f59e0b" />
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                <span style={{ color: '#f59e0b', fontSize: '10.5px' }}>
                  ⚠️ {selectedEvents.nationalHoliday.name}
                </span>
                <button
                  className={styles.syncBtn}
                  style={{ padding: '1.5px 6px', fontSize: '9px' }}
                  onClick={() => handleSyncHoliday(selectedEvents.nationalHoliday!)}
                >
                  + Simpan DB
                </button>
              </div>
            </div>
          )}

          {/* Custom Milestones */}
          {selectedEvents.dateMilestones.map(m => {
            const badge = getMilestoneBadge(m.category);
            return (
              <div key={m.id} className={styles.agendaItem} style={{ background: 'rgba(168, 85, 247, 0.06)', borderColor: 'rgba(168, 85, 247, 0.25)' }}>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px',
                  padding: '1px 5px',
                  borderRadius: '3px',
                  fontSize: '9px',
                  fontWeight: 650,
                  background: badge.bg,
                  color: badge.color
                }}>
                  {badge.icon}
                  {badge.label}
                </span>
                <span style={{ flex: 1, color: 'var(--text-primary)', fontWeight: 550, fontSize: '10.5px' }}>
                  {m.title}
                </span>
                <button
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '1px' }}
                  onClick={() => handleDeleteMilestone(m.id)}
                  title="Hapus Milestone"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            );
          })}

          {/* Reminders for this date */}
          {selectedEvents.dateReminders.map(r => (
            <div key={r.id} className={styles.agendaItem}>
              <button
                style={{
                  width: '14px',
                  height: '14px',
                  borderRadius: '50%',
                  border: '1.5px solid var(--accent)',
                  background: 'transparent',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0,
                  flexShrink: 0
                }}
                onClick={() => handleMarkReminderDone(r.id)}
                title="Tandai Selesai"
              >
                <Check size={9} color="var(--accent)" style={{ opacity: 0 }} />
              </button>
              <span style={{ flex: 1, color: 'var(--text-primary)', fontSize: '10.5px' }}>
                {r.title}
              </span>
            </div>
          ))}

          {/* Empty state if nothing on this date */}
          {!selectedEvents.isPayroll &&
            !selectedEvents.registeredHoliday &&
            !selectedEvents.nationalHoliday &&
            selectedEvents.dateReminders.length === 0 &&
            selectedEvents.dateMilestones.length === 0 && (
              <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', textAlign: 'center', padding: '4px 0' }}>
                {lang === 'id' ? 'Tidak ada agenda khusus pada tanggal ini' : 'No special agenda on this date'}
              </div>
            )}
        </div>

        {/* Quick Add Button */}
        <button className={styles.quickAddBtn} onClick={() => setShowAddModal(true)}>
          <Plus size={12} />
          <span>{lang === 'id' ? 'Tambah Pengingat / Milestone' : 'Add Reminder / Milestone'}</span>
        </button>
      </div>

      {/* Legend */}
      <div className={styles.legend}>
        <div className={styles.legendItem}>
          <div className={styles.dotPayroll} />
          <span>Gajian (Tgl 5)</span>
        </div>
        <div className={styles.legendItem}>
          <div className={styles.dotHoliday} />
          <span>Libur Resmi</span>
        </div>
        <div className={styles.legendItem}>
          <div className={styles.dotReminder} />
          <span>Pengingat AI</span>
        </div>
        <div className={styles.legendItem}>
          <div className={styles.dotMilestone} />
          <span>Milestone</span>
        </div>
      </div>

      {/* Quick Add Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title={lang === 'id' ? `Tambah Agenda: ${selectedDate}` : `Add Agenda: ${selectedDate}`}
      >
        <form onSubmit={handleQuickAddSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div className="form-group">
            <label className="form-label">{lang === 'id' ? 'Pilih Jenis Agenda' : 'Select Type'}</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <button
                type="button"
                className={`btn btn-sm ${addType === 'reminder' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setAddType('reminder')}
              >
                <Clock size={13} />
                <span>Pengingat To-Do (AI)</span>
              </button>
              <button
                type="button"
                className={`btn btn-sm ${addType === 'milestone' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setAddType('milestone')}
              >
                <Sparkles size={13} />
                <span>Milestone Strategis HR</span>
              </button>
            </div>
          </div>

          {addType === 'reminder' ? (
            <div style={{ background: 'rgba(14, 165, 233, 0.06)', border: '1px solid rgba(14, 165, 233, 0.2)', padding: '8px 12px', borderRadius: 'var(--radius-sm)', fontSize: '11.5px', color: 'var(--text-secondary)' }}>
              <Info size={13} color="var(--accent)" style={{ display: 'inline', marginRight: '5px', verticalAlign: 'middle' }} />
              <strong>Pengingat To-Do:</strong> Tersimpan langsung ke memori AI Assistant (<code>ai_assistant.json</code>). AI akan mengingat tugas ini di percakapan chat.
            </div>
          ) : (
            <div style={{ background: 'rgba(168, 85, 247, 0.06)', border: '1px solid rgba(168, 85, 247, 0.2)', padding: '8px 12px', borderRadius: 'var(--radius-sm)', fontSize: '11.5px', color: 'var(--text-secondary)' }}>
              <Info size={13} color="#a855f7" style={{ display: 'inline', marginRight: '5px', verticalAlign: 'middle' }} />
              <strong>Milestone HR:</strong> Target atau peristiwa penting operasional pabrik (seperti cut-off payroll, evaluasi PKWT, atau jadwal audit).
            </div>
          )}

          <div className="form-group">
            <label className="form-label">
              {addType === 'reminder' ? (lang === 'id' ? 'Judul Tugas / Pengingat' : 'Reminder Title') : (lang === 'id' ? 'Nama Milestone Perusahaan' : 'Milestone Title')}
            </label>
            <input
              type="text"
              className="form-input"
              placeholder={addType === 'reminder' ? 'Contoh: Hubungi SPV Line 02 terkait anomali Cuti' : 'Contoh: Tutup Buku Absensi Periode 25 / Audit K3 Pabrik'}
              value={addTitle}
              onChange={e => setAddTitle(e.target.value)}
              required
              autoFocus
            />
          </div>

          {addType === 'milestone' && (
            <div className="form-group">
              <label className="form-label">{lang === 'id' ? 'Kategori Milestone' : 'Milestone Category'}</label>
              <select
                className="form-select"
                value={addCategory}
                onChange={e => setAddCategory(e.target.value as any)}
              >
                <option value="payroll">💰 Payroll & Penggajian (Contoh: Cut-off Absensi, Payout)</option>
                <option value="contract">📝 Kontrak PKWT (Contoh: Evaluasi Probation, Habis Kontrak)</option>
                <option value="audit">🛡️ Audit & Kepatuhan (Contoh: Audit ISO, Audit K3/SMETA)</option>
                <option value="general">🏢 Operasional Umum (Contoh: Townhall, Maintenance)</option>
              </select>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setShowAddModal(false)}
            >
              {lang === 'id' ? 'Batal' : 'Cancel'}
            </button>
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              disabled={isSubmittingAdd || !addTitle.trim()}
            >
              {isSubmittingAdd ? 'Menyimpan...' : (lang === 'id' ? 'Simpan ke Kalender' : 'Save to Calendar')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
