import { NextResponse } from "next/server";
import { z } from "zod";
import { getPool } from "@/lib/db";
import { getSession } from "@/lib/session";
import { createSmsOtp } from "@/lib/otp";
import { sendSms } from "@/lib/sms";
import { clientIp, LIMITS, rateLimit, tooManyRequests } from "@/lib/rate-limit";

const schema = z.object({
  email: z.string().email(),
});

function smsDevPreview(): boolean {
  return process.env.SMS_DEV_MODE !== "false";
}

const GENERIC_OK =
  "If that email is registered with a phone number, we sent a reset code by SMS.";

export async function POST(req: Request) {
  const limited = rateLimit(`forgot:${clientIp(req)}`, LIMITS.authForgot);
  if (!limited.ok) return tooManyRequests(limited.resetAt);

  try {
    const body = schema.parse(await req.json());
    const email = body.email.trim().toLowerCase();
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT id, phone, banned_at FROM users WHERE email = ? LIMIT 1`,
      [email],
    );
    const user = (rows as { id: number; phone: string | null; banned_at: Date | null }[])[0];

    // Always look like success when the account is missing/banned/no phone (anti-enumeration).
    if (!user || user.banned_at || !user.phone) {
      return NextResponse.json({ ok: true, message: GENERIC_OK });
    }

    const phone = user.phone;
    const code = await createSmsOtp(phone, "reset");
    const sms = await sendSms(
      phone,
      `PawAlert reset code: ${code}. Valid for 10 minutes. Do not share this code.`,
    );
    if (!sms.ok) {
      return NextResponse.json({ error: sms.error }, { status: 502 });
    }

    const session = await getSession();
    session.pendingReset = { userId: user.id, phone };
    session.pendingRegister = undefined;
    if (sms.mode === "dev" || smsDevPreview()) {
      session.devOtpPreview = code;
    } else {
      session.devOtpPreview = undefined;
    }
    session.flash = {
      type: "success",
      message: "Enter the SMS code and choose a new password.",
    };
    await session.save();

    return NextResponse.json({
      ok: true,
      message: GENERIC_OK,
      dev: sms.mode === "dev" || smsDevPreview(),
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
    }
    console.error(err);
    return NextResponse.json({ error: "Could not start password reset." }, { status: 500 });
  }
}
