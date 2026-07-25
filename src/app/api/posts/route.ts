import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getPool } from "@/lib/db";
import {
  isAlertType,
  normalizeSpecies,
  saveMediaFile,
  saveMultipleMedia,
  type SavedMedia,
} from "@/lib/upload";
import { clientIp, LIMITS, rateLimit, tooManyRequests } from "@/lib/rate-limit";

function collectMediaFiles(form: FormData): File[] {
  const files: File[] = [];
  for (const [key, value] of form.entries()) {
    if ((key === "media" || key === "media[]") && value instanceof File && value.size > 0) {
      files.push(value);
    }
  }
  return files;
}

function coverFrom(saved: SavedMedia[]): SavedMedia | null {
  if (!saved.length) return null;
  return saved.find((m) => m.type === "image") || saved[0] || null;
}

async function insertPostMedia(
  pool: ReturnType<typeof getPool>,
  postId: number,
  saved: SavedMedia[],
  startOrder = 0,
) {
  for (let i = 0; i < saved.length; i++) {
    const item = saved[i]!;
    await pool.execute(
      `INSERT INTO post_media (post_id, file_path, media_type, sort_order) VALUES (?, ?, ?, ?)`,
      [postId, item.path, item.type, startOrder + i],
    );
  }
}

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
    const locationLatRaw = Number(form.get("location_lat"));
    const locationLngRaw = Number(form.get("location_lng"));
    const locationLat = Number.isFinite(locationLatRaw) ? locationLatRaw : null;
    const locationLng = Number.isFinite(locationLngRaw) ? locationLngRaw : null;
    const contactName = String(form.get("contact_name") || "").trim() || user?.name || null;
    const contactPhone = String(form.get("contact_phone") || "").trim();
    const contactEmail = String(form.get("contact_email") || "").trim().toLowerCase();
    const petIdRaw = String(form.get("pet_id") || "").trim();
    const alert = isAlertType(type);

    if (!title || !description) {
      return NextResponse.json({ error: "Title and description are required." }, { status: 400 });
    }
    if (alert && !location) {
      return NextResponse.json(
        { error: "Add a location so people know where the pet was seen." },
        { status: 400 },
      );
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

    const files = collectMediaFiles(form);
    let saved: SavedMedia[] = [];
    if (files.length > 0) {
      saved = await saveMultipleMedia(files, "posts", 8);
    } else {
      const single = form.get("media");
      if (single && typeof single !== "string") {
        const one = await saveMediaFile(single, "posts", "media");
        if (one) saved = [one];
      }
    }
    const cover = coverFrom(saved);

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
            `UPDATE pets SET status = 'missing',
             last_seen_text = COALESCE(?, last_seen_text),
             last_seen_lat = COALESCE(?, last_seen_lat),
             last_seen_lng = COALESCE(?, last_seen_lng)
             WHERE id = ?`,
            [location || null, locationLat, locationLng, petId],
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
           location_text = ?, location_lat = ?, location_lng = ?,
           contact_name = ?, contact_phone = ?, contact_email = ?,
           updated_at = NOW() WHERE id = ?`,
          [
            title,
            description,
            species,
            cover?.path ?? null,
            cover?.type ?? null,
            location || null,
            locationLat,
            locationLng,
            contactName,
            alert && contactPhone ? contactPhone : null,
            alert && contactEmail ? contactEmail : null,
            row.id,
          ],
        );
        postId = row.id;
        if (saved.length) {
          const [orderRows] = await pool.query(
            `SELECT COALESCE(MAX(sort_order), -1) AS m FROM post_media WHERE post_id = ?`,
            [postId],
          );
          const start = Number((orderRows as { m: number }[])[0]?.m ?? -1) + 1;
          await insertPostMedia(pool, postId, saved, start);
        }
      }
    }

    if (postId === null) {
      const [result] = await pool.execute(
        `INSERT INTO posts (user_id, pet_id, type, title, description, species, photo_path, media_type, location_text, location_lat, location_lng, contact_name, contact_phone, contact_email)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          user?.id ?? null,
          petId,
          type,
          title,
          description,
          species,
          cover?.path ?? null,
          cover?.type ?? null,
          location || null,
          locationLat,
          locationLng,
          contactName,
          alert && contactPhone ? contactPhone : null,
          alert && contactEmail ? contactEmail : null,
        ],
      );
      postId = Number((result as { insertId: number }).insertId);
      if (saved.length) {
        await insertPostMedia(pool, postId, saved, 0);
      }
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
