import { NextResponse } from "next/server";
import { z } from "zod";
import { getPool } from "@/lib/db";
import { getSession } from "@/lib/session";
import { verifyEmailOtp } from "@/lib/otp";
import { clientIp, LIMITS, rateLimit, tooManyRequests } from "@/lib/rate-limit";

const schema = z.object({
  code: z.string().regex(/^\d{6}$/),
});

export async function POST(req: Request) {
  const limited = rateLimit(`verify:${clientIp(req)}`, LIMITS.authVerify);
  if (!limited.ok) return tooManyRequests(limited.resetAt);

  try {
    const body = schema.parse(await req.json());
    const session = await getSession();
    const pending = session.pendingRegister;
    if (!pending) {
      return NextResponse.json({ error: "No pending registration. Start again." }, { status: 400 });
    }

    if (!pending.email) {
      return NextResponse.json({ error: "No email on pending registration. Start again." }, { status: 400 });
    }

    const ok = await verifyEmailOtp(pending.email, body.code, "register");
    if (!ok) {
      return NextResponse.json({ error: "Invalid or expired code." }, { status: 400 });
    }

    const pool = getPool();
    const [result] = await pool.execute(
      `INSERT INTO users (name, email, phone, messenger, address, address_lat, address_lng, password_hash, email_verified_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        pending.name,
        pending.email,
        pending.phone,
        pending.messenger,
        pending.address,
        pending.addressLat ?? null,
        pending.addressLng ?? null,
        pending.passwordHash,
      ],
    );
    const insertId = Number((result as { insertId: number }).insertId);
    session.userId = insertId;
    session.pendingRegister = undefined;
    session.devOtpPreview = undefined;
    session.flash = { type: "success", message: "Account created. Welcome to PawAlert." };
    await session.save();
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Enter a 6-digit code." }, { status: 400 });
    }
    console.error(err);
    return NextResponse.json({ error: "Verification failed." }, { status: 500 });
  }
}
