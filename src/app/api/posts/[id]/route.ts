import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getPool } from "@/lib/db";
import { listPostMedia } from "@/lib/posts";
import {
  deleteStoredMedia,
  isAlertType,
  normalizeSpecies,
  saveMultipleMedia,
  type SavedMedia,
} from "@/lib/upload";
import { LIMITS, rateLimit, tooManyRequests } from "@/lib/rate-limit";

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

async function refreshPostCover(pool: ReturnType<typeof getPool>, postId: number) {
  const media = await listPostMedia(postId);
  if (media.length) {
    const cover =
      media.find((m) => m.media_type === "image") || media[0]!;
    await pool.execute(`UPDATE posts SET photo_path = ?, media_type = ? WHERE id = ?`, [
      cover.file_path,
      cover.media_type,
      postId,
    ]);
    return;
  }
  await pool.execute(`UPDATE posts SET photo_path = NULL, media_type = NULL WHERE id = ?`, [
    postId,
  ]);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Please log in." }, { status: 401 });
  }

  const limited = rateLimit(`postedit:u:${user.id}`, LIMITS.create);
  if (!limited.ok) return tooManyRequests(limited.resetAt);

  const { id } = await params;
  const postId = Number(id);
  if (!Number.isFinite(postId) || postId < 1) {
    return NextResponse.json({ error: "Invalid post." }, { status: 400 });
  }

  try {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT id, user_id, type, status FROM posts WHERE id = ? AND hidden_at IS NULL LIMIT 1`,
      [postId],
    );
    const post = (rows as { id: number; user_id: number | null; type: string; status: string }[])[0];
    if (!post) {
      return NextResponse.json({ error: "Post not found." }, { status: 404 });
    }
    if (post.user_id !== user.id && user.role !== "admin") {
      return NextResponse.json({ error: "You can only edit your own posts." }, { status: 403 });
    }

    const form = await req.formData();
    const action = String(form.get("action") || "update");

    if (action === "remove_media") {
      const mediaId = Number(form.get("media_id"));
      if (!Number.isFinite(mediaId) || mediaId < 0) {
        return NextResponse.json({ error: "Invalid media." }, { status: 400 });
      }

      // Legacy cover on posts row only (no post_media id yet)
      if (mediaId === 0) {
        const [coverRows] = await pool.query(
          `SELECT photo_path FROM posts WHERE id = ? LIMIT 1`,
          [postId],
        );
        const coverPath = (coverRows as { photo_path: string | null }[])[0]?.photo_path;
        await pool.execute(`UPDATE posts SET photo_path = NULL, media_type = NULL WHERE id = ?`, [
          postId,
        ]);
        if (coverPath) await deleteStoredMedia(coverPath);
        return NextResponse.json({ ok: true });
      }

      try {
        const [mediaRows] = await pool.query(
          `SELECT id, file_path FROM post_media WHERE id = ? AND post_id = ? LIMIT 1`,
          [mediaId, postId],
        );
        const media = (mediaRows as { id: number; file_path: string }[])[0];
        if (!media) {
          return NextResponse.json({ error: "Media not found." }, { status: 404 });
        }
        await pool.execute(`DELETE FROM post_media WHERE id = ? AND post_id = ?`, [
          mediaId,
          postId,
        ]);
        await deleteStoredMedia(media.file_path);
        await refreshPostCover(pool, postId);
      } catch (err) {
        if ((err as { code?: string }).code === "ER_NO_SUCH_TABLE") {
          return NextResponse.json(
            { error: "Media gallery not available yet. Run migration_post_media.sql." },
            { status: 503 },
          );
        }
        throw err;
      }
      return NextResponse.json({ ok: true });
    }

    if (action === "set_cover") {
      const mediaId = Number(form.get("media_id"));
      if (!Number.isFinite(mediaId) || mediaId < 1) {
        return NextResponse.json({ error: "Invalid media." }, { status: 400 });
      }
      try {
        const [mediaRows] = await pool.query(
          `SELECT id, file_path, media_type FROM post_media WHERE id = ? AND post_id = ? LIMIT 1`,
          [mediaId, postId],
        );
        const media = (
          mediaRows as { id: number; file_path: string; media_type: string }[]
        )[0];
        if (!media) {
          return NextResponse.json({ error: "Media not found." }, { status: 404 });
        }
        await pool.execute(`UPDATE post_media SET sort_order = sort_order + 1 WHERE post_id = ?`, [
          postId,
        ]);
        await pool.execute(`UPDATE post_media SET sort_order = 0 WHERE id = ?`, [mediaId]);
        await pool.execute(`UPDATE posts SET photo_path = ?, media_type = ? WHERE id = ?`, [
          media.file_path,
          media.media_type,
          postId,
        ]);
      } catch (err) {
        if ((err as { code?: string }).code === "ER_NO_SUCH_TABLE") {
          return NextResponse.json(
            { error: "Media gallery not available yet. Run migration_post_media.sql." },
            { status: 503 },
          );
        }
        throw err;
      }
      return NextResponse.json({ ok: true });
    }

    const title = String(form.get("title") || "").trim();
    const description = String(form.get("description") || "").trim();
    const species = normalizeSpecies(String(form.get("species") || "Other"));
    const location = String(form.get("location_text") || "").trim();
    const locationLatRaw = Number(form.get("location_lat"));
    const locationLngRaw = Number(form.get("location_lng"));
    const locationLat = Number.isFinite(locationLatRaw) ? locationLatRaw : null;
    const locationLng = Number.isFinite(locationLngRaw) ? locationLngRaw : null;
    const contactName = String(form.get("contact_name") || "").trim() || user.name;
    const contactPhone = String(form.get("contact_phone") || "").trim();
    const contactEmail = String(form.get("contact_email") || "").trim().toLowerCase();
    const alert = isAlertType(post.type);

    if (!title || !description) {
      return NextResponse.json({ error: "Title and description are required." }, { status: 400 });
    }
    if (alert && !location) {
      return NextResponse.json({ error: "Add a location for this alert." }, { status: 400 });
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
    if (files.length) {
      const existing = await listPostMedia(postId);
      let used = existing.length;
      if (used === 0) {
        const [coverRows] = await pool.query(
          `SELECT photo_path FROM posts WHERE id = ? LIMIT 1`,
          [postId],
        );
        if ((coverRows as { photo_path: string | null }[])[0]?.photo_path) used = 1;
      }
      const room = Math.max(0, 8 - used);
      if (files.length > room) {
        return NextResponse.json(
          { error: `You can add up to ${room} more file(s) (max 8 total).` },
          { status: 400 },
        );
      }
      saved = await saveMultipleMedia(files, "posts", room || 1);
    }

    await pool.execute(
      `UPDATE posts SET title = ?, description = ?, species = ?,
       location_text = ?, location_lat = ?, location_lng = ?,
       contact_name = ?, contact_phone = ?, contact_email = ?,
       updated_at = NOW()
       WHERE id = ?`,
      [
        title,
        description,
        species,
        location || null,
        locationLat,
        locationLng,
        contactName,
        alert && contactPhone ? contactPhone : null,
        alert && contactEmail ? contactEmail : null,
        postId,
      ],
    );

    if (saved.length) {
      try {
        const before = await listPostMedia(postId);
        // Promote legacy cover into gallery so new files append cleanly
        if (before.length === 0) {
          const [coverRows] = await pool.query(
            `SELECT photo_path, media_type FROM posts WHERE id = ? LIMIT 1`,
            [postId],
          );
          const legacy = (
            coverRows as { photo_path: string | null; media_type: string | null }[]
          )[0];
          if (legacy?.photo_path) {
            await pool.execute(
              `INSERT INTO post_media (post_id, file_path, media_type, sort_order) VALUES (?, ?, ?, 0)`,
              [postId, legacy.photo_path, legacy.media_type || "image"],
            );
          }
        }

        const [orderRows] = await pool.query(
          `SELECT COALESCE(MAX(sort_order), -1) AS m FROM post_media WHERE post_id = ?`,
          [postId],
        );
        const start = Number((orderRows as { m: number }[])[0]?.m ?? -1) + 1;
        for (let i = 0; i < saved.length; i++) {
          const item = saved[i]!;
          await pool.execute(
            `INSERT INTO post_media (post_id, file_path, media_type, sort_order) VALUES (?, ?, ?, ?)`,
            [postId, item.path, item.type, start + i],
          );
        }

        const after = await listPostMedia(postId);
        if (after.length === saved.length) {
          const cover = coverFrom(saved);
          if (cover) {
            await pool.execute(`UPDATE posts SET photo_path = ?, media_type = ? WHERE id = ?`, [
              cover.path,
              cover.type,
              postId,
            ]);
          }
        } else {
          await refreshPostCover(pool, postId);
        }
      } catch (err) {
        if ((err as { code?: string }).code === "ER_NO_SUCH_TABLE") {
          const cover = coverFrom(saved);
          if (cover) {
            await pool.execute(`UPDATE posts SET photo_path = ?, media_type = ? WHERE id = ?`, [
              cover.path,
              cover.type,
              postId,
            ]);
          }
        } else {
          throw err;
        }
      }
    }

    return NextResponse.json({ ok: true, id: postId });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not update post." },
      { status: 400 },
    );
  }
}
