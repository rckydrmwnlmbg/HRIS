import { NextRequest, NextResponse } from 'next/server';
import { loadAssistantData, addReminder, addNote, addMilestone, deleteMilestone, markReminderDone } from '@/lib/ai-assistant';

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
    const { type, content, dueDate, date, category, source } = body;

    if (!type) {
      return NextResponse.json({ error: 'Missing type' }, { status: 400 });
    }

    if (type === 'reminder') {
      if (!content) return NextResponse.json({ error: 'Content required' }, { status: 400 });
      const reminder = addReminder(content, dueDate || date, source || 'manual');
      return NextResponse.json({ success: true, data: reminder });
    } else if (type === 'note') {
      if (!content) return NextResponse.json({ error: 'Content required' }, { status: 400 });
      const note = addNote(content);
      return NextResponse.json({ success: true, data: note });
    } else if (type === 'milestone') {
      if (!content || !date) return NextResponse.json({ error: 'Content and date required' }, { status: 400 });
      const milestone = addMilestone(content, date, category || 'general', source || 'manual');
      return NextResponse.json({ success: true, data: milestone });
    } else {
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
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

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const type = searchParams.get('type') || 'milestone';

    if (!id) {
      return NextResponse.json({ error: 'ID required' }, { status: 400 });
    }

    if (type === 'milestone') {
      const success = deleteMilestone(id);
      return NextResponse.json({ success });
    }

    return NextResponse.json({ error: 'Unsupported delete type' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Error' }, { status: 500 });
  }
}
