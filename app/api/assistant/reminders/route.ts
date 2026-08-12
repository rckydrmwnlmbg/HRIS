import { NextRequest, NextResponse } from 'next/server';
import { loadAssistantData, addReminder, addNote, markReminderDone } from '@/lib/ai-assistant';

export async function GET() {
  try {
    const data = loadAssistantData();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, content, dueDate, source } = body;

    if (!type || !content) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (type === 'reminder') {
      const reminder = addReminder(content, dueDate, source || 'manual');
      return NextResponse.json({ success: true, data: reminder });
    } else if (type === 'note') {
      const note = addNote(content);
      return NextResponse.json({ success: true, data: note });
    } else {
      return NextResponse.json({ error: 'Invalid type. Use "reminder" or "note"' }, { status: 400 });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, action } = body;

    if (!id || action !== 'done') {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const success = markReminderDone(id);
    if (success) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ error: 'Reminder not found' }, { status: 404 });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Error' }, { status: 500 });
  }
}
