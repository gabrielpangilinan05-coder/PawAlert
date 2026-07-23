import mysql from "mysql2/promise";

const globalForDb = globalThis as unknown as {
  pawalertPool?: mysql.Pool;
};

function createAppPool(): mysql.Pool {
  const url = process.env.DATABASE_URL?.trim();
  if (url) {
    // mysql2 accepts a URI string; TS types are incomplete for createPool(string).
    return mysql.createPool(url as unknown as mysql.PoolOptions);
  }

  return mysql.createPool({
    host: process.env.DATABASE_HOST || "127.0.0.1",
    port: Number(process.env.DATABASE_PORT || 3306),
    user: process.env.DATABASE_USER || "root",
    password: process.env.DATABASE_PASSWORD || "",
    database: process.env.DATABASE_NAME || "pawalert",
    waitForConnections: true,
    connectionLimit: 10,
    namedPlaceholders: true,
  });
}

export function getPool(): mysql.Pool {
  if (!globalForDb.pawalertPool) {
    globalForDb.pawalertPool = createAppPool();
  }
  return globalForDb.pawalertPool;
}

export type Row = Record<string, unknown>;
