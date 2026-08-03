import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year') || new Date().getFullYear();

    const result = await query<any>(`
      SELECT 
        CONVERT(varchar(10), TANGGAL, 120) AS tanggal,
        RTRIM(KETERANGAN) AS keterangan,
        RTRIM(STATUS_LIBUR) AS status_libur
      FROM MS_LIBUR_KERJA
      WHERE YEAR(TANGGAL) = ${year}
      ORDER BY TANGGAL DESC
    `);

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { tanggal, keterangan } = body;

    if (!tanggal || !keterangan) {
      return NextResponse.json({ error: 'Tanggal dan keterangan wajib diisi' }, { status: 400 });
    }

    // Insert ke MS_LIBUR_KERJA (Default field status_libur = 1, company_code = '01')
    await query(`
      IF EXISTS (SELECT 1 FROM MS_LIBUR_KERJA WHERE CONVERT(varchar(10), TANGGAL, 120) = '${tanggal}')
        UPDATE MS_LIBUR_KERJA SET KETERANGAN = '${keterangan}' WHERE CONVERT(varchar(10), TANGGAL, 120) = '${tanggal}'
      ELSE
        INSERT INTO MS_LIBUR_KERJA (TANGGAL, KETERANGAN, COMPANY_CODE, STATUS_LIBUR, FLAG_PAY)
        VALUES ('${tanggal}', '${keterangan}', '01', '1', '1')
    `);

    return NextResponse.json({ success: true, message: 'Hari libur berhasil disimpan.' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tanggal = searchParams.get('tanggal');

    if (!tanggal) {
      return NextResponse.json({ error: 'Tanggal wajib diisi' }, { status: 400 });
    }

    await query(`
      DELETE FROM MS_LIBUR_KERJA 
      WHERE CONVERT(varchar(10), TANGGAL, 120) = '${tanggal}'
    `);

    return NextResponse.json({ success: true, message: 'Hari libur berhasil dihapus.' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
