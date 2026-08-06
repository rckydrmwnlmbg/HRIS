import { NextRequest, NextResponse } from 'next/server';

const API_URL =
  process.env.AI_BASE_URL ||
  process.env.OPENAI_BASE_URL ||
  process.env.BANDELBANGET_URL ||
  'https://bandelbanget.xyz/v1/chat/completions';

const API_KEY =
  process.env.AI_API_KEY ||
  process.env.OPENAI_API_KEY ||
  process.env.BANDELBANGET_API_KEY ||
  'sk-qwen-753ac2e4be15fce1802f744c769e8636ee5632a4a409dba5';

const MODEL =
  process.env.AI_MODEL_VISION ||
  process.env.AI_MODEL ||
  'gpt-5.6-luna';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    if (!file) return NextResponse.json({ error: 'File tidak ditemukan' }, { status: 400 });

    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString('base64');
    const mime = file.type || 'image/jpeg';
    const dataUrl = `data:${mime};base64,${base64}`;

    const aiResponse = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Ekstrak data dari dokumen surat sakit/izin/cuti ini. Return HANYA JSON valid tanpa markdown:
{
  "nama": "nama karyawan",
  "tanggal": "YYYY-MM-DD atau YYYY-MM-DD s/d YYYY-MM-DD jika rentang",
  "jenis": "sakit|izin|cuti",
  "keterangan": "alasan singkat",
  "dokter": "nama dokter jika ada, null jika tidak",
  "rs": "nama rumah sakit jika ada, null jika tidak"
}
Jika bukan surat sakit/izin/cuti, return: {"error": "Bukan dokumen yang dikenali"}`,
              },
              { type: 'image_url', image_url: { url: dataUrl } },
            ],
          },
        ],
        max_tokens: 400,
        temperature: 0.1,
      }),
    });

    const data = await aiResponse.json();

    if (!aiResponse.ok || data.error) {
      const msg = data?.error?.message || `Error API AI (${aiResponse.status})`;
      return NextResponse.json({ error: msg }, { status: 422 });
    }

    const content = data.choices?.[0]?.message?.content || '';

    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return NextResponse.json({ error: 'Gagal membaca isi dokumen' }, { status: 422 });

    const result = JSON.parse(jsonMatch[0]);
    if (result.error) return NextResponse.json({ error: result.error }, { status: 422 });

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('[OCR ERROR]', err);
    return NextResponse.json({ error: `Gagal memproses dokumen: ${err.message}` }, { status: 500 });
  }
}