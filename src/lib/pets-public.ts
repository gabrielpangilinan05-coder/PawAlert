import { cache } from "react";
import { existsSync } from "fs";
import path from "path";
import { getPool } from "@/lib/db";
import { uploadRoot } from "@/lib/paths";

export type PublicPet = Record<string, unknown>;

/** Public pet by QR/share slug (deduped per request). */
export const getPetByPublicSlug = cache(async (slug: string): Promise<PublicPet | null> => {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT pets.*, users.name AS owner_name, users.phone AS owner_phone,
            users.email AS owner_email, users.messenger AS owner_messenger,
            users.address AS owner_address, users.address_lat AS owner_address_lat,
            users.address_lng AS owner_address_lng
     FROM pets
     JOIN users ON users.id = pets.user_id
     WHERE pets.public_slug = ?
     LIMIT 1`,
    [slug],
  );
  return (rows as PublicPet[])[0] ?? null;
});

/** Resolve pet photo_path to an absolute file on disk. */
export function petPhotoFile(photoPath: string | null | undefined): string | null {
  if (!photoPath) return null;
  const clean = photoPath.replace(/^\/+/, "").replace(/^uploads\//, "");
  if (!clean || clean.includes("..")) return null;
  const root = path.resolve(/*turbopackIgnore: true*/ uploadRoot());
  const abs = path.resolve(/*turbopackIgnore: true*/ root, clean);
  if (!abs.startsWith(root + path.sep) && abs !== root) return null;
  if (!existsSync(abs)) return null;
  return abs;
}
