import Link from "next/link";
import { redirect } from "next/navigation";
import { FollowButton } from "@/components/FollowButton";
import { getCurrentUser, mediaUrl } from "@/lib/auth";
import { followerCount, followingCount, isFollowing } from "@/lib/follows";
import { getPool } from "@/lib/db";
import { userInitial } from "@/lib/format";

export const metadata = { title: "Profile" };

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const me = await getCurrentUser();
  if (!me) redirect("/login");

  const { id } = await searchParams;
  const viewId = id ? Number(id) : me.id;

  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT id, name, email, phone, messenger, address, created_at FROM users WHERE id = ? LIMIT 1`,
    [viewId],
  );
  const profile = (rows as {
    id: number;
    name: string;
    email: string;
    phone: string | null;
    messenger: string | null;
    address: string | null;
    created_at: string | Date;
  }[])[0];
  if (!profile) redirect("/feed");

  const isSelf = profile.id === me.id;
  const following = !isSelf && (await isFollowing(me.id, profile.id));
  const followers = await followerCount(profile.id);
  const followingN = await followingCount(profile.id);
  const joined = new Date(profile.created_at).toLocaleDateString(undefined, {
    month: "short",
    year: "numeric",
  });

  const [petRows] = await pool.query(
    `SELECT id, name, species, breed, photo_path, status, public_slug
     FROM pets WHERE user_id = ? ORDER BY name ASC`,
    [profile.id],
  );
  const pets = petRows as {
    id: number;
    name: string;
    species: string;
    breed: string | null;
    photo_path: string | null;
    status: string;
    public_slug: string;
  }[];

  return (
    <div className="page-wrap social-feed-wrap">
      <div className="profile-hero social-card">
        <div className="composer-avatar" style={{ width: 64, height: 64, fontSize: "1.4rem" }}>
          {userInitial(profile.name)}
        </div>
        <div style={{ flex: 1 }}>
          <h1 className="page-title" style={{ margin: 0 }}>
            {profile.name}
          </h1>
          <p className="meta" style={{ margin: "0.35rem 0 0" }}>
            {followers} followers · {followingN} following · joined {joined}
          </p>
        </div>
        {isSelf ? (
          <div className="people-card-actions">
            <Link className="btn btn-small btn-amber" href="/profile/edit">
              Edit profile
            </Link>
          </div>
        ) : (
          <div className="people-card-actions">
            <FollowButton userId={profile.id} initialFollowing={following} />
            <Link className="btn btn-small btn-outline" href={`/messages?with=${profile.id}`}>
              Message
            </Link>
          </div>
        )}
      </div>

      {isSelf && (
        <div className="panel" style={{ marginTop: "1rem", maxWidth: 520 }}>
          <dl className="form-grid">
            <div>
              <dt className="muted">Email</dt>
              <dd style={{ margin: 0, fontWeight: 700 }}>{profile.email}</dd>
            </div>
            <div>
              <dt className="muted">Phone</dt>
              <dd style={{ margin: 0, fontWeight: 700 }}>{profile.phone || "—"}</dd>
            </div>
            <div>
              <dt className="muted">Messenger</dt>
              <dd style={{ margin: 0, fontWeight: 700 }}>{profile.messenger || "—"}</dd>
            </div>
            <div>
              <dt className="muted">Address</dt>
              <dd style={{ margin: 0, fontWeight: 700 }}>{profile.address || "—"}</dd>
            </div>
          </dl>
        </div>
      )}

      <h2 style={{ fontFamily: "var(--font-display)", margin: "1.5rem 0 0.8rem" }}>Pets</h2>
      {pets.length === 0 ? (
        <div className="empty">No registered pets yet.</div>
      ) : (
        <div className="pet-grid">
          {pets.map((pet) => (
            <Link key={pet.id} className="pet-tile" href={`/pet/${pet.public_slug}`}>
              {pet.photo_path ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={mediaUrl(pet.photo_path) || ""} alt="" />
              ) : (
                <div className="cover-img" style={{ height: 190, background: "#d9e5dd" }} />
              )}
              <div className="tile-body">
                <span className={`badge badge-${pet.status === "missing" ? "missing" : "safe"}`}>
                  {pet.status}
                </span>
                <h3>{pet.name}</h3>
                <p className="meta">
                  {pet.species}
                  {pet.breed ? ` · ${pet.breed}` : ""}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
