import { NextRequest, NextResponse } from 'next/server';
import { recordUserFeedback, loadMemory } from '@/lib/ai-memory';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { prompt, sql, rating, note } = body;

    if (!rating || (rating !== 'like' && rating !== 'dislike')) {
      return NextResponse.json({ error: 'Rating harus berupa "like" atau "dislike"' }, { status: 400 });
    }

    recordUserFeedback(prompt, sql, rating, note);

    return NextResponse.json({
      success: true,
      message: rating === 'like'
        ? 'Terima kasih! AI mencatat respons ini sebagai pola yang disukai.'
        : 'Terima kasih atas masukannya! AI telah mencatat koreksi ini untuk meningkatkan respons berikutnya.',
    });
  } catch (err: any) {
    console.error('[FEEDBACK ROUTE ERROR]', err);
    return NextResponse.json({ error: `Gagal menyimpan feedback: ${err.message}` }, { status: 500 });
  }
}

export async function GET() {
  try {
    const memory = loadMemory();
    return NextResponse.json(memory);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
