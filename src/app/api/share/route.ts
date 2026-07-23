import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getPool } from "@/lib/db";
import { notifyPostShare } from "@/lib/notifications";
import { clientIp, LIMITS, rateLimit, tooManyRequests } from "@/lib/rate-limit";

/** Increment post share_count when someone shares from the feed dialog. */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  const key = user ? `share:u:${user.id}` : `share:ip:${clientIp(req)}`;
  const limited = rateLimit(key, LIMITS.share);
  if (!limited.ok) return tooManyRequests(limited.resetAt);

  const body = await req.json().catch(() => ({}));
  const postId = Number(body.post_id || 0);
  if (!postId) {
    return NextResponse.json({ ok: false, error: "invalid_post" }, { status: 400 });
  }

  const pool = getPool();
  const [result] = await pool.execute(
    `UPDATE posts SET share_count = share_count + 1 WHERE id = ? AND hidden_at IS NULL`,
    [postId],
  );
  const affected = Number((result as { affectedRows?: number }).affectedRows || 0);
  if (!affected) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  await notifyPostShare({
    postId,
    actorId: user?.id ?? null,
    actorName: user?.name ?? null,
  });

  const [rows] = await pool.query(`SELECT share_count FROM posts WHERE id = ? LIMIT 1`, [postId]);
  const shareCount = Number((rows as { share_count: number }[])[0]?.share_count ?? 0);

  return NextResponse.json({ ok: true, share_count: shareCount });
}
