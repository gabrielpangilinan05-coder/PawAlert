import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { getPool } from "@/lib/db";
import { getSession } from "@/lib/session";
import { createSmsOtp } from "@/lib/otp";
import { normalizePhMobile } from "@/lib/phone";
import { sendSms } from "@/lib/sms";

const schema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(1),
  messenger: z.string().optional(),
  address: z.string().optional(),
  addressLat: z.number().finite().nullable().optional(),
  addressLng: z.number().finite().nullable().optional(),
  password: z.string().min(6),
  passwordConfirm: z.string().min(6),
});

function smsDevPreview(): boolean {
  return process.env.SMS_DEV_MODE !== "false";
}

export async function POST(req: Request) {
  try {
    const body = schema.parse(await req.json());
    if (body.password !== body.passwordConfirm) {
      return NextResponse.json({ error: "Passwords do not match." }, { status: 400 });
    }

    const phone = normalizePhMobile(body.phone);
    if (!phone) {
      return NextResponse.json(
        { error: "Enter a valid PH mobile number (e.g. 09XXXXXXXXX)." },
        { status: 400 },
      );
    }

    const email = body.email.trim().toLowerCase();
    const pool = getPool();
    const [exists] = await pool.query(`SELECT id FROM users WHERE email = ? LIMIT 1`, [email]);
    if ((exists as unknown[]).length > 0) {
      return NextResponse.json({ error: "That email is already registered." }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(body.password, 10);
    const code = await createSmsOtp(phone, "register");
    const sms = await sendSms(
      phone,
      `PawAlert code: ${code}. Valid for 10 minutes. Do not share this code.`,
    );
    if (!sms.ok) {
      return NextResponse.json({ error: sms.error }, { status: 502 });
    }

    const session = await getSession();
    session.pendingRegister = {
      name: body.name.trim(),
      email,
      phone,
      messenger: body.messenger?.trim() || null,
      address: body.address?.trim() || null,
      addressLat: body.addressLat ?? null,
      addressLng: body.addressLng ?? null,
      passwordHash,
    };
    if (sms.mode === "dev" || smsDevPreview()) {
      session.devOtpPreview = code;
    }
    session.flash = {
      type: "success",
      message: "Enter the SMS code to finish signup.",
    };
    await session.save();
    return NextResponse.json({ ok: true, dev: sms.mode === "dev" || smsDevPreview() });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Check your form fields." }, { status: 400 });
    }
    console.error(err);
    return NextResponse.json({ error: "Could not start verification." }, { status: 500 });
  }
}
