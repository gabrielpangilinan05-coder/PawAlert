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
  const userId = Number(body.user_id || 0);
  const reason = String(body.reason || "").trim().slice(0, 255) || null;

  if (!userId) {
    return NextResponse.json({ ok: false, error: "invalid_user" }, { status: 400 });
  }
  if (userId === admin.id) {
    return NextResponse.json({ ok: false, error: "cannot_moderate_self" }, { status: 400 });
  }

  const pool = getPool();

  if (action === "ban") {
    await pool.execute(
      `UPDATE users SET banned_at = NOW(), ban_reason = ?, role = 'user' WHERE id = ?`,
      [reason || "Banned by moderator", userId],
    );
    return NextResponse.json({ ok: true, action: "ban" });
  }

  if (action === "unban") {
    await pool.execute(
      `UPDATE users SET banned_at = NULL, ban_reason = NULL WHERE id = ?`,
      [userId],
    );
    return NextResponse.json({ ok: true, action: "unban" });
  }

  if (action === "make_admin") {
    await pool.execute(
      `UPDATE users SET role = 'admin', banned_at = NULL, ban_reason = NULL WHERE id = ?`,
      [userId],
    );
    return NextResponse.json({ ok: true, action: "make_admin" });
  }

  if (action === "remove_admin") {
    await pool.execute(`UPDATE users SET role = 'user' WHERE id = ?`, [userId]);
    return NextResponse.json({ ok: true, action: "remove_admin" });
  }

  return NextResponse.json({ ok: false, error: "invalid_action" }, { status: 400 });
}
