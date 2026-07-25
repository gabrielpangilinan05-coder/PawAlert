import { redirect } from "next/navigation";
import { EditProfileForm } from "@/components/EditProfileForm";
import { getCurrentUser, mediaUrl } from "@/lib/auth";
import { getPool } from "@/lib/db";

export const metadata = { title: "Edit profile" };

export default async function EditProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const pool = getPool();
  type ProfileEditRow = {
    name: string;
    email: string;
    phone: string | null;
    messenger: string | null;
    address: string | null;
    address_lat: number | string | null;
    address_lng: number | string | null;
    avatar_path: string | null;
  };
  let row: ProfileEditRow | null = null;

  try {
    const [rows] = await pool.query(
      `SELECT name, email, phone, messenger, address, address_lat, address_lng, avatar_path
       FROM users WHERE id = ? LIMIT 1`,
      [user.id],
    );
    row = (rows as ProfileEditRow[])[0] ?? null;
  } catch (err) {
    if ((err as { code?: string }).code !== "ER_BAD_FIELD_ERROR") throw err;
    const [rows] = await pool.query(
      `SELECT name, email, phone, messenger, address, address_lat, address_lng
       FROM users WHERE id = ? LIMIT 1`,
      [user.id],
    );
    const fallback = (
      rows as {
        name: string;
        email: string;
        phone: string | null;
        messenger: string | null;
        address: string | null;
        address_lat: number | string | null;
        address_lng: number | string | null;
      }[]
    )[0];
    row = fallback ? { ...fallback, avatar_path: null } : null;
  }

  if (!row) redirect("/profile");

  const toNum = (v: number | string | null) => {
    if (v == null || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  return (
    <div className="page-wrap">
      <div className="panel create-panel">
        <h1>Edit profile</h1>
        <p className="muted create-lead">Photo, contact details, and home area.</p>
        <EditProfileForm
          initial={{
            name: row.name,
            email: row.email,
            phone: row.phone,
            messenger: row.messenger,
            address: row.address,
            addressLat: toNum(row.address_lat),
            addressLng: toNum(row.address_lng),
            avatarUrl: mediaUrl(row.avatar_path),
          }}
        />
      </div>
    </div>
  );
}
