import Link from "next/link";
import { requireAdminPage } from "@/lib/admin";
import { getPool } from "@/lib/db";
import { relativeTime } from "@/lib/format";
import {
  AdminPostActions,
  AdminReportActions,
  AdminUserActions,
} from "@/components/AdminActions";

export const metadata = {
  title: "Admin moderation · PawAlert",
};

type PostRow = {
  id: number;
  title: string;
  type: string;
  status: string;
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
  banned_at: Date | string | null;
  ban_reason: string | null;
  created_at: Date | string;
};

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
      `SELECT posts.id, posts.title, posts.type, posts.status, posts.user_id,
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
    const [rows] = await pool.query(
      `SELECT id, name, email, role, banned_at, ban_reason, created_at
       FROM users
       ORDER BY banned_at IS NULL, role = 'admin' DESC, created_at DESC
       LIMIT 80`,
    );
    users = rows as UserRow[];
  }

  return (
    <main className="page admin-page">
      <div className="admin-hero">
        <p className="eyebrow">Moderation</p>
        <h1>Admin</h1>
        <p className="lede">
          Signed in as {admin.name}. Hide spam, review reports, and suspend abusive accounts.
        </p>
        <div className="admin-stats">
          <div>
            <strong>{openReports}</strong>
            <span>Open reports</span>
          </div>
          <div>
            <strong>{hiddenPosts}</strong>
            <span>Hidden posts</span>
          </div>
          <div>
            <strong>{bannedUsers}</strong>
            <span>Banned users</span>
          </div>
        </div>
      </div>

      <nav className="admin-tabs" aria-label="Admin sections">
        <Link href="/admin?tab=posts" className={tab === "posts" ? "is-active" : undefined}>
          Posts
        </Link>
        <Link href="/admin?tab=reports" className={tab === "reports" ? "is-active" : undefined}>
          Reports
        </Link>
        <Link href="/admin?tab=users" className={tab === "users" ? "is-active" : undefined}>
          Users
        </Link>
      </nav>

      {tab === "posts" ? (
        <section className="admin-panel">
          <h2>Recent posts</h2>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Post</th>
                  <th>Author</th>
                  <th>When</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {posts.map((p) => (
                  <tr key={p.id} className={p.hidden_at ? "is-muted" : undefined}>
                    <td>
                      <Link href={`/post/${p.id}`} className="admin-post-link">
                        <span className="admin-post-id">#{p.id}</span>
                        <span className="admin-title">{p.title}</span>
                      </Link>
                      <div className="muted">
                        {p.type} · {p.status}
                      </div>
                    </td>
                    <td>
                      {p.user_id ? (
                        <Link href={`/profile?id=${p.user_id}`}>{p.author_name || "User"}</Link>
                      ) : (
                        p.author_name || "Guest"
                      )}
                    </td>
                    <td>{relativeTime(p.created_at)}</td>
                    <td>
                      {p.hidden_at ? (
                        <span className="badge badge-missing">Hidden</span>
                      ) : (
                        <span className="badge badge-resolved">Visible</span>
                      )}
                      {p.hidden_reason ? <div className="muted">{p.hidden_reason}</div> : null}
                    </td>
                    <td>
                      <AdminPostActions postId={p.id} hidden={Boolean(p.hidden_at)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {tab === "reports" ? (
        <section className="admin-panel">
          <h2>Reports</h2>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Report</th>
                  <th>Target</th>
                  <th>Reporter</th>
                  <th>When</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((r) => (
                  <tr key={r.id} className={r.status !== "open" ? "is-muted" : undefined}>
                    <td>
                      <strong>#{r.id}</strong> · {r.reason}
                      {r.details ? <div className="muted">{r.details}</div> : null}
                      <div className="muted">{r.status}</div>
                    </td>
                    <td>
                      {r.target_type === "post" ? (
                        <Link href={`/post/${r.target_id}`}>Post #{r.target_id}</Link>
                      ) : (
                        <Link href={`/profile?id=${r.target_id}`}>User #{r.target_id}</Link>
                      )}
                    </td>
                    <td>{r.reporter_name || "Unknown"}</td>
                    <td>{relativeTime(r.created_at)}</td>
                    <td>
                      {r.status === "open" ? <AdminReportActions reportId={r.id} /> : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {tab === "users" ? (
        <section className="admin-panel">
          <h2>Users</h2>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Joined</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className={u.banned_at ? "is-muted" : undefined}>
                    <td>
                      <Link href={`/profile?id=${u.id}`}>{u.name}</Link>
                      <div className="muted">{u.email}</div>
                    </td>
                    <td>{u.role}</td>
                    <td>{relativeTime(u.created_at)}</td>
                    <td>
                      {u.banned_at ? (
                        <>
                          <span className="badge badge-missing">Banned</span>
                          {u.ban_reason ? <div className="muted">{u.ban_reason}</div> : null}
                        </>
                      ) : (
                        <span className="badge badge-resolved">Active</span>
                      )}
                    </td>
                    <td>
                      {u.id === admin.id ? (
                        <span className="muted">You</span>
                      ) : (
                        <AdminUserActions
                          userId={u.id}
                          banned={Boolean(u.banned_at)}
                          isAdmin={u.role === "admin"}
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </main>
  );
}
