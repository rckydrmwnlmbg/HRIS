const http = require('http');

function post(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request('http://localhost:3000' + path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    }, (res) => {
      let resData = '';
      res.on('data', chunk => resData += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data: resData }));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function test() {
  console.log('Testing POST /api/pengaturan/hari-libur:');
  const res = await post('/api/pengaturan/hari-libur', {
    tanggal: '2026-08-17',
    keterangan: 'Hari Kemerdekaan Republik Indonesia'
  });
  console.log('Status:', res.status, 'Response:', res.data);
}

test();
