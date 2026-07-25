import { redirect } from "next/navigation";
import { EditProfileForm } from "@/components/EditProfileForm";
import { getCurrentUser } from "@/lib/auth";
import { getPool } from "@/lib/db";

export const metadata = { title: "Edit profile" };

export default async function EditProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT name, email, phone, messenger, address, address_lat, address_lng
     FROM users WHERE id = ? LIMIT 1`,
    [user.id],
  );
  const row = (
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
        <p className="muted create-lead">Update how people can reach you on PawAlert.</p>
        <EditProfileForm
          initial={{
            name: row.name,
            email: row.email,
            phone: row.phone,
            messenger: row.messenger,
            address: row.address,
            addressLat: toNum(row.address_lat),
            addressLng: toNum(row.address_lng),
          }}
        />
      </div>
    </div>
  );
}
