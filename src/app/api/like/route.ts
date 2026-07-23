import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getPool } from "@/lib/db";
import { postLikeCount, togglePostLike } from "@/lib/social";
import { LIMITS, rateLimit, tooManyRequests } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "login_required" }, { status: 401 });
  }

  const limited = rateLimit(`like:${user.id}`, LIMITS.write);
  if (!limited.ok) return tooManyRequests(limited.resetAt);

  const body = await req.json().catch(() => ({}));
  const postId = Number(body.post_id || 0);
  if (!postId) {
    return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });
  }

  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT id FROM posts WHERE id = ? AND hidden_at IS NULL LIMIT 1`,
    [postId],
  );
  if (!(rows as unknown[]).length) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  const liked = await togglePostLike(postId, user.id);
  return NextResponse.json({
    ok: true,
    liked,
    count: await postLikeCount(postId),
  });
}
