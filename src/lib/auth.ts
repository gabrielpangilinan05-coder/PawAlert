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
};

/** Deduped per request (layout + page share one DB hit). */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const session = await getSession();
  if (!session.userId) return null;

  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT id, name, email, phone, messenger, address
     FROM users WHERE id = ? LIMIT 1`,
    [session.userId],
  );
  const list = rows as User[];
  // Stale session id: treat as logged out. Do not session.save() here —
  // getCurrentUser runs from RootLayout, where cookies cannot be modified.
  if (!list[0]) return null;
  return list[0];
});

export { mediaUrl };
