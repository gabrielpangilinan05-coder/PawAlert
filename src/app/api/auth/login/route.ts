import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { getPool } from "@/lib/db";
import { getSession } from "@/lib/session";
import { clientIp, LIMITS, rateLimit, tooManyRequests } from "@/lib/rate-limit";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: Request) {
  const limited = rateLimit(`login:${clientIp(req)}`, LIMITS.authLogin);
  if (!limited.ok) return tooManyRequests(limited.resetAt);

  try {
    const body = schema.parse(await req.json());
    const email = body.email.trim().toLowerCase();
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT id, password_hash, banned_at FROM users WHERE email = ? LIMIT 1`,
      [email],
    );
    const user = (rows as { id: number; password_hash: string; banned_at: Date | null }[])[0];
    if (!user || !(await bcrypt.compare(body.password, user.password_hash))) {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }
    if (user.banned_at) {
      return NextResponse.json(
        { error: "This account has been suspended. Contact support if you think this is a mistake." },
        { status: 403 },
      );
    }
    const session = await getSession();
    session.userId = user.id;
    session.flash = { type: "success", message: "You’re logged in." };
    await session.save();
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input." }, { status: 400 });
    }
    console.error(err);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
