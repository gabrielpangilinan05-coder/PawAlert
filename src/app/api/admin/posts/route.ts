import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin";
import { getPool } from "@/lib/db";
import { clientIp, LIMITS, rateLimit, tooManyRequests } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const admin = await requireAdminApi();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const limited = rateLimit(`admin:${admin.id}:${clientIp(req)}`, LIMITS.write);
  if (!limited.ok) return tooManyRequests(limited.resetAt);

  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "");
  const postId = Number(body.post_id || 0);
  const reason = String(body.reason || "").trim().slice(0, 255) || null;

  if (!postId) {
    return NextResponse.json({ ok: false, error: "invalid_post" }, { status: 400 });
  }

  const pool = getPool();

  if (action === "hide") {
    await pool.execute(
      `UPDATE posts SET hidden_at = NOW(), hidden_reason = ? WHERE id = ?`,
      [reason || "Hidden by moderator", postId],
    );
    return NextResponse.json({ ok: true, action: "hide" });
  }

  if (action === "unhide") {
    await pool.execute(
      `UPDATE posts SET hidden_at = NULL, hidden_reason = NULL WHERE id = ?`,
      [postId],
    );
    return NextResponse.json({ ok: true, action: "unhide" });
  }

  if (action === "delete") {
    await pool.execute(`DELETE FROM posts WHERE id = ?`, [postId]);
    return NextResponse.json({ ok: true, action: "delete" });
  }

  return NextResponse.json({ ok: false, error: "invalid_action" }, { status: 400 });
}
