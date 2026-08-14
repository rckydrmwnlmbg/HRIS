const http = require('http');

function get(path) {
  return new Promise((resolve, reject) => {
    http.get('http://localhost:3000' + path, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    }).on('error', reject);
  });
}

async function test() {
  console.log('Testing GET /api/laporan/export?type=ketidakhadiran&bulan=8&tahun=2026&format=json:');
  const res = await get('/api/laporan/export?type=ketidakhadiran&bulan=8&tahun=2026&format=json');
  console.log('Status:', res.status);
  try {
    const json = JSON.parse(res.data);
    console.log('Summary days count:', json.summary?.length);
    console.log('Details count:', json.details?.length);
    console.log('Sample summary:', json.summary?.[0]);
  } catch (e) {
    console.log('Raw output:', res.data.slice(0, 200));
  }
}

test();
