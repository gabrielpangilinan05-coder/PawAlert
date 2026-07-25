import Link from "next/link";
import { redirect } from "next/navigation";
import { BodyClass } from "@/components/BodyClass";
import { FollowButton } from "@/components/FollowButton";
import { UserAvatar } from "@/components/UserAvatar";
import { getCurrentUser, mediaUrl } from "@/lib/auth";
import { getPool } from "@/lib/db";
import { followerCount, followingCount, isFollowing } from "@/lib/follows";
import { shortPlace } from "@/lib/post-display";

function messengerDisplay(raw: string): { label: string; href: string | null } {
  const t = raw.trim();
  if (!t) return { label: "", href: null };
  if (/^https?:\/\//i.test(t)) {
    try {
      const u = new URL(t);
      const host = u.hostname.replace(/^www\./, "");
      const path = u.pathname.replace(/\/$/, "");
      return {
        label: path && path !== "/" ? `${host}${path}` : host,
        href: t,
      };
    } catch {
      return { label: t, href: t };
    }
  }
  const handle = t.replace(/^@/, "").replace(/^m\.me\//i, "");
  return {
    label: handle.startsWith("facebook.com") ? handle : `@${handle}`,
    href: /^https?:\/\//i.test(t) ? t : `https://m.me/${encodeURIComponent(handle)}`,
  };
}

function AboutIcon({ kind }: { kind: "email" | "phone" | "messenger" | "area" }) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  if (kind === "email") {
    return (
      <svg {...common}>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m3 7 9 6 9-6" />
      </svg>
    );
  }
  if (kind === "phone") {
    return (
      <svg {...common}>
        <path d="M6.5 3.5h3l1.5 4-2 1.5a12 12 0 0 0 5.5 5.5l1.5-2 4 1.5v3A2 2 0 0 1 18 19 14 14 0 0 1 5 6a2 2 0 0 1 1.5-2.5Z" />
      </svg>
    );
  }
  if (kind === "messenger") {
    return (
      <svg {...common}>
        <path d="M12 3.5c-4.7 0-8.5 3.4-8.5 7.6 0 2.4 1.2 4.5 3.2 5.9V20l2.9-1.6c.8.2 1.6.3 2.4.3 4.7 0 8.5-3.4 8.5-7.6S16.7 3.5 12 3.5Z" />
        <path d="m8.5 12.5 2.4-2.5 2.4 2.3 2.7-2.3" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M12 21s7-4.4 7-10a7 7 0 1 0-14 0c0 5.6 7 10 7 10Z" />
      <circle cx="12" cy="11" r="2.4" />
    </svg>
  );
}

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

  // Private: only the profile owner sees contact details here.
  // Public pet pages still use Manage pet privacy checkboxes when missing.
  type AboutRow = {
    kind: "email" | "phone" | "messenger" | "area";
    label: string;
    value: string;
    href?: string | null;
    title?: string;
  };
  const aboutRows: AboutRow[] = [];
  if (isSelf) {
    aboutRows.push({
      kind: "email",
      label: "Email",
      value: profile.email,
      href: `mailto:${profile.email}`,
    });
    if (profile.phone) {
      aboutRows.push({
        kind: "phone",
        label: "Phone",
        value: profile.phone,
        href: `tel:${profile.phone}`,
      });
    }
    if (profile.messenger) {
      const m = messengerDisplay(profile.messenger);
      aboutRows.push({
        kind: "messenger",
        label: "Messenger",
        value: m.label,
        href: m.href,
        title: profile.messenger,
      });
    }
    if (profile.address) {
      aboutRows.push({
        kind: "area",
        label: "Area",
        value: shortPlace(profile.address, 56) || profile.address,
        title: profile.address,
      });
    }
  }

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

        {aboutRows.length > 0 ? (
          <section className="profile-about" aria-label="Personal details">
            <div className="profile-about__head">
              <h2>Personal details</h2>
              <Link className="profile-about__edit" href="/profile/edit">
                Edit
              </Link>
            </div>
            <ul className="profile-about__list">
              {aboutRows.map((row) => (
                <li key={row.kind} className="profile-about__row">
                  <span className="profile-about__icon">
                    <AboutIcon kind={row.kind} />
                  </span>
                  <div className="profile-about__copy">
                    <span className="profile-about__label">{row.label}</span>
                    {row.href ? (
                      <a
                        className="profile-about__value"
                        href={row.href}
                        title={row.title}
                        {...(row.href.startsWith("http")
                          ? { target: "_blank", rel: "noopener noreferrer" }
                          : {})}
                      >
                        {row.value}
                      </a>
                    ) : (
                      <span className="profile-about__value" title={row.title}>
                        {row.value}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="dashboard-section">
          <div className="dashboard-section-head">
            <h2>{isSelf ? "Your pets" : "Pets"}</h2>
            <span className="meta">{pets.length} registered</span>
          </div>
          {pets.length === 0 ? (
            <div className="profile-empty">
              <strong>{isSelf ? "No pets yet" : "No pets registered"}</strong>
              <p>
                {isSelf
                  ? "Register a pet to get a free QR tag and public profile."
                  : "This member hasn’t registered a pet yet."}
              </p>
              {isSelf ? (
                <Link className="btn btn-amber" href="/pets/new">
                  Add pet
                </Link>
              ) : null}
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
            <div className="profile-empty">
              <strong>{isSelf ? "No posts yet" : "No posts"}</strong>
              <p>
                {isSelf
                  ? "Share a story, tip, or Found & Missing alert with the community."
                  : "This member hasn’t posted yet."}
              </p>
              {isSelf ? (
                <Link className="btn btn-outline" href="/create">
                  New post
                </Link>
              ) : null}
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
