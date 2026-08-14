import fs from 'fs';
import path from 'path';

export interface Reminder {
  id: string;
  title: string;
  dueDate: string | null; // Format YYYY-MM-DD
  status: 'pending' | 'done';
  source: 'manual' | 'chat' | 'system';
  createdAt: string;
}

export interface Note {
  id: string;
  content: string;
  createdAt: string;
}

export interface Milestone {
  id: string;
  title: string;
  date: string; // Format YYYY-MM-DD
  category: 'payroll' | 'contract' | 'audit' | 'general';
  source: 'manual' | 'chat' | 'system';
  createdAt: string;
}

export interface AIAssistantData {
  reminders: Reminder[];
  notes: Note[];
  milestones?: Milestone[];
}

const DATA_FILE_PATH = path.join(process.cwd(), 'data', 'ai_assistant.json');

const DEFAULT_DATA: AIAssistantData = {
  reminders: [],
  notes: [],
  milestones: []
};

/**
 * Membaca data asisten dari JSON lokal.
 */
export function loadAssistantData(): AIAssistantData {
  try {
    const dir = path.dirname(DATA_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(DATA_FILE_PATH)) {
      fs.writeFileSync(DATA_FILE_PATH, JSON.stringify(DEFAULT_DATA, null, 2), 'utf8');
      return DEFAULT_DATA;
    }
    const content = fs.readFileSync(DATA_FILE_PATH, 'utf8');
    const parsed = JSON.parse(content);
    if (!parsed.milestones) parsed.milestones = [];
    return parsed;
  } catch (err) {
    console.error('[AI ASSISTANT LOAD ERROR]', err);
    return DEFAULT_DATA;
  }
}

/**
 * Menyimpan data asisten ke JSON lokal (dengan Auto-Cleanup).
 */
export function saveAssistantData(data: AIAssistantData): void {
  try {
    const dir = path.dirname(DATA_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    if (!data.milestones) data.milestones = [];

    // Auto-cleanup: Batasi maksimal 100 notes terbaru
    if (data.notes.length > 100) {
      data.notes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      data.notes = data.notes.slice(0, 100);
    }

    // Auto-cleanup: Batasi maksimal 100 reminder
    if (data.reminders.length > 100) {
      const pending = data.reminders.filter(r => r.status === 'pending');
      let done = data.reminders.filter(r => r.status === 'done');
      done.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      const allowedDoneCount = Math.max(0, 100 - pending.length);
      done = done.slice(0, allowedDoneCount);
      data.reminders = [...pending, ...done];
    }

    // Auto-cleanup: Batasi maksimal 100 milestones
    if (data.milestones.length > 100) {
      data.milestones.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      data.milestones = data.milestones.slice(0, 100);
    }

    fs.writeFileSync(DATA_FILE_PATH, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('[AI ASSISTANT SAVE ERROR]', err);
  }
}

/**
 * Menambahkan reminder baru.
 */
export function addReminder(title: string, dueDate: string | null = null, source: 'manual' | 'chat' | 'system' = 'manual'): Reminder {
  const data = loadAssistantData();
  const finalDueDate = dueDate || new Date(Date.now()).toISOString().split('T')[0];

  const newReminder: Reminder = {
    id: `rem-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    title: title.trim(),
    dueDate: finalDueDate,
    status: 'pending',
    source,
    createdAt: new Date().toISOString(),
  };

  data.reminders.push(newReminder);
  saveAssistantData(data);
  return newReminder;
}

/**
 * Menambahkan catatan (note) baru.
 */
export function addNote(content: string): Note {
  const data = loadAssistantData();
  
  const newNote: Note = {
    id: `note-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    content: content.trim(),
    createdAt: new Date().toISOString(),
  };

  data.notes.push(newNote);
  saveAssistantData(data);
  return newNote;
}

/**
 * Menambahkan milestone baru.
 */
export function addMilestone(title: string, date: string, category: 'payroll' | 'contract' | 'audit' | 'general' = 'general', source: 'manual' | 'chat' | 'system' = 'manual'): Milestone {
  const data = loadAssistantData();
  if (!data.milestones) data.milestones = [];

  const newMilestone: Milestone = {
    id: `ms-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    title: title.trim(),
    date: date.trim(),
    category,
    source,
    createdAt: new Date().toISOString(),
  };

  data.milestones.push(newMilestone);
  saveAssistantData(data);
  return newMilestone;
}

/**
 * Menghapus milestone.
 */
export function deleteMilestone(id: string): boolean {
  const data = loadAssistantData();
  if (!data.milestones) return false;
  const initialLen = data.milestones.length;
  data.milestones = data.milestones.filter(m => m.id !== id);
  if (data.milestones.length !== initialLen) {
    saveAssistantData(data);
    return true;
  }
  return false;
}

/**
 * Menandai reminder sebagai selesai (done).
 */
export function markReminderDone(id: string): boolean {
  const data = loadAssistantData();
  const index = data.reminders.findIndex(r => r.id === id);
  if (index !== -1) {
    data.reminders[index].status = 'done';
    saveAssistantData(data);
    return true;
  }
  return false;
}
