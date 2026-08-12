import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());
process.env.DATA_MODE = 'live';
process.env.NODE_ENV = 'development';

import { POST } from '../app/api/absensi/sync-datasolution/route';

async function run() {
  const req = new Request('http://localhost/api', {
    method: 'POST',
    body: JSON.stringify({ startDate: '2026-08-10', endDate: '2026-08-10' })
  });
  
  const res = await POST(req);
  console.log('Status:', res.status);
  const data = await res.json();
  console.log('Response:', data);
}

run().catch(console.error);
