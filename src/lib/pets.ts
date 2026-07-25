import { getPool } from "@/lib/db";

export async function syncMissingPost(petId: number): Promise<void> {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT p.*, u.name AS owner_name, u.phone AS owner_phone, u.email AS owner_email
     FROM pets p
     JOIN users u ON u.id = p.user_id
     WHERE p.id = ?
     LIMIT 1`,
    [petId],
  );
  const pet = (rows as Record<string, unknown>[])[0];
  if (!pet) return;

  const [openRows] = await pool.query(
    `SELECT id FROM posts WHERE pet_id = ? AND type = 'missing' AND status = 'open' LIMIT 1`,
    [petId],
  );
  const existing = (openRows as { id: number }[])[0];

  if (pet.status === "missing") {
    const title = `${String(pet.name)} is missing`;
    // Notes live on the pet row and render under Pet / Last seen on the post page.
    const desc = "";

    const feedPhoto =
      pet.last_seen_media_type === "image" && pet.last_seen_media_path
        ? pet.last_seen_media_path
        : pet.photo_path;

    const contactPhone = Number(pet.show_phone) === 1 ? pet.owner_phone : null;
    const contactEmail = Number(pet.show_email) === 1 ? pet.owner_email : null;

    if (existing) {
      await pool.query(
        `UPDATE posts SET title = ?, description = ?, species = ?, photo_path = ?, location_text = ?,
         location_lat = ?, location_lng = ?, contact_name = ?, contact_phone = ?, contact_email = ?,
         updated_at = NOW() WHERE id = ?`,
        [
          title,
          desc,
          String(pet.species ?? ""),
          feedPhoto == null ? null : String(feedPhoto),
          pet.last_seen_text == null ? null : String(pet.last_seen_text),
          pet.last_seen_lat ?? null,
          pet.last_seen_lng ?? null,
          String(pet.owner_name ?? ""),
          contactPhone == null ? null : String(contactPhone),
          contactEmail == null ? null : String(contactEmail),
          existing.id,
        ],
      );
    } else {
      await pool.query(
        `INSERT INTO posts (user_id, pet_id, type, title, description, species, photo_path, location_text, location_lat, location_lng, contact_name, contact_phone, contact_email)
         VALUES (?, ?, 'missing', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          Number(pet.user_id),
          petId,
          title,
          desc,
          String(pet.species ?? ""),
          feedPhoto == null ? null : String(feedPhoto),
          pet.last_seen_text == null ? null : String(pet.last_seen_text),
          pet.last_seen_lat ?? null,
          pet.last_seen_lng ?? null,
          String(pet.owner_name ?? ""),
          contactPhone == null ? null : String(contactPhone),
          contactEmail == null ? null : String(contactEmail),
        ],
      );
    }
    return;
  }

  if (existing) {
    await pool.execute(`UPDATE posts SET status = 'resolved', updated_at = NOW() WHERE id = ?`, [
      existing.id,
    ]);
  }
}

export async function getOwnedPet(petId: number, userId: number) {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT * FROM pets WHERE id = ? AND user_id = ? LIMIT 1`,
    [petId, userId],
  );
  return (rows as Record<string, unknown>[])[0] ?? null;
}

export async function listOwnedPets(userId: number) {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT id, name, species, breed, status, public_slug, photo_path
     FROM pets WHERE user_id = ? ORDER BY updated_at DESC`,
    [userId],
  );
  return rows as {
    id: number;
    name: string;
    species: string;
    breed: string | null;
    status: string;
    public_slug: string;
    photo_path: string | null;
  }[];
}
