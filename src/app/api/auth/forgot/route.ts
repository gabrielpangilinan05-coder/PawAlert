import { NextResponse } from "next/server";
import { z } from "zod";
import { getPool } from "@/lib/db";
import { getSession } from "@/lib/session";
import { createEmailOtp } from "@/lib/otp";
import { sendOtpEmail } from "@/lib/mail";
import { clientIp, LIMITS, rateLimit, tooManyRequests } from "@/lib/rate-limit";

const schema = z.object({
  email: z.string().email(),
});

function mailDevPreview(): boolean {
  return process.env.MAIL_DEV_MODE !== "false";
}

const GENERIC_OK =
  "If that email is registered, we sent a reset code to your inbox.";

export async function POST(req: Request) {
  const limited = rateLimit(`forgot:${clientIp(req)}`, LIMITS.authForgot);
  if (!limited.ok) return tooManyRequests(limited.resetAt);

  try {
    const body = schema.parse(await req.json());
    const email = body.email.trim().toLowerCase();
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT id, banned_at FROM users WHERE email = ? LIMIT 1`,
      [email],
    );
    const user = (rows as { id: number; banned_at: Date | null }[])[0];

    // Always look like success when the account is missing/banned (anti-enumeration).
    if (!user || user.banned_at) {
      return NextResponse.json({ ok: true, message: GENERIC_OK });
    }

    const code = await createEmailOtp(email, "reset");
    const mail = await sendOtpEmail(email, code, "reset");
    if (!mail.ok) {
      return NextResponse.json({ error: mail.error }, { status: 502 });
    }

    const session = await getSession();
    session.pendingReset = { userId: user.id, email };
    session.pendingRegister = undefined;
    if (mail.mode === "dev" || mailDevPreview()) {
      session.devOtpPreview = code;
    } else {
      session.devOtpPreview = undefined;
    }
    session.flash = {
      type: "success",
      message: "Enter the email code and choose a new password.",
    };
    await session.save();

    return NextResponse.json({
      ok: true,
      message: GENERIC_OK,
      dev: mail.mode === "dev" || mailDevPreview(),
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
    }
    console.error(err);
    return NextResponse.json({ error: "Could not start password reset." }, { status: 500 });
  }
}
