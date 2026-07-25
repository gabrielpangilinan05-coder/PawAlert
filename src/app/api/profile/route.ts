import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { getPool } from "@/lib/db";
import { normalizePhMobile } from "@/lib/phone";
import { LIMITS, rateLimit, tooManyRequests } from "@/lib/rate-limit";

const schema = z.object({
  name: z.string().min(1).max(120),
  phone: z.string().optional(),
  messenger: z.string().max(190).optional(),
  address: z.string().max(255).optional(),
  addressLat: z.number().finite().nullable().optional(),
  addressLng: z.number().finite().nullable().optional(),
});

export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Please log in." }, { status: 401 });
  }

  const limited = rateLimit(`profile:u:${user.id}`, LIMITS.create);
  if (!limited.ok) return tooManyRequests(limited.resetAt);

  try {
    const body = schema.parse(await req.json());
    const phoneRaw = (body.phone || "").trim();
    let phone: string | null = null;
    if (phoneRaw) {
      phone = normalizePhMobile(phoneRaw);
      if (!phone) {
        return NextResponse.json(
          { error: "Enter a valid PH mobile number (e.g. 09XXXXXXXXX)." },
          { status: 400 },
        );
      }
    }

    const pool = getPool();
    await pool.execute(
      `UPDATE users
       SET name = ?, phone = ?, messenger = ?, address = ?, address_lat = ?, address_lng = ?
       WHERE id = ? AND banned_at IS NULL`,
      [
        body.name.trim(),
        phone,
        body.messenger?.trim() || null,
        body.address?.trim() || null,
        body.addressLat ?? null,
        body.addressLng ?? null,
        user.id,
      ],
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Check your profile fields." }, { status: 400 });
    }
    console.error(err);
    return NextResponse.json({ error: "Could not update profile." }, { status: 500 });
  }
}
