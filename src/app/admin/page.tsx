import Link from "next/link";
import { requireAdminPage } from "@/lib/admin";
import { getPool } from "@/lib/db";
import { mediaUrl } from "@/lib/media";
import { relativeTime } from "@/lib/format";
import {
  AdminPostActions,
  AdminReportActions,
  AdminUserActions,
} from "@/components/AdminActions";
import { UserAvatar } from "@/components/UserAvatar";

export const metadata = {
  title: "Admin moderation · PawAlert",
};

type PostRow = {
  id: number;
  title: string;
  type: string;
  status: string;
  photo_path: string | null;
  author_name: string | null;
  user_id: number | null;
  hidden_at: Date | string | null;
  hidden_reason: string | null;
  created_at: Date | string;
};

type ReportRow = {
  id: number;
  target_type: "post" | "user";
  target_id: number;
  reason: string;
  details: string | null;
  status: string;
  reporter_name: string | null;
  created_at: Date | string;
};

type UserRow = {
  id: number;
  name: string;
  email: string;
  role: "user" | "admin";
  avatar_path: string | null;
  banned_at: Date | string | null;
  ban_reason: string | null;
  created_at: Date | string;
};

function typeLabel(type: string): string {
  switch (type) {
    case "missing":
      return "Missing";
    case "found":
      return "Found";
    case "story":
      return "Story";
    case "tip":
      return "Tip";
    case "question":
      return "Question";
    default:
      return type;
  }
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const admin = await requireAdminPage();
  const { tab: tabRaw } = await searchParams;
  const tab = tabRaw === "users" || tabRaw === "reports" ? tabRaw : "posts";

  const pool = getPool();

  const [[postCountRows], [reportCountRows], [userCountRows]] = await Promise.all([
    pool.query(`SELECT COUNT(*) AS c FROM posts WHERE hidden_at IS NOT NULL`),
    pool.query(`SELECT COUNT(*) AS c FROM reports WHERE status = 'open'`),
    pool.query(`SELECT COUNT(*) AS c FROM users WHERE banned_at IS NOT NULL`),
  ]);

  const hiddenPosts = Number((postCountRows as { c: number }[])[0]?.c || 0);
  const openReports = Number((reportCountRows as { c: number }[])[0]?.c || 0);
  const bannedUsers = Number((userCountRows as { c: number }[])[0]?.c || 0);

  let posts: PostRow[] = [];
  let reports: ReportRow[] = [];
  let users: UserRow[] = [];

  if (tab === "posts") {
    const [rows] = await pool.query(
      `SELECT posts.id, posts.title, posts.type, posts.status, posts.photo_path, posts.user_id,
              posts.hidden_at, posts.hidden_reason, posts.created_at,
              users.name AS author_name
       FROM posts
       LEFT JOIN users ON users.id = posts.user_id
       ORDER BY posts.hidden_at IS NULL, posts.created_at DESC
       LIMIT 80`,
    );
    posts = rows as PostRow[];
  } else if (tab === "reports") {
    const [rows] = await pool.query(
      `SELECT reports.*, users.name AS reporter_name
       FROM reports
       LEFT JOIN users ON users.id = reports.reporter_id
       ORDER BY FIELD(reports.status, 'open', 'resolved', 'dismissed'), reports.created_at DESC
       LIMIT 80`,
    );
    reports = rows as ReportRow[];
  } else {
    try {
      const [rows] = await pool.query(
        `SELECT id, name, email, role, avatar_path, banned_at, ban_reason, created_at
         FROM users
         ORDER BY banned_at IS NULL, role = 'admin' DESC, created_at DESC
         LIMIT 80`,
      );
      users = rows as UserRow[];
    } catch (err) {
      if ((err as { code?: string }).code !== "ER_BAD_FIELD_ERROR") throw err;
      const [rows] = await pool.query(
        `SELECT id, name, email, role, banned_at, ban_reason, created_at
         FROM users
         ORDER BY banned_at IS NULL, role = 'admin' DESC, created_at DESC
         LIMIT 80`,
      );
      users = (rows as Omit<UserRow, "avatar_path">[]).map((u) => ({
        ...u,
        avatar_path: null,
      }));
    }
  }

  const panelTitle =
    tab === "posts" ? "Recent posts" : tab === "reports" ? "Reports queue" : "Community users";
  const panelCount =
    tab === "posts" ? posts.length : tab === "reports" ? reports.length : users.length;

  return (
    <main className="page admin-page">
      <header className="admin-hero">
        <div className="admin-hero__copy">
          <p className="eyebrow">Moderation</p>
          <h1>Admin</h1>
          <p className="lede">
            Signed in as <strong>{admin.name}</strong>. Hide spam, review reports, and suspend
            abusive accounts.
          </p>
        </div>
        <div className="admin-stats" aria-label="Moderation summary">
          <div className="admin-stat admin-stat--reports">
            <strong>{openReports}</strong>
            <span>Open reports</span>
          </div>
          <div className="admin-stat admin-stat--hidden">
            <strong>{hiddenPosts}</strong>
            <span>Hidden posts</span>
          </div>
          <div className="admin-stat admin-stat--banned">
            <strong>{bannedUsers}</strong>
            <span>Banned users</span>
          </div>
        </div>
      </header>

      <nav className="admin-tabs" aria-label="Admin sections">
        <Link href="/admin?tab=posts" className={tab === "posts" ? "is-active" : undefined}>
          Posts
          {hiddenPosts > 0 ? <span className="admin-tabs__count">{hiddenPosts}</span> : null}
        </Link>
        <Link href="/admin?tab=reports" className={tab === "reports" ? "is-active" : undefined}>
          Reports
          {openReports > 0 ? <span className="admin-tabs__count">{openReports}</span> : null}
        </Link>
        <Link href="/admin?tab=users" className={tab === "users" ? "is-active" : undefined}>
          Users
          {bannedUsers > 0 ? <span className="admin-tabs__count">{bannedUsers}</span> : null}
        </Link>
      </nav>

      <section className="admin-panel">
        <div className="admin-panel__head">
          <h2>{panelTitle}</h2>
          <span className="admin-panel__meta">{panelCount} shown</span>
        </div>

        {tab === "posts" ? (
          posts.length === 0 ? (
            <div className="admin-empty">No posts to moderate yet.</div>
          ) : (
            <ul className="admin-list">
              {posts.map((p) => {
                const thumb = mediaUrl(p.photo_path);
                const hidden = Boolean(p.hidden_at);
                return (
                  <li
                    key={p.id}
                    className={`admin-card${hidden ? " admin-card--muted" : ""}`}
                  >
                    <Link href={`/post/${p.id}`} className="admin-card__media">
                      {thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={thumb} alt="" />
                      ) : (
                        <span className="admin-card__media-fallback" aria-hidden>
                          #{p.id}
                        </span>
                      )}
                    </Link>
                    <div className="admin-card__body">
                      <div className="admin-card__top">
                        <Link href={`/post/${p.id}`} className="admin-card__title">
                          <span className="admin-card__id">#{p.id}</span>
                          {p.title}
                        </Link>
                        <div className="admin-card__badges">
                          <span className={`badge badge-${p.type === "missing" || p.type === "found" || p.status === "resolved" ? (p.status === "resolved" ? "resolved" : p.type) : "tip"}`}>
                            {typeLabel(p.type)}
                          </span>
                          {hidden ? (
                            <span className="badge badge-missing">Hidden</span>
                          ) : (
                            <span className="badge badge-resolved">Visible</span>
                          )}
                        </div>
                      </div>
                      <p className="admin-card__meta">
                        {p.user_id ? (
                          <Link href={`/profile?id=${p.user_id}`}>{p.author_name || "User"}</Link>
                        ) : (
                          <span>{p.author_name || "Guest"}</span>
                        )}
                        <span aria-hidden>·</span>
                        <span>{relativeTime(p.created_at)}</span>
                        <span aria-hidden>·</span>
                        <span>{p.status}</span>
                      </p>
                      {p.hidden_reason ? (
                        <p className="admin-card__note">{p.hidden_reason}</p>
                      ) : null}
                      <div className="admin-card__actions">
                        <AdminPostActions postId={p.id} hidden={hidden} />
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )
        ) : null}

        {tab === "reports" ? (
          reports.length === 0 ? (
            <div className="admin-empty">No reports in the queue.</div>
          ) : (
            <ul className="admin-list">
              {reports.map((r) => {
                const open = r.status === "open";
                return (
                  <li
                    key={r.id}
                    className={`admin-card admin-card--report${!open ? " admin-card--muted" : ""}`}
                  >
                    <div className="admin-card__icon" aria-hidden>
                      !
                    </div>
                    <div className="admin-card__body">
                      <div className="admin-card__top">
                        <h3 className="admin-card__title">
                          <span className="admin-card__id">#{r.id}</span>
                          {r.reason}
                        </h3>
                        <div className="admin-card__badges">
                          <span className={`badge ${open ? "badge-missing" : "badge-resolved"}`}>
                            {r.status}
                          </span>
                        </div>
                      </div>
                      {r.details ? <p className="admin-card__note">{r.details}</p> : null}
                      <p className="admin-card__meta">
                        {r.target_type === "post" ? (
                          <Link href={`/post/${r.target_id}`}>Post #{r.target_id}</Link>
                        ) : (
                          <Link href={`/profile?id=${r.target_id}`}>User #{r.target_id}</Link>
                        )}
                        <span aria-hidden>·</span>
                        <span>by {r.reporter_name || "Unknown"}</span>
                        <span aria-hidden>·</span>
                        <span>{relativeTime(r.created_at)}</span>
                      </p>
                      {open ? (
                        <div className="admin-card__actions">
                          <AdminReportActions reportId={r.id} />
                        </div>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )
        ) : null}

        {tab === "users" ? (
          users.length === 0 ? (
            <div className="admin-empty">No users found.</div>
          ) : (
            <ul className="admin-list">
              {users.map((u) => {
                const banned = Boolean(u.banned_at);
                return (
                  <li
                    key={u.id}
                    className={`admin-card admin-card--user${banned ? " admin-card--muted" : ""}`}
                  >
                    <div className="admin-card__avatar">
                      <UserAvatar name={u.name} src={u.avatar_path} />
                    </div>
                    <div className="admin-card__body">
                      <div className="admin-card__top">
                        <Link href={`/profile?id=${u.id}`} className="admin-card__title">
                          {u.name}
                        </Link>
                        <div className="admin-card__badges">
                          {u.role === "admin" ? (
                            <span className="badge badge-found">Admin</span>
                          ) : null}
                          {banned ? (
                            <span className="badge badge-missing">Banned</span>
                          ) : (
                            <span className="badge badge-resolved">Active</span>
                          )}
                        </div>
                      </div>
                      <p className="admin-card__meta">
                        <span>{u.email}</span>
                        <span aria-hidden>·</span>
                        <span>Joined {relativeTime(u.created_at)}</span>
                      </p>
                      {u.ban_reason ? <p className="admin-card__note">{u.ban_reason}</p> : null}
                      <div className="admin-card__actions">
                        {u.id === admin.id ? (
                          <span className="muted">This is you</span>
                        ) : (
                          <AdminUserActions
                            userId={u.id}
                            banned={banned}
                            isAdmin={u.role === "admin"}
                          />
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )
        ) : null}
      </section>
    </main>
  );
}
