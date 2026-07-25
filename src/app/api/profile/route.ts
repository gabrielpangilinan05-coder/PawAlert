import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getPool } from "@/lib/db";
import { normalizePhMobile } from "@/lib/phone";
import { LIMITS, rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { deleteStoredMedia, saveMediaFile } from "@/lib/upload";

export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Please log in." }, { status: 401 });
  }

  const limited = rateLimit(`profile:u:${user.id}`, LIMITS.create);
  if (!limited.ok) return tooManyRequests(limited.resetAt);

  try {
    const form = await req.formData();
    const name = String(form.get("name") || "").trim();
    const phoneRaw = String(form.get("phone") || "").trim();
    const messenger = String(form.get("messenger") || "").trim();
    const address = String(form.get("address") || "").trim();
    const latRaw = Number(form.get("addressLat"));
    const lngRaw = Number(form.get("addressLng"));
    const addressLat = Number.isFinite(latRaw) ? latRaw : null;
    const addressLng = Number.isFinite(lngRaw) ? lngRaw : null;
    const removeAvatar = String(form.get("remove_avatar") || "") === "1";
    const avatarFile = form.get("avatar");

    if (!name || name.length > 120) {
      return NextResponse.json({ error: "Enter a valid name." }, { status: 400 });
    }

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
    let currentAvatar: string | null = null;
    try {
      const [rows] = await pool.query(`SELECT avatar_path FROM users WHERE id = ? LIMIT 1`, [
        user.id,
      ]);
      currentAvatar = (rows as { avatar_path: string | null }[])[0]?.avatar_path ?? null;
    } catch (err) {
      if ((err as { code?: string }).code === "ER_BAD_FIELD_ERROR") {
        return NextResponse.json(
          { error: "Avatar not available yet. Run migration_user_avatar.sql on the database." },
          { status: 503 },
        );
      }
      throw err;
    }

    let nextAvatar = currentAvatar;
    if (removeAvatar) {
      nextAvatar = null;
    } else if (avatarFile instanceof File && avatarFile.size > 0) {
      const saved = await saveMediaFile(avatarFile, "avatars", "image");
      if (saved) nextAvatar = saved.path;
    }

    await pool.execute(
      `UPDATE users
       SET name = ?, phone = ?, messenger = ?, address = ?,
           address_lat = ?, address_lng = ?, avatar_path = ?
       WHERE id = ? AND banned_at IS NULL`,
      [
        name,
        phone,
        messenger || null,
        address || null,
        addressLat,
        addressLng,
        nextAvatar,
        user.id,
      ],
    );

    if (currentAvatar && currentAvatar !== nextAvatar) {
      await deleteStoredMedia(currentAvatar);
    }

    return NextResponse.json({ ok: true, avatarPath: nextAvatar });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not update profile." },
      { status: 400 },
    );
  }
}
