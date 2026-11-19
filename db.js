/**
 * db.js - Kết nối SQL Server
 *  - DB_AUTH=windows : dùng driver msnodesqlv8 (ODBC) -> Windows Authentication
 *  - DB_AUTH=sql     : dùng driver tedious (mặc định của mssql) -> user/password
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const fs = require('fs');

const AUTH = (process.env.DB_AUTH || 'windows').toLowerCase();
const SERVER = process.env.DB_SERVER || 'localhost\\SQLEXPRESS';
const DB_NAME = process.env.DB_NAME || 'NPK';

let sql;
if (AUTH === 'windows') {
  try {
    sql = require('mssql/msnodesqlv8');
  } catch (e) {
    console.error('\n[DB] Không tải được driver msnodesqlv8 (cần cho Windows Authentication).');
    console.error('     Hãy chạy: npm install msnodesqlv8   hoặc đổi DB_AUTH=sql trong file .env\n');
    throw e;
  }
} else {
  sql = require('mssql');
}

function buildConfig(database = DB_NAME, extra = {}) {
  if (AUTH === 'windows') {
    const driver = process.env.DB_ODBC_DRIVER || 'ODBC Driver 17 for SQL Server';
    return {
      connectionString:
        `Driver={${driver}};Server=${SERVER};Database=${database};` +
        `Trusted_Connection=Yes;TrustServerCertificate=Yes;`,
      options: { useUTC: false },
      ...extra,
    };
  }
  // SQL Server Authentication (tedious)
  const [host, instanceName] = SERVER.split('\\');
  const cfg = {
    server: host === '.' ? 'localhost' : host,
    database,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    options: {
      encrypt: false,
      trustServerCertificate: true,
      useUTC: false,
    },
    ...extra,
  };
  if (process.env.DB_PORT) cfg.port = Number(process.env.DB_PORT);
  else if (instanceName) cfg.options.instanceName = instanceName;
  return cfg;
}

let poolPromise = null;
function getPool() {
  if (!poolPromise) {
    const pool = new sql.ConnectionPool(buildConfig(DB_NAME, { pool: { max: 10, min: 0, idleTimeoutMillis: 30000 } }));
    poolPromise = pool.connect().catch((err) => {
      poolPromise = null;
      throw err;
    });
  }
  return poolPromise;
}

/** Chạy 1 file .sql có nhiều batch phân tách bằng GO (trên 1 kết nối duy nhất) */
async function runSqlFile(filePath, database = 'master') {
  const text = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
  const batches = text
    .split(/^\s*GO\s*;?\s*$/gim)
    .map((b) => b.trim())
    .filter((b) => b.length > 0);

  const pool = new sql.ConnectionPool(buildConfig(database, { pool: { max: 1, min: 0 } }));
  await pool.connect();
  const results = [];
  try {
    for (const batch of batches) {
      const r = await pool.request().batch(batch);
      if (r.recordset) results.push(r.recordset);
    }
  } finally {
    await pool.close();
  }
  return results;
}

module.exports = { sql, getPool, runSqlFile, buildConfig, DB_NAME, SERVER, AUTH };
