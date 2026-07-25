import Link from "next/link";
import { redirect } from "next/navigation";
import { FollowButton } from "@/components/FollowButton";
import { UserAvatar } from "@/components/UserAvatar";
import { getCurrentUser } from "@/lib/auth";
import { followerCounts, followingSet } from "@/lib/follows";
import { getPool } from "@/lib/db";

export const metadata = { title: "People" };

export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tab?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const userId = user.id;

  const params = await searchParams;
  const tab = params.tab === "following" ? "following" : "search";
  const query = (params.q || "").trim();
  const pool = getPool();

  let people: {
    id: number;
    name: string;
    email: string;
    avatar_path: string | null;
    pet_count: number;
  }[] = [];

  async function loadPeople(withAvatar: boolean) {
    const avatarCol = withAvatar ? "u.avatar_path" : "NULL AS avatar_path";
    if (tab === "following") {
      const [rows] = await pool.query(
        `SELECT u.id, u.name, u.email, ${avatarCol},
                (SELECT COUNT(*) FROM pets p WHERE p.user_id = u.id) AS pet_count
         FROM follows f
         JOIN users u ON u.id = f.following_id
         WHERE f.follower_id = ?
         ORDER BY u.name ASC`,
        [userId],
      );
      return rows as typeof people;
    }
    if (query.length >= 2) {
      const [rows] = await pool.query(
        `SELECT u.id, u.name, u.email, ${avatarCol},
                (SELECT COUNT(*) FROM pets p WHERE p.user_id = u.id) AS pet_count
         FROM users u
         WHERE u.id != ?
           AND (u.name LIKE ? OR u.email LIKE ?)
         ORDER BY u.name ASC
         LIMIT 40`,
        [userId, `%${query}%`, `%${query}%`],
      );
      return rows as typeof people;
    }
    return [] as typeof people;
  }

  try {
    people = await loadPeople(true);
  } catch (err) {
    if ((err as { code?: string }).code !== "ER_BAD_FIELD_ERROR") throw err;
    people = await loadPeople(false);
  }

  const ids = people.map((p) => p.id);
  const [followingIds, followerMap] = await Promise.all([
    followingSet(user.id, ids),
    followerCounts(ids),
  ]);
  const followingMap: Record<number, boolean> = {};
  for (const id of ids) followingMap[id] = followingIds.has(id);

  return (
    <div className="page-wrap social-feed-wrap">
      <div className="dash-head">
        <div>
          <h1 className="page-title">Find people</h1>
          <p className="muted">Search pet owners, follow them, then chat in Messages.</p>
        </div>
        <Link className="btn btn-outline" href="/messages">
          Open Messages
        </Link>
      </div>

      <nav className="feed-filters" aria-label="People tabs">
        <Link href="/people" className={tab === "search" ? "active" : undefined}>
          Search
        </Link>
        <Link href="/people?tab=following" className={tab === "following" ? "active" : undefined}>
          Following
        </Link>
      </nav>

      {tab === "search" && (
        <form className="people-search" method="get">
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Search by name or email…"
            autoFocus
          />
          <button className="btn btn-amber" type="submit">
            Search
          </button>
        </form>
      )}

      {tab === "search" && !query ? (
        <div className="empty">Type a name to find other PawAlert users.</div>
      ) : people.length === 0 ? (
        <div className="empty">
          {tab === "following" ? "You’re not following anyone yet." : "No users matched your search."}
        </div>
      ) : (
        <div className="people-list">
          {people.map((person) => (
            <article key={person.id} className="people-card">
              <UserAvatar name={person.name} src={person.avatar_path} />
              <div className="people-card-body">
                <strong>
                  <Link href={`/profile?id=${person.id}`}>{person.name}</Link>
                </strong>
                <div className="meta">
                  {Number(person.pet_count)} pets · {followerMap[person.id]} followers
                </div>
              </div>
              <div className="people-card-actions">
                <FollowButton userId={person.id} initialFollowing={followingMap[person.id]!} />
                <Link className="btn btn-small btn-outline" href={`/messages?with=${person.id}`}>
                  Message
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
