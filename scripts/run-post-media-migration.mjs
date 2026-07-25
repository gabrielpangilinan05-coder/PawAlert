import fs from "fs";
import mysql from "mysql2/promise";

function loadEnv(path) {
  const env = {};
  for (const line of fs.readFileSync(path, "utf8").split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i < 0) continue;
    let v = line.slice(i + 1);
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    env[line.slice(0, i)] = v;
  }
  return env;
}

const envPath = process.argv[2] || ".env.vercel.prod.tmp";
const env = loadEnv(envPath);
if (!env.DATABASE_URL) {
  console.error("DATABASE_URL missing");
  process.exit(1);
}

const sql = fs.readFileSync("sql/migration_post_media.sql", "utf8");
const statements = sql
  .split(/;\s*\n/)
  .map((s) => s.trim())
  .filter(Boolean);

const conn = await mysql.createConnection(env.DATABASE_URL);
try {
  for (const stmt of statements) {
    await conn.query(stmt);
  }
  console.log("prod_migration_ok");
} finally {
  await conn.end();
}
