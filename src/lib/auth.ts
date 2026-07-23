import { cache } from "react";
import { getPool } from "@/lib/db";
import { getSession } from "@/lib/session";
import { mediaUrl } from "@/lib/media";

export type User = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  messenger: string | null;
  address: string | null;
  role: "user" | "admin";
};

type UserRow = User & { banned_at: Date | string | null };

function emailIsBootstrapAdmin(email: string): boolean {
  const set = new Set(
    (process.env.ADMIN_EMAILS || "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
  return set.has(email.trim().toLowerCase());
}

/** Deduped per request (layout + page share one DB hit). */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const session = await getSession();
  if (!session.userId) return null;

  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT id, name, email, phone, messenger, address, role, banned_at
     FROM users WHERE id = ? LIMIT 1`,
    [session.userId],
  );
  const list = rows as UserRow[];
  const row = list[0];
  // Stale session id: treat as logged out. Do not session.save() here —
  // getCurrentUser runs from RootLayout, where cookies cannot be modified.
  if (!row) return null;
  if (row.banned_at) return null;

  let role: "user" | "admin" = row.role === "admin" ? "admin" : "user";
  if (role !== "admin" && emailIsBootstrapAdmin(row.email)) {
    role = "admin";
    void pool.execute(`UPDATE users SET role = 'admin' WHERE id = ? AND role <> 'admin'`, [row.id]);
  }

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    messenger: row.messenger,
    address: row.address,
    role,
  };
});

export { mediaUrl };
