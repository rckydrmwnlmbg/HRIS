import fs from 'fs';
import path from 'path';

process.env.NODE_ENV = 'development';
process.env.DATA_MODE = 'live';

try {
  const envContent = fs.readFileSync(path.resolve('.env.local'), 'utf-8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const [key, ...vals] = trimmed.split('=');
      process.env[key.trim()] = vals.join('=').trim();
    }
  });
} catch (e) {}

process.env.NODE_ENV = 'development';
process.env.DATA_MODE = 'live';

async function listDbs() {
  const { query } = await import('./lib/db');

  try {
    console.log('=== LIST ALL DATABASES ON SQLEXPRESS ===');
    const q = `SELECT name, create_date FROM sys.databases;`;
    const res = await query(q);
    console.log('DATABASES:', JSON.stringify(res, null, 2));

    console.log('\n=== CHECK CURRENT DB CONTEXT ===');
    const qCurrent = `SELECT DB_NAME() AS CURRENT_DB, @@SERVERNAME AS SERVER_NAME;`;
    const resCurrent = await query(qCurrent);
    console.log('CURRENT DB:', JSON.stringify(resCurrent, null, 2));

  } catch (err) {
    console.error('ERROR:', err);
  } finally {
    process.exit(0);
  }
}

listDbs();
