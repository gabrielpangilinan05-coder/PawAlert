import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getPool } from "@/lib/db";
import { addComment, listComments } from "@/lib/social";
import { userInitial } from "@/lib/format";
import { LIMITS, rateLimit, tooManyRequests } from "@/lib/rate-limit";

export async function GET(req: Request) {
  const postId = Number(new URL(req.url).searchParams.get("post_id") || 0);
  if (!postId) {
    return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });
  }

  const pool = getPool();
  const [rows] = await pool.query(`SELECT id FROM posts WHERE id = ? LIMIT 1`, [postId]);
  if (!(rows as unknown[]).length) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  const me = await getCurrentUser();
  const comments = await listComments(postId);
  return NextResponse.json({
    ok: true,
    comments,
    count: comments.length,
    me: me
      ? { id: me.id, name: me.name, initial: userInitial(me.name) }
      : null,
  });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "login_required" }, { status: 401 });
  }

  const limited = rateLimit(`comment:${user.id}`, LIMITS.write);
  if (!limited.ok) return tooManyRequests(limited.resetAt);

  const body = await req.json().catch(() => ({}));
  const postId = Number(body.post_id || 0);
  const text = String(body.body || "").trim();
  if (!postId) {
    return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });
  }
  if (!text) {
    return NextResponse.json({ ok: false, error: "empty" }, { status: 400 });
  }
  if (text.length > 1000) {
    return NextResponse.json({ ok: false, error: "too_long" }, { status: 400 });
  }

  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT id FROM posts WHERE id = ? AND hidden_at IS NULL LIMIT 1`,
    [postId],
  );
  if (!(rows as unknown[]).length) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  const comment = await addComment(postId, user.id, text);
  const { notifyPostComment } = await import("@/lib/notifications");
  await notifyPostComment({
    postId,
    actorId: user.id,
    actorName: user.name,
    excerpt: text.slice(0, 140),
  });
  const comments = await listComments(postId);
  return NextResponse.json({
    ok: true,
    comment,
    count: comments.length,
  });
}
