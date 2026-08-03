import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { nama, nik, jabatan, departemen, fotoBase64 } = body;

    if (!nama || !nik || !fotoBase64) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const templatePath = path.join(process.cwd(), 'public', 'idcard', 'Template_ID.png');
    
    if (!fs.existsSync(templatePath)) {
      return NextResponse.json({ error: 'Template_ID.png not found in public/idcard' }, { status: 500 });
    }

    // Decode base64 photo
    const fotoBuffer = Buffer.from(fotoBase64.replace(/^data:image\/\w+;base64,/, ''), 'base64');

    // 1. Resize photo to match idcard.py logic: contain (fit: 'inside') within 1700x1967
    const resizedFotoBuffer = await sharp(fotoBuffer)
      .resize({
        width: 1700,
        height: 1967,
        fit: 'inside'
      })
      .toBuffer();

    // Get the actual width of the resized photo to calculate exact horizontal centering
    const photoMetadata = await sharp(resizedFotoBuffer).metadata();
    const actualWidth = photoMetadata.width || 1700;
    const offsetX = 480 + Math.floor((1700 - actualWidth) / 2);
    const offsetY = 1153;

    // 2. Helper to simulate Python's get_fitted_font
    function getFontSize(text: string, maxFontSize: number, maxWidth: number) {
      if (!text) return maxFontSize;
      // Rough estimation: typical sans-serif character width is ~55-60% of font size
      const estimatedWidth = text.length * maxFontSize * 0.55;
      if (estimatedWidth <= maxWidth) return maxFontSize;
      const newSize = Math.floor(maxWidth / (text.length * 0.55));
      return Math.max(newSize, 60); // min_size = 60
    }

    const maxWidth = 2659 - 275 - 150; // CANVAS_WIDTH - MARGIN_KIRI_X - MARGIN_KANAN
    const textColor = "#082a4d";
    
    // Calculate font sizes
    const namaFontSize = getFontSize(nama.toUpperCase(), 190, maxWidth);
    const tmnbFontSize = 140; // Hardcoded TMNB text
    const jabatanFontSize = getFontSize(jabatan || '', 140, maxWidth);
    const nikFontSize = getFontSize(nik, 140, maxWidth);

    // Helper to escape XML special characters
    const escapeXml = (str: string) => {
      return (str || '').replace(/[<>&'"]/g, (c) => {
        switch (c) {
          case '<': return '&lt;';
          case '>': return '&gt;';
          case '&': return '&amp;';
          case "'": return '&apos;'; // Turbopack cache bust
          case '"': return '&quot;';
          default: return c;
        }
      });
    };

    // Calculate Y positioning. In Python/PIL, Y=290 is the top (ascender).
    // In SVG, Y is the baseline. Baseline ~= Ascender + (fontSize * 0.8)
    const yNama = 290 + Math.floor(namaFontSize * 0.8);
    const yTmnb = 590 + Math.floor(tmnbFontSize * 0.8);
    const yJabatan = 762 + Math.floor(jabatanFontSize * 0.8);
    const yNik = 940 + Math.floor(nikFontSize * 0.8);

    // Default to system fonts to approximate NirmalaB and Metropolis (removed internal double quotes to prevent SVG breaking)
    const fontFamily = 'system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif';

    const svgOverlay = `
      <svg xmlns="http://www.w3.org/2000/svg" width="2659" height="3120">
        <text x="275" y="${yNama}" font-family="${fontFamily}" font-size="${namaFontSize}" font-weight="bold" fill="${textColor}">${escapeXml(nama.toUpperCase())}</text>
        <text x="275" y="${yTmnb}" font-family="${fontFamily}" font-size="${tmnbFontSize}" fill="${textColor}">TMNB</text>
        <text x="275" y="${yJabatan}" font-family="${fontFamily}" font-size="${jabatanFontSize}" fill="${textColor}">${escapeXml(jabatan)}</text>
        <text x="275" y="${yNik}" font-family="${fontFamily}" font-size="${nikFontSize}" fill="${textColor}">${escapeXml(nik)}</text>
      </svg>
    `;
    
    console.log("SVG OVERLAY GENERATED:", svgOverlay);

    // Composite everything together
    let finalImageBuffer;
    try {
      finalImageBuffer = await sharp(templatePath)
        .composite([
          {
            input: resizedFotoBuffer,
            top: offsetY,
            left: offsetX,
          },
          {
            input: Buffer.from(svgOverlay),
            top: 0,
            left: 0,
          }
        ])
        .png()
        .toBuffer();
    } catch (err: any) {
      console.error('Sharp Composite Error:', err);
      return NextResponse.json({ 
        error: 'SVG composite error', 
        details: err.message, 
        svgContext: svgOverlay 
      }, { status: 500 });
    }

    return new NextResponse(finalImageBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Content-Length': finalImageBuffer.byteLength.toString(),
      },
    });

  } catch (error: any) {
    console.error('ID Card Generation Error:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}
