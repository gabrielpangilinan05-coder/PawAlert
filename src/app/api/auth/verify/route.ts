import { NextResponse } from "next/server";
import { z } from "zod";
import { getPool } from "@/lib/db";
import { getSession } from "@/lib/session";
import { verifySmsOtp } from "@/lib/otp";

const schema = z.object({
  code: z.string().regex(/^\d{6}$/),
});

export async function POST(req: Request) {
  try {
    const body = schema.parse(await req.json());
    const session = await getSession();
    const pending = session.pendingRegister;
    if (!pending) {
      return NextResponse.json({ error: "No pending registration. Start again." }, { status: 400 });
    }

    if (!pending.phone) {
      return NextResponse.json({ error: "No phone on pending registration. Start again." }, { status: 400 });
    }

    const ok = await verifySmsOtp(pending.phone, body.code, "register");
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
