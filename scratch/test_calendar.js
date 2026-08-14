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

async function run() {
  console.log('Testing Calendar and Holiday APIs:');
  const r1 = await get('/api/pengaturan/hari-libur?year=2026');
  console.log('1. GET /api/pengaturan/hari-libur:', r1.status);
  
  const r2 = await get('/api/assistant/reminders');
  console.log('2. GET /api/assistant/reminders:', r2.status);
}

run();
