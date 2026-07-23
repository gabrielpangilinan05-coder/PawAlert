import { getPool } from "@/lib/db";
import bcrypt from "bcryptjs";

export async function createOtp(
  channel: "email" | "phone",
  destination: string,
  purpose = "register",
): Promise<string> {
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const hash = await bcrypt.hash(code, 10);
  const expires = new Date(Date.now() + 10 * 60 * 1000);
  const pool = getPool();
  await pool.execute(
    `INSERT INTO otps (channel, destination, code_hash, purpose, expires_at)
     VALUES (?, ?, ?, ?, ?)`,
    [channel, destination, hash, purpose, expires],
  );
  return code;
}

export async function createEmailOtp(email: string, purpose = "register"): Promise<string> {
  return createOtp("email", email, purpose);
}

export async function createSmsOtp(phone09: string, purpose = "register"): Promise<string> {
  return createOtp("phone", phone09, purpose);
}

export async function verifyOtp(
  destination: string,
  code: string,
  purpose = "register",
): Promise<boolean> {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT id, code_hash FROM otps
     WHERE destination = ? AND purpose = ? AND used_at IS NULL AND expires_at > NOW()
     ORDER BY id DESC LIMIT 5`,
    [destination, purpose],
  );
  const list = rows as { id: number; code_hash: string }[];
  for (const row of list) {
    if (await bcrypt.compare(code, row.code_hash)) {
      await pool.execute(`UPDATE otps SET used_at = NOW() WHERE id = ?`, [row.id]);
      return true;
    }
  }
  return false;
}

export async function verifyEmailOtp(
  email: string,
  code: string,
  purpose = "register",
): Promise<boolean> {
  return verifyOtp(email, code, purpose);
}

export async function verifySmsOtp(
  phone09: string,
  code: string,
  purpose = "register",
): Promise<boolean> {
  return verifyOtp(phone09, code, purpose);
}
