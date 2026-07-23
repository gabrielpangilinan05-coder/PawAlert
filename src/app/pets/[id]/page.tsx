import { notFound, redirect } from "next/navigation";
import { CopyLinkButton } from "@/components/CopyLinkButton";
import { ManagePetForm } from "@/components/ManagePetForm";
import { getCurrentUser, mediaUrl } from "@/lib/auth";
import { getOwnedPet } from "@/lib/pets";
import { getPool } from "@/lib/db";

export const metadata = { title: "Manage pet" };

function numOrNull(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function trimUrl(url: string, max = 48) {
  if (url.length <= max) return url;
  return `${url.slice(0, max - 1)}…`;
}

export default async function ManagePetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const pet = await getOwnedPet(Number(id), user.id);
  if (!pet) notFound();

  const pool = getPool();
  const [mediaRows] = await pool.query(
    `SELECT id, file_path, media_type FROM pet_media WHERE pet_id = ? ORDER BY sort_order ASC, id ASC`,
    [pet.id],
  );
  const media = mediaRows as { id: number; file_path: string; media_type: string }[];

  const [userRows] = await pool.query(
    `SELECT address, address_lat, address_lng FROM users WHERE id = ? LIMIT 1`,
    [user.id],
  );
  const owner = (userRows as { address: string | null; address_lat: number | null; address_lng: number | null }[])[0];

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "http://localhost:3000";
  const publicUrl = `${appUrl}/pet/${pet.public_slug}`;
  const isLivePublic = !/localhost|127\.0\.0\.1|192\.168\.|10\./i.test(appUrl);
  const homeLat = numOrNull(owner?.address_lat) ?? numOrNull(pet.home_lat);
  const homeLng = numOrNull(owner?.address_lng) ?? numOrNull(pet.home_lng);
  const lastSeenMedia = mediaUrl(pet.last_seen_media_path as string | null);
  const coverPhotoUrl =
    mediaUrl(pet.photo_path as string | null) ||
    mediaUrl(
      (media as { file_path: string; media_type: string }[]).find((m) => m.media_type === "image")
        ?.file_path,
    );

  return (
    <div className="page-wrap manage-grid">
      <div className="panel" style={{ margin: 0, width: "100%", maxWidth: "100%" }}>
        <ManagePetForm
          lastSeenMediaUrl={lastSeenMedia}
          coverPhotoUrl={coverPhotoUrl}
          publicUrl={publicUrl}
          media={media}
          pet={{
            id: Number(pet.id),
            name: String(pet.name),
            species: String(pet.species),
            breed: (pet.breed as string | null) || null,
            sex: String(pet.sex || "unknown"),
            medical_notes: (pet.medical_notes as string | null) || null,
            status: String(pet.status),
            public_slug: String(pet.public_slug),
            show_phone: Number(pet.show_phone),
            show_email: Number(pet.show_email),
            show_messenger: Number(pet.show_messenger),
            show_address: Number(pet.show_address),
            last_seen_text: (pet.last_seen_text as string | null) || null,
            last_seen_notes: (pet.last_seen_notes as string | null) || null,
            last_seen_at: pet.last_seen_at ? String(pet.last_seen_at) : null,
            last_seen_media_path: (pet.last_seen_media_path as string | null) || null,
            last_seen_media_type: (pet.last_seen_media_type as string | null) || null,
            last_seen_lat: numOrNull(pet.last_seen_lat),
            last_seen_lng: numOrNull(pet.last_seen_lng),
            home_lat: homeLat,
            home_lng: homeLng,
            owner_address: (owner?.address as string | null) || null,
          }}
        />
      </div>

      <aside className="qr-panel panel">
        <div className="qr-panel-head">
          <h2>QR tag</h2>
          <p>Print for a collar tag or flyer. Scans open the live profile.</p>
          {isLivePublic ? (
            <span className="qr-status qr-status-live">Live public URL</span>
          ) : (
            <span className="qr-status qr-status-local">Local only — set NEXT_PUBLIC_APP_URL for phones</span>
          )}
        </div>
        <div className="qr-card">
          <div className="qr-frame">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/pets/${pet.id}/qr`} alt="QR code" width={200} height={200} />
          </div>
          <div className="qr-card-meta">
            <strong>{String(pet.name)}</strong>
            <span>PawAlert profile</span>
          </div>
          <p className="qr-link" title={publicUrl}>
            {trimUrl(publicUrl)}
          </p>
          <div className="qr-actions">
            <CopyLinkButton url={publicUrl} />
            <a className="btn btn-small btn-amber" href={`/api/pets/${pet.id}/qr`} download>
              Download PNG
            </a>
          </div>
        </div>
      </aside>
    </div>
  );
}
