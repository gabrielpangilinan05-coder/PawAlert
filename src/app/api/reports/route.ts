import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getPool } from "@/lib/db";
import { LIMITS, rateLimit, tooManyRequests } from "@/lib/rate-limit";

const REASONS = new Set([
  "spam",
  "harassment",
  "scam",
  "inappropriate",
  "misinformation",
  "other",
]);

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "login_required" }, { status: 401 });
  }

  const limited = rateLimit(`report:${user.id}`, LIMITS.report);
  if (!limited.ok) return tooManyRequests(limited.resetAt);

  const body = await req.json().catch(() => ({}));
  const targetType = String(body.target_type || "post");
  const targetId = Number(body.target_id || 0);
  const reason = String(body.reason || "").trim().toLowerCase();
  const details = String(body.details || "").trim().slice(0, 1000) || null;

  if (targetType !== "post" && targetType !== "user") {
    return NextResponse.json({ ok: false, error: "invalid_target" }, { status: 400 });
  }
  if (!targetId) {
    return NextResponse.json({ ok: false, error: "invalid_id" }, { status: 400 });
  }
  if (!REASONS.has(reason)) {
    return NextResponse.json({ ok: false, error: "invalid_reason" }, { status: 400 });
  }
  if (targetType === "user" && targetId === user.id) {
    return NextResponse.json({ ok: false, error: "cannot_report_self" }, { status: 400 });
  }

  const pool = getPool();
  if (targetType === "post") {
    const [rows] = await pool.query(`SELECT id FROM posts WHERE id = ? LIMIT 1`, [targetId]);
    if (!(rows as unknown[]).length) {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    }
  } else {
    const [rows] = await pool.query(`SELECT id FROM users WHERE id = ? LIMIT 1`, [targetId]);
    if (!(rows as unknown[]).length) {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    }
  }

  await pool.execute(
    `INSERT INTO reports (reporter_id, target_type, target_id, reason, details)
     VALUES (?, ?, ?, ?, ?)`,
    [user.id, targetType, targetId, reason, details],
  );

  return NextResponse.json({ ok: true });
}
