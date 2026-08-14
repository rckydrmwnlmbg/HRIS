const http = require('http');
const fs = require('fs');
const path = require('path');

function getExcel(pathStr) {
  return new Promise((resolve, reject) => {
    http.get('http://localhost:3000' + pathStr, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        resolve({ status: res.statusCode, headers: res.headers, size: buffer.length, buffer });
      });
    }).on('error', reject);
  });
}

async function test() {
  console.log('Testing GET /api/laporan/export?type=ketidakhadiran&bulan=8&tahun=2026:');
  const res = await getExcel('/api/laporan/export?type=ketidakhadiran&bulan=8&tahun=2026');
  console.log('Status:', res.status);
  console.log('Content-Type:', res.headers['content-type']);
  console.log('Content-Disposition:', res.headers['content-disposition']);
  console.log('File Size:', res.size, 'bytes');

  if (res.status === 200 && res.size > 1000) {
    console.log('✅ Excel binary generated perfectly!');
  } else {
    console.error('❌ Failed to generate valid excel file');
  }
}

test();
