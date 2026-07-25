import Link from "next/link";
import { redirect } from "next/navigation";
import { BodyClass } from "@/components/BodyClass";
import { FollowButton } from "@/components/FollowButton";
import { getCurrentUser, mediaUrl } from "@/lib/auth";
import { followerCount, followingCount, isFollowing } from "@/lib/follows";
import { getPool } from "@/lib/db";
import { userInitial } from "@/lib/format";

export const metadata = { title: "Profile" };

function postTypeLabel(type: string): string {
  switch (type) {
    case "found":
      return "Found";
    case "missing":
      return "Missing";
    case "story":
      return "Pet Story";
    case "tip":
      return "Care Tip";
    case "question":
      return "Question";
    default:
      return type;
  }
}

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
     FROM pets WHERE user_id = ? ORDER BY updated_at DESC`,
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

  const [postRows] = await pool.query(
    `SELECT id, type, title, status, photo_path, location_text
     FROM posts
     WHERE user_id = ? AND hidden_at IS NULL
     ORDER BY created_at DESC
     LIMIT 12`,
    [profile.id],
  );
  const posts = postRows as {
    id: number;
    type: string;
    title: string;
    status: string;
    photo_path: string | null;
    location_text: string | null;
  }[];

  return (
    <>
      <BodyClass name="dashboard-page" />
      <div className="page-wrap dashboard-wrap social-feed-wrap">
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
              <Link className="btn btn-small btn-outline" href="/pets/new">
                Add pet
              </Link>
              <Link className="btn btn-small btn-outline" href="/create">
                New post
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

        {isSelf ? (
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
        ) : null}

        <section className="dashboard-section">
          <div className="dashboard-section-head">
            <h2>{isSelf ? "Your pets" : "Pets"}</h2>
            <span className="meta">{pets.length} registered</span>
          </div>
          {pets.length === 0 ? (
            <div className="empty">
              {isSelf
                ? "No pets yet. Register one to generate a QR tag."
                : "No registered pets yet."}
            </div>
          ) : (
            <div className="pet-grid">
              {pets.map((pet) =>
                isSelf ? (
                  <article key={pet.id} className="pet-tile">
                    {pet.photo_path ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={mediaUrl(pet.photo_path) || undefined} alt={pet.name} />
                    ) : (
                      <div className="cover-img pet-cover-empty" />
                    )}
                    <div className="tile-body">
                      <span className={`badge badge-${pet.status}`}>{pet.status}</span>
                      <h3>{pet.name}</h3>
                      <p className="meta">
                        {pet.species}
                        {pet.breed ? ` · ${pet.breed}` : ""}
                      </p>
                      <div className="tile-actions">
                        <Link className="btn btn-small" href={`/pets/${pet.id}`}>
                          Manage
                        </Link>
                        <Link
                          className="btn btn-small btn-outline"
                          href={`/pet/${pet.public_slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Public page
                        </Link>
                      </div>
                    </div>
                  </article>
                ) : (
                  <Link key={pet.id} className="pet-tile" href={`/pet/${pet.public_slug}`}>
                    {pet.photo_path ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={mediaUrl(pet.photo_path) || ""} alt="" />
                    ) : (
                      <div className="cover-img pet-cover-empty" />
                    )}
                    <div className="tile-body">
                      <span
                        className={`badge badge-${pet.status === "missing" ? "missing" : "safe"}`}
                      >
                        {pet.status}
                      </span>
                      <h3>{pet.name}</h3>
                      <p className="meta">
                        {pet.species}
                        {pet.breed ? ` · ${pet.breed}` : ""}
                      </p>
                    </div>
                  </Link>
                ),
              )}
            </div>
          )}
        </section>

        <section className="dashboard-section">
          <div className="dashboard-section-head">
            <h2>{isSelf ? "Your posts" : "Posts"}</h2>
            {isSelf ? (
              <Link className="meta dashboard-link" href="/feed">
                Open feed
              </Link>
            ) : null}
          </div>
          {posts.length === 0 ? (
            <div className="empty">
              {isSelf
                ? "No posts yet. Share a story or Found/Missing alert."
                : "No posts yet."}
            </div>
          ) : (
            <div className="feed-grid">
              {posts.map((post) => (
                <Link key={post.id} className="feed-tile" href={`/post/${post.id}`}>
                  {post.photo_path ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={mediaUrl(post.photo_path) || undefined} alt="" />
                  ) : (
                    <div className="cover-img post-cover-empty" />
                  )}
                  <div className="tile-body">
                    <span
                      className={`badge badge-${post.status === "resolved" ? "resolved" : post.type}`}
                    >
                      {post.status === "resolved" ? "resolved" : postTypeLabel(post.type)}
                    </span>
                    <h3>{post.title}</h3>
                    <p className="meta">{post.location_text || "No location noted"}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
