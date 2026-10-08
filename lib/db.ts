import { Pool } from 'pg';

const isPostgres = !!(
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.SUPABASE_DB_URL ||
  process.env.DB_TYPE === 'postgres'
);

// -----------------------------------------------------------------------------
// POSTGRESQL / SUPABASE ENGINE
// -----------------------------------------------------------------------------
let pgPool: Pool | null = null;

function getPgPool(): Pool {
  if (!pgPool) {
    const connectionString =
      process.env.DATABASE_URL ||
      process.env.POSTGRES_URL ||
      process.env.SUPABASE_DB_URL;

    console.log('Connecting to PostgreSQL / Supabase...');
    pgPool = new Pool({
      connectionString,
      ssl: connectionString?.includes('localhost') ? false : { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    pgPool.on('error', (err) => {
      console.error('PostgreSQL Pool Error:', err);
      pgPool = null;
    });
  }
  return pgPool;
}

function normalizeForPostgres(sqlString: string, params?: Record<string, any>): { text: string; values: any[] } {
  let text = sqlString;
  const values: any[] = [];

  // 1. Hapus T-SQL table hints
  text = text.replace(/WITH\s*\(\s*(NOLOCK|HOLDLOCK)\s*\)/gi, '');

  // 2. Mapping @param ke $1, $2, ...
  if (params && Object.keys(params).length > 0) {
    const keys = Object.keys(params).sort((a, b) => b.length - a.length);
    keys.forEach((key) => {
      const regex = new RegExp(`@${key}\\b`, 'g');
      if (regex.test(text)) {
        values.push(params[key]);
        const idx = values.length;
        text = text.replace(regex, `$${idx}`);
      }
    });
  }

  // 3. Konversi format fungsi CONVERT T-SQL ke PostgreSQL
  text = text.replace(/CONVERT\s*\(\s*varchar\s*\(\s*10\s*\)\s*,\s*([^,]+?)\s*,\s*120\s*\)/gi, "TO_CHAR($1, 'YYYY-MM-DD')");
  text = text.replace(/CONVERT\s*\(\s*varchar\s*\(\s*19\s*\)\s*,\s*([^,]+?)\s*,\s*120\s*\)/gi, "TO_CHAR($1, 'YYYY-MM-DD HH24:MI:SS')");
  text = text.replace(/CONVERT\s*\(\s*varchar\s*\(\s*8\s*\)\s*,\s*([^,]+?)\s*,\s*108\s*\)/gi, "TO_CHAR($1, 'HH24:MI:SS')");
  text = text.replace(/CONVERT\s*\(\s*varchar\s*\(\s*5\s*\)\s*,\s*([^,]+?)\s*,\s*108\s*\)/gi, "TO_CHAR($1, 'HH24:MI')");
  text = text.replace(/CONVERT\s*\(\s*date\s*,\s*([^)]+?)\s*\)/gi, 'CAST($1 AS date)');
  text = text.replace(/CONVERT\s*\(\s*varchar\s*\(\s*(\d+)\s*\)\s*,\s*([^)]+?)\s*\)/gi, 'CAST($2 AS varchar($1))');

  // 4. Ubah SELECT TOP n menjadi LIMIT n
  const topMatch = text.match(/^\s*SELECT\s+TOP\s+(\d+)\s+/i);
  if (topMatch) {
    const limitNum = topMatch[1];
    text = text.replace(/^\s*SELECT\s+TOP\s+\d+\s+/i, 'SELECT ');
    if (!/LIMIT\s+\d+/i.test(text)) {
      text = `${text} LIMIT ${limitNum}`;
    }
  }

  // 5. Hapus Collation SQL Server jika ada
  text = text.replace(/COLLATE\s+Latin1_General_CI_AS/gi, '');

  return { text, values };
}

function normalizeRows<T>(rows: any[]): T[] {
  if (!rows || !Array.isArray(rows)) return [] as T[];
  return rows.map((row) => {
    if (!row || typeof row !== 'object') return row;
    const obj: any = {};
    for (const [key, value] of Object.entries(row)) {
      obj[key] = value;
      obj[key.toUpperCase()] = value;
    }
    return obj;
  }) as T[];
}

// -----------------------------------------------------------------------------
// MSSQL (SQL SERVER) ENGINE (FALLBACK JIKA MENGGUNAKAN MSSQL)
// -----------------------------------------------------------------------------
let sql: any;
if (!isPostgres) {
  if (process.env.NODE_ENV === 'development') {
    try {
      sql = require('mssql/msnodesqlv8');
    } catch {
      sql = require('mssql');
    }
  } else {
    sql = require('mssql');
  }
}

let serverHost = process.env.DB_SERVER || 'localhost';
let instanceName = undefined;

if (serverHost.includes('\\')) {
  const parts = serverHost.split('\\');
  serverHost = parts[0];
  instanceName = parts[1];
}

if (serverHost === '.' || serverHost === '(local)' || serverHost === 'localhost') {
  serverHost = 'localhost';
}

const appName = (process.env.DB_APP_NAME || 'Payroll Management Support').replace(/^["']|["']$/g, '');
const workstationId = (process.env.DB_WORKSTATION_ID || 'TMNB-D101-NILA').replace(/^["']|["']$/g, '');

const sqlConfig: any = {
  server: serverHost,
  port: parseInt(process.env.DB_PORT || '1433', 10),
  database: process.env.DB_NAME,
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
  connectionTimeout: 30000,
  requestTimeout: 120000,
  options: {
    useUTC: false,
    encrypt: false,
    trustServerCertificate: true,
    appName: appName,
    workstationId: workstationId,
    connectTimeout: 30000,
  },
};

if (instanceName) {
  sqlConfig.options.instanceName = instanceName;
}

sqlConfig.user = process.env.DB_USER;
sqlConfig.password = process.env.DB_PASS;

if (!isPostgres && process.env.NODE_ENV === 'development') {
  const odbcDriver = process.env.DB_ODBC_DRIVER || 'ODBC Driver 18 for SQL Server';
  const odbcServer = instanceName ? `${serverHost}\\${instanceName}` : serverHost;
  let cs = `Driver={${odbcDriver}};Server=${odbcServer};Database=${process.env.DB_NAME};APP=${appName};WSID=${workstationId};`;
  const useWindowsAuth = process.env.DB_TRUSTED === '1' || !process.env.DB_USER;

  if (useWindowsAuth) {
    cs += 'Trusted_Connection=yes;';
  } else {
    cs += `Uid=${process.env.DB_USER};Pwd=${process.env.DB_PASS};`;
  }

  if (odbcDriver.includes('18')) {
    cs += 'Encrypt=no;TrustServerCertificate=yes;';
  }

  sqlConfig.connectionString = cs;
}

let mssqlPoolPromise: Promise<any> | null = null;

export async function getDbConnection() {
  if (process.env.DATA_MODE !== 'live') {
    throw new Error('Database connection is only available in live mode');
  }

  if (isPostgres) {
    const pool = getPgPool();
    return {
      request: () => {
        return {
          input: () => {},
          query: async (q: string) => {
            const { text, values } = normalizeForPostgres(q);
            const res = await pool.query(text, values);
            return { recordset: normalizeRows(res.rows) };
          },
        };
      },
    };
  }

  if (!mssqlPoolPromise) {
    console.log('Connecting to SQL Server at', sqlConfig.server, '(Fresh Pool Init)');
    const pool = new sql.ConnectionPool(sqlConfig);
    pool.on('error', (err: any) => {
      console.error('SQL Server pool error:', err?.message || err);
      mssqlPoolPromise = null;
    });

    mssqlPoolPromise = pool
      .connect()
      .then((p: any) => {
        console.log('Connected to SQL Server successfully');
        return p;
      })
      .catch((err: any) => {
        console.error('Database Connection Failed! Bad Config: ', err);
        mssqlPoolPromise = null;
        throw err;
      });
  }
  return mssqlPoolPromise;
}

export async function query<T>(queryString: string, params?: Record<string, any>): Promise<T[]> {
  try {
    if (isPostgres) {
      const pool = getPgPool();
      const { text, values } = normalizeForPostgres(queryString, params);
      const res = await pool.query(text, values);
      return normalizeRows<T>(res.rows);
    }

    const pool = await getDbConnection();
    const request = pool.request();

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        request.input(key, value);
      });
    }

    const result = await request.query(queryString);
    return result.recordset as T[];
  } catch (err: any) {
    if (
      err?.code === 'ECONNRESET' ||
      err?.code === 'EPIPE' ||
      err?.code === 'ETIMEDOUT' ||
      err?.code === 'EINVALIDSTATE' ||
      err?.name === 'ConnectionError'
    ) {
      mssqlPoolPromise = null;
      pgPool = null;
    }
    throw err;
  }
}

export async function withTransaction<T>(
  fn: (tx: <R>(sqlString: string, params?: Record<string, any>) => Promise<R[]>) => Promise<T>
): Promise<T> {
  if (isPostgres) {
    const pool = getPgPool();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const tx = async <R>(sqlString: string, params?: Record<string, any>): Promise<R[]> => {
        const { text, values } = normalizeForPostgres(sqlString, params);
        const res = await client.query(text, values);
        return normalizeRows<R>(res.rows);
      };
      const output = await fn(tx);
      await client.query('COMMIT');
      return output;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  const pool = await getDbConnection();
  const transaction = new sql.Transaction(pool);
  await transaction.begin();

  let committed = false;
  const tx = async <R>(sqlString: string, params?: Record<string, any>): Promise<R[]> => {
    const request = new sql.Request(transaction);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        request.input(key, value);
      });
    }
    const result = await request.query(sqlString);
    return (result.recordset || []) as R[];
  };

  try {
    const output = await fn(tx);
    await transaction.commit();
    committed = true;
    return output;
  } catch (err: any) {
    if (err?.code === 'ECONNRESET' || err?.code === 'EPIPE' || err?.code === 'ETIMEDOUT') {
      mssqlPoolPromise = null;
    }
    if (!committed) {
      try {
        await transaction.rollback();
      } catch (rollbackErr) {
        console.error('Rollback gagal:', rollbackErr);
      }
    }
    throw err;
  }
}
