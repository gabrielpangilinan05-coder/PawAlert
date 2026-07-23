import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { unreadMessageCount } from "@/lib/messages";
import { getPool } from "@/lib/db";

/** Lightweight unread counts for header / polling. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: true, messages: 0, comments: 0 });
  }

  const messages = await unreadMessageCount(user.id);

  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS c
     FROM post_comments c
     INNER JOIN posts p ON p.id = c.post_id
     WHERE p.user_id = ? AND c.user_id <> ?`,
    [user.id, user.id],
  );
  const comments = Number((rows as { c: number }[])[0]?.c ?? 0);

  return NextResponse.json({ ok: true, messages, comments });
}
