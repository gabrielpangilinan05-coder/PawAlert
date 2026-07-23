import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getPool } from "@/lib/db";
import { generateSlug, normalizeSex, normalizeSpecies, saveMultipleMedia } from "@/lib/upload";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "login_required" }, { status: 401 });
  }

  try {
    const form = await req.formData();
    const name = String(form.get("name") || "").trim();
    const species = normalizeSpecies(String(form.get("species") || "Dog"));
    const breed = String(form.get("breed") || "").trim();
    const sex = normalizeSex(String(form.get("sex") || "unknown"));
    const medical = String(form.get("medical_notes") || "").trim();
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
    let cover: string | null = null;
    for (const item of uploads) {
      if (item.type === "image") {
        cover = item.path;
        break;
      }
    }
    if (!cover && uploads[0]) cover = uploads[0].path;

    const slug = generateSlug(10);
    const pool = getPool();
    const [result] = await pool.execute(
      `INSERT INTO pets (user_id, name, species, breed, sex, photo_path, medical_notes, public_slug,
        show_phone, show_email, show_messenger, show_address)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        user.id,
        name,
        species,
        breed || null,
        sex,
        cover,
        medical || null,
        slug,
        showPhone,
        showEmail,
        showMessenger,
        showAddress,
      ],
    );
    const petId = Number((result as { insertId: number }).insertId);

    if (uploads.length) {
      let order = 0;
      for (const item of uploads) {
        await pool.execute(
          `INSERT INTO pet_media (pet_id, file_path, media_type, sort_order) VALUES (?, ?, ?, ?)`,
          [petId, item.path, item.type, order++],
        );
      }
    }

    return NextResponse.json({ ok: true, id: petId, slug });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not save pet." },
      { status: 400 },
    );
  }
}
