const isLocal = process.env.DB_SERVER === 'localhost' || process.env.DB_SERVER === '.\\SQLEXPRESS';
let sql: any;
if (process.env.NODE_ENV === 'development') {
  try {
    sql = require('mssql/msnodesqlv8');
  } catch {
    sql = require('mssql');
  }
} else {
  sql = require('mssql');
}

let serverHost = process.env.DS_DB_SERVER || 'localhost';
let instanceName = undefined;

if (serverHost.includes('\\')) {
  const parts = serverHost.split('\\');
  serverHost = parts[0];
  instanceName = parts[1];
}

if (serverHost === '.' || serverHost === '(local)' || serverHost === 'localhost') {
  serverHost = 'localhost';
}

const dsAppName = (process.env.DS_DB_APP_NAME || process.env.DB_APP_NAME || 'Payroll Management Support').replace(/^["']|["']$/g, '');
const dsWorkstationId = (process.env.DS_DB_WORKSTATION_ID || process.env.DB_WORKSTATION_ID || 'TMNB-D101-NILA').replace(/^["']|["']$/g, '');

const sqlConfig: any = {
  server: serverHost,
  port: parseInt(process.env.DS_DB_PORT || '1433', 10),
  database: process.env.DS_DB_NAME || 'DataSolution',
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  },
  connectionTimeout: 30000,
  requestTimeout: 120000,
  options: {
    useUTC: false,
    encrypt: false,
    trustServerCertificate: true,
    appName: dsAppName,
    workstationId: dsWorkstationId,
    connectTimeout: 30000
  }
};

if (instanceName) {
  sqlConfig.options.instanceName = instanceName;
}

sqlConfig.user = process.env.DS_DB_USER;
sqlConfig.password = process.env.DS_DB_PASS;

if (process.env.NODE_ENV === 'development') {
  const odbcDriver = process.env.DB_ODBC_DRIVER || 'ODBC Driver 18 for SQL Server';
  const odbcServer = instanceName ? `${serverHost}\\${instanceName}` : serverHost;

  let cs = `Driver={${odbcDriver}};Server=${odbcServer};Database=${sqlConfig.database};APP=${dsAppName};WSID=${dsWorkstationId};`;

  const useWindowsAuth = process.env.DB_TRUSTED === '1' || !process.env.DS_DB_USER;

  if (useWindowsAuth) {
    cs += 'Trusted_Connection=yes;';
  } else {
    cs += `Uid=${process.env.DS_DB_USER};Pwd=${process.env.DS_DB_PASS};`;
  }

  if (odbcDriver.includes('18')) {
    cs += 'Encrypt=no;TrustServerCertificate=yes;';
  }

  sqlConfig.connectionString = cs;
}

let dsPoolPromise: Promise<any> | null = null;

export async function getDsDbConnection() {
  if (process.env.DATA_MODE !== 'live') {
    throw new Error('Database connection is only available in live mode');
  }

  if (!dsPoolPromise) {
    console.log('Connecting to DataSolution SQL Server at', sqlConfig.server);
    const pool = new sql.ConnectionPool(sqlConfig);
    pool.on('error', (err: any) => {
      console.error('DataSolution SQL Server pool error:', err?.message || err);
      dsPoolPromise = null;
    });

    dsPoolPromise = pool
      .connect()
      .then((p: any) => {
        console.log('Connected to DataSolution SQL Server successfully');
        return p;
      })
      .catch((err: any) => {
        console.error('DataSolution Database Connection Failed! Bad Config: ', err);
        dsPoolPromise = null;
        throw err;
      });
  }
  return dsPoolPromise;
}

export async function dsQuery<T>(queryString: string, params?: Record<string, any>, isRetry = false): Promise<T[]> {
  try {
    const pool = await getDsDbConnection();
    const request = pool.request();

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        request.input(key, value);
      });
    }

    const result = await request.query(queryString);
    return result.recordset as T[];
  } catch (err: any) {
    const isConnErr = 
      err.code === 'ECONNRESET' || 
      err.code === 'ESOCKET' || 
      err.code === 'ETIMEDOUT' || 
      String(err.message || '').includes('closed') || 
      String(err.message || '').includes('ECONNRESET');

    if (isConnErr) {
      console.warn('Resetting broken DataSolution connection pool due to:', err.message || err.code);
      try {
        if (dsPoolPromise) {
          const p = await dsPoolPromise;
          await p.close();
        }
      } catch (_) {}
      dsPoolPromise = null;

      if (!isRetry) {
        console.log('Mencoba menyambung kembali (auto-retry) ke DataSolution SQL Server...');
        return dsQuery<T>(queryString, params, true);
      }
    }
    throw err;
  }
}

