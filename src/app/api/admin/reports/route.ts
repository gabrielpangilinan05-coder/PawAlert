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
  const reportId = Number(body.report_id || 0);

  if (!reportId || !["resolve", "dismiss"].includes(action)) {
    return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });
  }

  const status = action === "resolve" ? "resolved" : "dismissed";
  const pool = getPool();
  await pool.execute(
    `UPDATE reports
     SET status = ?, resolved_by = ?, resolved_at = NOW()
     WHERE id = ? AND status = 'open'`,
    [status, admin.id, reportId],
  );

  return NextResponse.json({ ok: true, action, status });
}
