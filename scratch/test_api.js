const http = require('http');

const payload = JSON.stringify({
  EMP_CD: '24115275',
  DATE_TRANS: '2026-07-06',
  WORK_IN: '2026-07-06T06:56:53.000',
  WORK_OUT: '2026-07-06T21:03:11.000',
  corrected_shift: '1',
  corrected_status: 'KERJA',
  corrected_reason: '-'
});

const options = {
  hostname: '127.0.0.1',
  port: 3000,
  path: '/api/absensi/koreksi',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': payload.length
  }
};

const req = http.request(options, res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('Response:', data));
});

req.on('error', error => console.error(error));
req.write(payload);
req.end();
