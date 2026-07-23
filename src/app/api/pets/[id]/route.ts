import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getPool } from "@/lib/db";
import { getOwnedPet, syncMissingPost } from "@/lib/pets";
import {
  deleteStoredMedia,
  deleteStoredMediaMany,
  normalizeSex,
  normalizeSpecies,
  saveMediaFile,
  saveMultipleMedia,
} from "@/lib/upload";

type Ctx = { params: Promise<{ id: string }> };

function parseCoord(raw: FormDataEntryValue | null): number | null {
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

async function petCoverPath(petId: number): Promise<string | null> {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT file_path, media_type FROM pet_media WHERE pet_id = ? ORDER BY sort_order ASC, id ASC`,
    [petId],
  );
  const media = rows as { file_path: string; media_type: string }[];
  const image = media.find((m) => m.media_type === "image");
  return image?.file_path ?? media[0]?.file_path ?? null;
}

export async function POST(req: Request, ctx: Ctx) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "login_required" }, { status: 401 });
  }

  const { id: idRaw } = await ctx.params;
  const petId = Number(idRaw);
  const pet = await getOwnedPet(petId, user.id);
  if (!pet) {
    return NextResponse.json({ error: "Pet not found." }, { status: 404 });
  }

  try {
    const form = await req.formData();
    const action = String(form.get("action") || "save");
    const pool = getPool();

    if (action === "mark_missing") {
      const lastSeen = String(form.get("last_seen_text") || "").trim();
      if (!lastSeen) {
        return NextResponse.json(
          { error: "Last-seen location is required before marking Missing." },
          { status: 400 },
        );
      }
      const lastSeenNotes = String(form.get("last_seen_notes") || "").trim() || null;
      const lastSeenAtRaw = String(form.get("last_seen_at") || "").trim();
      let lastSeenAt = new Date();
      if (lastSeenAtRaw) {
        const parsed = new Date(lastSeenAtRaw);
        if (Number.isNaN(parsed.getTime())) {
          return NextResponse.json({ error: "Invalid date and time." }, { status: 400 });
        }
        lastSeenAt = parsed;
      }
      const lastSeenLat = parseCoord(form.get("last_seen_lat"));
      const lastSeenLng = parseCoord(form.get("last_seen_lng"));
      const mediaFile = form.get("last_seen_media");
      const media =
        typeof mediaFile === "string"
          ? null
          : await saveMediaFile(mediaFile, "sightings", "media");

      await pool.execute(
        `UPDATE pets SET status = 'missing', last_seen_text = ?, last_seen_notes = ?, last_seen_lat = ?, last_seen_lng = ?,
         last_seen_at = ?, last_seen_media_path = ?, last_seen_media_type = ?
         WHERE id = ? AND user_id = ?`,
        [
          lastSeen,
          lastSeenNotes,
          lastSeenLat,
          lastSeenLng,
          lastSeenAt,
          media?.path ?? null,
          media?.type ?? null,
          petId,
          user.id,
        ],
      );
      await syncMissingPost(petId);
      return NextResponse.json({ ok: true, status: "missing" });
    }

    if (action === "mark_safe") {
      await pool.execute(
        `UPDATE pets SET status = 'safe', last_seen_text = NULL, last_seen_notes = NULL, last_seen_lat = NULL, last_seen_lng = NULL,
         last_seen_at = NULL, last_seen_media_path = NULL, last_seen_media_type = NULL
         WHERE id = ? AND user_id = ?`,
        [petId, user.id],
      );
      await syncMissingPost(petId);
      return NextResponse.json({ ok: true, status: "safe" });
    }

    if (action === "delete_pet") {
      const [mediaRows] = await pool.query(
        `SELECT file_path FROM pet_media WHERE pet_id = ?`,
        [petId],
      );
      const paths = new Set<string>();
      for (const row of mediaRows as { file_path: string }[]) {
        if (row.file_path) paths.add(row.file_path);
      }
      for (const key of ["photo_path", "last_seen_media_path"] as const) {
        const p = pet[key];
        if (typeof p === "string" && p) paths.add(p);
      }

      await pool.execute(`DELETE FROM pets WHERE id = ? AND user_id = ?`, [petId, user.id]);

      await deleteStoredMediaMany(paths);

      return NextResponse.json({ ok: true, deleted: true });
    }

    if (action === "delete_media") {
      const mediaId = Number(form.get("media_id") || 0);
      const [rows] = await pool.query(
        `SELECT file_path FROM pet_media WHERE id = ? AND pet_id = ? LIMIT 1`,
        [mediaId, petId],
      );
      const row = (rows as { file_path: string }[])[0];
      if (!row) {
        return NextResponse.json({ error: "Media not found." }, { status: 404 });
      }
      await pool.execute(`DELETE FROM pet_media WHERE id = ? AND pet_id = ?`, [mediaId, petId]);
      await deleteStoredMedia(row.file_path);
      const cover = await petCoverPath(petId);
      await pool.execute(`UPDATE pets SET photo_path = ? WHERE id = ?`, [cover, petId]);
      await syncMissingPost(petId);
      return NextResponse.json({ ok: true });
    }

    if (action === "set_cover") {
      const mediaId = Number(form.get("media_id") || 0);
      const [rows] = await pool.query(
        `SELECT id, file_path, media_type FROM pet_media WHERE id = ? AND pet_id = ? LIMIT 1`,
        [mediaId, petId],
      );
      const row = (rows as { id: number; file_path: string; media_type: string }[])[0];
      if (!row || row.media_type !== "image") {
        return NextResponse.json({ error: "Cover must be an image." }, { status: 400 });
      }
      await pool.execute(`UPDATE pet_media SET sort_order = sort_order + 1 WHERE pet_id = ?`, [
        petId,
      ]);
      await pool.execute(`UPDATE pet_media SET sort_order = 0 WHERE id = ?`, [mediaId]);
      await pool.execute(`UPDATE pets SET photo_path = ? WHERE id = ?`, [row.file_path, petId]);
      await syncMissingPost(petId);
      return NextResponse.json({ ok: true });
    }

    const name = String(form.get("name") || "").trim();
    const species = normalizeSpecies(String(form.get("species") || "Dog"));
    const breed = String(form.get("breed") || "").trim();
    const sex = normalizeSex(String(form.get("sex") || "unknown"));
    const medical = String(form.get("medical_notes") || "").trim();
    const ownerAddress = String(form.get("owner_address") || "").trim();
    const homeLat = parseCoord(form.get("home_lat"));
    const homeLng = parseCoord(form.get("home_lng"));
    const showPhone = form.get("show_phone") ? 1 : 0;
    const showEmail = form.get("show_email") ? 1 : 0;
    const showMessenger = form.get("show_messenger") ? 1 : 0;
    const showAddress = form.get("show_address") ? 1 : 0;

    if (!name) {
      return NextResponse.json({ error: "Pet name is required." }, { status: 400 });
    }

    const files = form
      .getAll("media")
      .filter((f): f is File => typeof f !== "string" && f.size > 0);
    const uploads = await saveMultipleMedia(files, "pets", 8);

    let photoPath = (pet.photo_path as string | null) || null;
    if (!photoPath && uploads.length) {
      photoPath = uploads.find((u) => u.type === "image")?.path || uploads[0]!.path;
    }

    await pool.execute(
      `UPDATE pets SET name = ?, species = ?, breed = ?, sex = ?, photo_path = ?, medical_notes = ?,
       show_phone = ?, show_email = ?, show_messenger = ?, show_address = ?,
       home_lat = ?, home_lng = ?
       WHERE id = ? AND user_id = ?`,
      [
        name,
        species,
        breed || null,
        sex,
        photoPath,
        medical || null,
        showPhone,
        showEmail,
        showMessenger,
        showAddress,
        homeLat,
        homeLng,
        petId,
        user.id,
      ],
    );

    await pool.execute(
      `UPDATE users SET address = ?, address_lat = ?, address_lng = ? WHERE id = ?`,
      [ownerAddress || null, homeLat, homeLng, user.id],
    );

    if (uploads.length) {
      const [countRows] = await pool.query(
        `SELECT COUNT(*) AS c FROM pet_media WHERE pet_id = ?`,
        [petId],
      );
      let order = Number((countRows as { c: number }[])[0]?.c ?? 0);
      for (const item of uploads) {
        await pool.execute(
          `INSERT INTO pet_media (pet_id, file_path, media_type, sort_order) VALUES (?, ?, ?, ?)`,
          [petId, item.path, item.type, order++],
        );
      }
    }

    await syncMissingPost(petId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Update failed." },
      { status: 400 },
    );
  }
}
