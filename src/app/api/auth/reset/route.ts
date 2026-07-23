import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { getPool } from "@/lib/db";
import { getSession } from "@/lib/session";
import { verifySmsOtp } from "@/lib/otp";
import { clientIp, LIMITS, rateLimit, tooManyRequests } from "@/lib/rate-limit";

const schema = z.object({
  code: z.string().regex(/^\d{6}$/),
  password: z.string().min(6),
  passwordConfirm: z.string().min(6),
});

export async function POST(req: Request) {
  const limited = rateLimit(`reset:${clientIp(req)}`, LIMITS.authReset);
  if (!limited.ok) return tooManyRequests(limited.resetAt);

  try {
    const body = schema.parse(await req.json());
    if (body.password !== body.passwordConfirm) {
      return NextResponse.json({ error: "Passwords do not match." }, { status: 400 });
    }

    const session = await getSession();
    const pending = session.pendingReset;
    if (!pending?.userId || !pending.phone) {
      return NextResponse.json(
        { error: "No pending reset. Request a new code from Forgot password." },
        { status: 400 },
      );
    }

    const ok = await verifySmsOtp(pending.phone, body.code, "reset");
    if (!ok) {
      return NextResponse.json({ error: "Invalid or expired code." }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(body.password, 10);
    const pool = getPool();
    const [result] = await pool.execute(
      `UPDATE users SET password_hash = ? WHERE id = ? AND banned_at IS NULL`,
      [passwordHash, pending.userId],
    );
    const affected = Number((result as { affectedRows?: number }).affectedRows || 0);
    if (!affected) {
      return NextResponse.json({ error: "Account unavailable." }, { status: 400 });
    }

    session.pendingReset = undefined;
    session.devOtpPreview = undefined;
    session.userId = pending.userId;
    session.flash = { type: "success", message: "Password updated. You’re logged in." };
    await session.save();

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Check the code and password fields." }, { status: 400 });
    }
    console.error(err);
    return NextResponse.json({ error: "Could not reset password." }, { status: 500 });
  }
}
