const isLocal = process.env.DB_SERVER === 'localhost' || process.env.DB_SERVER === '.\\SQLEXPRESS';
let sql: any;
if (process.env.NODE_ENV === 'development') {
  try {
    sql = require('mssql/msnodesqlv8');
  } catch {
    sql = require('mssql');
  }
} else {
  // In production / Vercel, we use pure tedious driver which avoids all native module compilation issues.
  sql = require('mssql');
}


let serverHost = process.env.DB_SERVER || 'localhost';
let instanceName = undefined;

if (serverHost.includes('\\')) {
  const parts = serverHost.split('\\');
  serverHost = parts[0];
  instanceName = parts[1];
}

if (serverHost === '.' || serverHost === '(local)' || serverHost === 'localhost') {
  serverHost = 'localhost'; // tedious requires 'localhost' instead of '.'
}

const sqlConfig: any = {
  server: serverHost,
  database: process.env.DB_NAME,
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  },
  requestTimeout: 120000,
  options: {
    useUTC: false,
    encrypt: false,
    trustServerCertificate: true
  }
};

if (instanceName) {
  sqlConfig.options.instanceName = instanceName;
}

// Tedious requires user and password for SQL Server Auth
sqlConfig.user = process.env.DB_USER;
sqlConfig.password = process.env.DB_PASS;

/**
 * Driver msnodesqlv8 (dipakai saat development) berjalan di atas ODBC, dan ODBC WAJIB
 * diberi nama driver secara eksplisit. Konfigurasi objek `server`/`instanceName` saja
 * tidak cukup -- hasilnya error:
 *   [Microsoft][ODBC Driver Manager] Data source name not found and no default driver specified
 *
 * Karena itu untuk development kita bangun connectionString ODBC sendiri. Nama driver
 * bisa diatur lewat DB_ODBC_DRIVER di .env.local; defaultnya ODBC Driver 18.
 *
 * Produksi tetap memakai konfigurasi objek di atas (driver tedious murni), tidak berubah.
 */
if (process.env.NODE_ENV === 'development') {
  const odbcDriver = process.env.DB_ODBC_DRIVER || 'ODBC Driver 18 for SQL Server';

  // Nama server untuk ODBC memakai format 'HOST\INSTANCE'.
  const odbcServer = instanceName ? `${serverHost}\\${instanceName}` : serverHost;

  let cs = `Driver={${odbcDriver}};Server=${odbcServer};Database=${process.env.DB_NAME};`;

  // DB_TRUSTED=1 memaksa Windows Auth. Dipakai di laptop, karena login SQL 'sa'
  // milik server kantor tidak berlaku di SQLEXPRESS lokal (error 18456 Login failed).
  // Kalau DB_USER tidak diisi, Windows Auth juga otomatis dipakai.
  const useWindowsAuth = process.env.DB_TRUSTED === '1' || !process.env.DB_USER;

  if (useWindowsAuth) {
    cs += 'Trusted_Connection=yes;';
  } else {
    cs += `Uid=${process.env.DB_USER};Pwd=${process.env.DB_PASS};`;
  }

  // ODBC Driver 18 default-nya Encrypt=yes dan akan menolak sertifikat self-signed.
  if (odbcDriver.includes('18')) {
    cs += 'Encrypt=no;TrustServerCertificate=yes;';
  }

  sqlConfig.connectionString = cs;
}


let poolPromise: Promise<any> | null = null;

export async function getDbConnection() {
  if (process.env.DATA_MODE !== 'live') {
    throw new Error('Database connection is only available in live mode');
  }

  if (!poolPromise) {
    console.log('Connecting to SQL Server at', sqlConfig.server, '(Fresh Pool Init)');
    poolPromise = new sql.ConnectionPool(sqlConfig)
      .connect()
      .then((pool: any) => {
        console.log('Connected to SQL Server successfully');
        return pool;
      })
      .catch((err: any) => {
        console.error('Database Connection Failed! Bad Config: ', err);
        poolPromise = null;
        throw err;
      });
  }
  return poolPromise;
}

export async function query<T>(queryString: string, params?: Record<string, any>): Promise<T[]> {
  const pool = await getDbConnection();
  const request = pool.request();

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      request.input(key, value);
    });
  }

  const result = await request.query(queryString);
  return result.recordset as T[];
}

/**
 * Menjalankan beberapa statement dalam SATU transaksi (BEGIN TRAN / COMMIT).
 *
 * Kenapa perlu: `query()` di atas menjalankan tiap statement berdiri sendiri.
 * Kalau proses multi-langkah gagal di tengah (misal tblCUTI sudah masuk tapi
 * tbldetcuti belum), data tertinggal setengah jadi tanpa cara otomatis
 * membatalkannya. Helper ini rollback semuanya kalau ada yang gagal.
 *
 * Dipakai BERSAMA `query()`, bukan menggantikannya, supaya endpoint lain
 * yang sudah stabil tidak terpengaruh.
 *
 * Contoh:
 *   await withTransaction(async (tx) => {
 *     await tx('INSERT INTO ... VALUES (@a)', { a: 1 });
 *     await tx('UPDATE ... WHERE x = @b', { b: 2 });
 *   });
 *
 * Callback menerima fungsi `tx(sqlString, params)` yang selalu memakai
 * parameterized input, sehingga tidak ada interpolasi string ke SQL.
 */
export async function withTransaction<T>(
  fn: (tx: <R>(sqlString: string, params?: Record<string, any>) => Promise<R[]>) => Promise<T>
): Promise<T> {
  const pool = await getDbConnection();
  const transaction = new sql.Transaction(pool);

  await transaction.begin();

  // Penanda supaya tidak mencoba rollback dua kali kalau commit sendiri yang gagal.
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
  } catch (err) {
    if (!committed) {
      try {
        await transaction.rollback();
      } catch (rollbackErr) {
        // Rollback bisa gagal kalau koneksi sudah putus. Error aslinya lebih
        // penting untuk dilaporkan, jadi kegagalan rollback hanya dicatat.
        console.error('Rollback gagal:', rollbackErr);
      }
    }
    throw err;
  }
}
