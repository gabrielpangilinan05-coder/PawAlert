import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";

/** Increment post share_count when someone shares from the feed dialog. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const postId = Number(body.post_id || 0);
  if (!postId) {
    return NextResponse.json({ ok: false, error: "invalid_post" }, { status: 400 });
  }

  const pool = getPool();
  const [result] = await pool.execute(
    `UPDATE posts SET share_count = share_count + 1 WHERE id = ?`,
    [postId],
  );
  const affected = Number((result as { affectedRows?: number }).affectedRows || 0);
  if (!affected) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  const [rows] = await pool.query(`SELECT share_count FROM posts WHERE id = ? LIMIT 1`, [postId]);
  const shareCount = Number((rows as { share_count: number }[])[0]?.share_count ?? 0);

  return NextResponse.json({ ok: true, share_count: shareCount });
}
