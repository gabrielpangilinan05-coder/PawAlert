import Link from "next/link";
import { redirect } from "next/navigation";
import { BodyClass } from "@/components/BodyClass";
import { FollowButton } from "@/components/FollowButton";
import { UserAvatar } from "@/components/UserAvatar";
import { getCurrentUser, mediaUrl } from "@/lib/auth";
import { followerCount, followingCount, isFollowing } from "@/lib/follows";
import { getPool } from "@/lib/db";

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
  type ProfileRow = {
    id: number;
    name: string;
    email: string;
    phone: string | null;
    messenger: string | null;
    address: string | null;
    avatar_path: string | null;
    created_at: string | Date;
  };
  let profile: ProfileRow | null = null;

  try {
    const [rows] = await pool.query(
      `SELECT id, name, email, phone, messenger, address, avatar_path, created_at
       FROM users WHERE id = ? LIMIT 1`,
      [viewId],
    );
    profile = (rows as ProfileRow[])[0] ?? null;
  } catch (err) {
    if ((err as { code?: string }).code !== "ER_BAD_FIELD_ERROR") throw err;
    const [rows] = await pool.query(
      `SELECT id, name, email, phone, messenger, address, created_at
       FROM users WHERE id = ? LIMIT 1`,
      [viewId],
    );
    const fallback = (
      rows as {
        id: number;
        name: string;
        email: string;
        phone: string | null;
        messenger: string | null;
        address: string | null;
        created_at: string | Date;
      }[]
    )[0];
    profile = fallback ? { ...fallback, avatar_path: null } : null;
  }

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

  const contactBits = [
    isSelf ? { label: "Email", value: profile.email } : null,
    profile.phone ? { label: "Phone", value: profile.phone } : null,
    profile.messenger ? { label: "Messenger", value: profile.messenger } : null,
    profile.address ? { label: "Area", value: profile.address } : null,
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <>
      <BodyClass name="dashboard-page" />
      <div className="page-wrap dashboard-wrap profile-page-wrap">
        <header className="profile-cover">
          <div className="profile-cover__inner">
            <UserAvatar name={profile.name} src={profile.avatar_path} size="xl" />
            <div className="profile-cover__copy">
              <h1 className="profile-cover__name">{profile.name}</h1>
              <p className="profile-cover__meta">
                <span>{followers} followers</span>
                <span aria-hidden>·</span>
                <span>{followingN} following</span>
                <span aria-hidden>·</span>
                <span>Joined {joined}</span>
              </p>
              {isSelf ? (
                <div className="profile-cover__actions">
                  <Link className="btn btn-amber" href="/profile/edit">
                    Edit profile
                  </Link>
                  <Link className="btn btn-outline" href="/pets/new">
                    Add pet
                  </Link>
                  <Link className="btn btn-outline" href="/create">
                    New post
                  </Link>
                </div>
              ) : (
                <div className="profile-cover__actions">
                  <FollowButton userId={profile.id} initialFollowing={following} />
                  <Link className="btn btn-outline" href={`/messages?with=${profile.id}`}>
                    Message
                  </Link>
                </div>
              )}
            </div>
          </div>
        </header>

        {contactBits.length > 0 ? (
          <section className="profile-contact" aria-label="Contact">
            {contactBits.map((item) => (
              <div key={item.label} className="profile-contact__item">
                <span className="profile-contact__label">{item.label}</span>
                <span className="profile-contact__value">{item.value}</span>
              </div>
            ))}
          </section>
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
