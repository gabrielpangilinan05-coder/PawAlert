import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getPool } from "@/lib/db";
import { toggleFollow } from "@/lib/follows";
import { LIMITS, rateLimit, tooManyRequests } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "login_required" }, { status: 401 });
  }

  const limited = rateLimit(`follow:${user.id}`, LIMITS.write);
  if (!limited.ok) return tooManyRequests(limited.resetAt);

  const body = await req.json().catch(() => ({}));
  const targetId = Number(body.user_id || 0);
  if (!targetId || targetId === user.id) {
    return NextResponse.json({ ok: false, error: "invalid_user" }, { status: 400 });
  }

  const pool = getPool();
  const [rows] = await pool.query(`SELECT id FROM users WHERE id = ? LIMIT 1`, [targetId]);
  if (!(rows as unknown[]).length) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  const following = await toggleFollow(user.id, targetId);
  return NextResponse.json({ ok: true, following });
}
