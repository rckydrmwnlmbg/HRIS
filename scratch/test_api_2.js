const http = require('http');

const dates = [
  { in: '2026-07-02T06:52:05.000', out: '2026-07-02T23:02:11.000' },
  { in: '2026-07-03T06:51:05.000', out: '2026-07-03T21:04:49.000' }
];

dates.forEach(d => {
  const payload = JSON.stringify({
    EMP_CD: '24115275',
    DATE_TRANS: d.in.substring(0, 10),
    WORK_IN: d.in,
    WORK_OUT: d.out,
    corrected_shift: '1',
    corrected_status: 'KERJA',
    corrected_reason: '-'
  });

  const req = http.request({
    hostname: '127.0.0.1', port: 3000, path: '/api/absensi/koreksi', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': payload.length }
  }, res => {
    let data = ''; res.on('data', chunk => data += chunk);
    res.on('end', () => console.log('Response for', d.in.substring(0, 10), ':', data));
  });
  req.write(payload); req.end();
});
