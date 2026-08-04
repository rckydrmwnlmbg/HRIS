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

async function checkRestoreHistory() {
  const { query } = await import('./lib/db');

  try {
    console.log('=== CHECK MSDB RESTORE HISTORY ===');
    const qRestore = `
      SELECT 
        rh.restore_date,
        rh.destination_database_name,
        rh.user_name,
        rh.restore_type,
        bs.backup_finish_date,
        bmf.physical_device_name
      FROM msdb.dbo.restorehistory rh
      LEFT JOIN msdb.dbo.backupset bs ON rh.backup_set_id = bs.backup_set_id
      LEFT JOIN msdb.dbo.backupmediafamily bmf ON bs.media_set_id = bmf.media_set_id
      ORDER BY rh.restore_date DESC;
    `;
    const resRestore = await query(qRestore);
    console.log('RESTORE HISTORY:', JSON.stringify(resRestore, null, 2));

    console.log('\n=== CHECK DATABASE CREATION / MODIFICATION DATE ===');
    const qDb = `
      SELECT name, create_date, state_desc 
      FROM sys.databases 
      WHERE name = 'PayrollSys';
    `;
    const resDb = await query(qDb);
    console.log('DB STATS:', JSON.stringify(resDb, null, 2));

  } catch (err) {
    console.error('ERROR:', err);
  } finally {
    process.exit(0);
  }
}

checkRestoreHistory();
