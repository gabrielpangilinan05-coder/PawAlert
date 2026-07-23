import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getPool } from "@/lib/db";
import { isAlertType, normalizeSpecies, saveMediaFile } from "@/lib/upload";
import { clientIp, LIMITS, rateLimit, tooManyRequests } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  const limited = rateLimit(
    user ? `post:u:${user.id}` : `post:ip:${clientIp(req)}`,
    LIMITS.create,
  );
  if (!limited.ok) return tooManyRequests(limited.resetAt);

  try {
    const form = await req.formData();
    const type = String(form.get("type") || "story");
    const allowed = ["story", "tip", "question", "found", "missing"];
    if (!allowed.includes(type)) {
      return NextResponse.json({ error: "Invalid post type." }, { status: 400 });
    }

    if (!user && type !== "found") {
      return NextResponse.json(
        { error: "Please log in to share stories, tips, or missing alerts." },
        { status: 401 },
      );
    }

    const title = String(form.get("title") || "").trim();
    const description = String(form.get("description") || "").trim();
    const species = normalizeSpecies(String(form.get("species") || "Other"));
    const location = String(form.get("location_text") || "").trim();
    const contactName = String(form.get("contact_name") || "").trim() || user?.name || null;
    const contactPhone = String(form.get("contact_phone") || "").trim();
    const contactEmail = String(form.get("contact_email") || "").trim().toLowerCase();
    const petIdRaw = String(form.get("pet_id") || "").trim();
    const alert = isAlertType(type);

    if (!title || !description) {
      return NextResponse.json({ error: "Title and description are required." }, { status: 400 });
    }
    if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
      return NextResponse.json({ error: "Enter a valid contact email." }, { status: 400 });
    }
    if (alert && !contactPhone && !contactEmail) {
      return NextResponse.json(
        { error: "Add a phone number or email so people can reach you." },
        { status: 400 },
      );
    }

    const mediaField = form.get("media");
    const media =
      typeof mediaField === "string"
        ? null
        : await saveMediaFile(mediaField, "posts", "media");

    const pool = getPool();
    let petId: number | null = null;

    if (petIdRaw && user) {
      const [check] = await pool.query(
        `SELECT id FROM pets WHERE id = ? AND user_id = ? LIMIT 1`,
        [Number(petIdRaw), user.id],
      );
      if ((check as unknown[]).length) {
        petId = Number(petIdRaw);
        if (type === "missing") {
          await pool.execute(
            `UPDATE pets SET status = 'missing', last_seen_text = COALESCE(?, last_seen_text) WHERE id = ?`,
            [location || null, petId],
          );
        }
      }
    }

    let postId: number | null = null;
    if (petId && type === "missing") {
      const [existing] = await pool.query(
        `SELECT id FROM posts WHERE pet_id = ? AND type = 'missing' AND status = 'open' LIMIT 1`,
        [petId],
      );
      const row = (existing as { id: number }[])[0];
      if (row) {
        await pool.execute(
          `UPDATE posts SET title = ?, description = ?, species = ?,
           photo_path = COALESCE(?, photo_path), media_type = COALESCE(?, media_type),
           location_text = ?, contact_name = ?, contact_phone = ?, contact_email = ?,
           updated_at = NOW() WHERE id = ?`,
          [
            title,
            description,
            species,
            media?.path ?? null,
            media?.type ?? null,
            location || null,
            contactName,
            alert && contactPhone ? contactPhone : null,
            alert && contactEmail ? contactEmail : null,
            row.id,
          ],
        );
        postId = row.id;
      }
    }

    if (postId === null) {
      const [result] = await pool.execute(
        `INSERT INTO posts (user_id, pet_id, type, title, description, species, photo_path, media_type, location_text, contact_name, contact_phone, contact_email)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          user?.id ?? null,
          petId,
          type,
          title,
          description,
          species,
          media?.path ?? null,
          media?.type ?? null,
          location || null,
          contactName,
          alert && contactPhone ? contactPhone : null,
          alert && contactEmail ? contactEmail : null,
        ],
      );
      postId = Number((result as { insertId: number }).insertId);
    }

    return NextResponse.json({ ok: true, id: postId });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not publish post." },
      { status: 400 },
    );
  }
}
