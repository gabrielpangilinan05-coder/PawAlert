import { getPool } from "@/lib/db";
import { relativeTime } from "@/lib/format";

export type NotificationType = "comment" | "message" | "share";

export type AppNotification = {
  id: number;
  type: NotificationType;
  title: string;
  body: string | null;
  link: string;
  post_id: number | null;
  actor_id: number | null;
  actor_name: string | null;
  read_at: string | null;
  created_at: string;
  time_ago: string;
};

export async function createNotification(input: {
  userId: number;
  actorId?: number | null;
  type: NotificationType;
  title: string;
  body?: string | null;
  link: string;
  postId?: number | null;
}): Promise<void> {
  if (input.actorId && input.actorId === input.userId) return;

  const pool = getPool();
  await pool.execute(
    `INSERT INTO notifications (user_id, actor_id, type, title, body, link, post_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      input.userId,
      input.actorId ?? null,
      input.type,
      input.title.slice(0, 160),
      input.body ? input.body.slice(0, 500) : null,
      input.link.slice(0, 255),
      input.postId ?? null,
    ],
  );
}

export async function unreadNotificationCount(userId: number): Promise<number> {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND read_at IS NULL`,
    [userId],
  );
  return Number((rows as { c: number }[])[0]?.c ?? 0);
}

export async function listNotifications(userId: number, limit = 30): Promise<AppNotification[]> {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT n.id, n.type, n.title, n.body, n.link, n.post_id, n.actor_id, n.read_at, n.created_at,
            u.name AS actor_name
     FROM notifications n
     LEFT JOIN users u ON u.id = n.actor_id
     WHERE n.user_id = ?
     ORDER BY n.id DESC
     LIMIT ${Math.min(Math.max(Number(limit) || 30, 1), 50)}`,
    [userId],
  );

  return (rows as Record<string, unknown>[]).map((row) => ({
    id: Number(row.id),
    type: row.type as NotificationType,
    title: String(row.title),
    body: row.body == null ? null : String(row.body),
    link: String(row.link),
    post_id: row.post_id == null ? null : Number(row.post_id),
    actor_id: row.actor_id == null ? null : Number(row.actor_id),
    actor_name: row.actor_name == null ? null : String(row.actor_name),
    read_at: row.read_at == null ? null : String(row.read_at),
    created_at: String(row.created_at),
    time_ago: relativeTime(row.created_at as string | Date),
  }));
}

export async function markNotificationRead(userId: number, id: number): Promise<void> {
  const pool = getPool();
  await pool.execute(
    `UPDATE notifications SET read_at = NOW()
     WHERE id = ? AND user_id = ? AND read_at IS NULL`,
    [id, userId],
  );
}

export async function markAllNotificationsRead(userId: number): Promise<void> {
  const pool = getPool();
  await pool.execute(
    `UPDATE notifications SET read_at = NOW()
     WHERE user_id = ? AND read_at IS NULL`,
    [userId],
  );
}

/** Notify post owner about a new comment (skips self-comments). */
export async function notifyPostComment(opts: {
  postId: number;
  actorId: number;
  actorName: string;
  excerpt: string;
}): Promise<void> {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT user_id, title FROM posts WHERE id = ? LIMIT 1`,
    [opts.postId],
  );
  const post = (rows as { user_id: number | null; title: string }[])[0];
  if (!post?.user_id || post.user_id === opts.actorId) return;

  await createNotification({
    userId: post.user_id,
    actorId: opts.actorId,
    type: "comment",
    title: `${opts.actorName} commented on your post`,
    body: opts.excerpt,
    link: `/post/${opts.postId}`,
    postId: opts.postId,
  });
}

/** Notify post owner that someone shared their post. */
export async function notifyPostShare(opts: {
  postId: number;
  actorId?: number | null;
  actorName?: string | null;
}): Promise<void> {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT user_id, title FROM posts WHERE id = ? LIMIT 1`,
    [opts.postId],
  );
  const post = (rows as { user_id: number | null; title: string }[])[0];
  if (!post?.user_id) return;
  if (opts.actorId && opts.actorId === post.user_id) return;

  const who = opts.actorName?.trim() || "Someone";
  await createNotification({
    userId: post.user_id,
    actorId: opts.actorId ?? null,
    type: "share",
    title: `${who} shared your post`,
    body: post.title || null,
    link: `/post/${opts.postId}`,
    postId: opts.postId,
  });
}

/** Notify recipient of a new direct message. */
export async function notifyNewMessage(opts: {
  receiverId: number;
  senderId: number;
  senderName: string;
  excerpt: string;
}): Promise<void> {
  await createNotification({
    userId: opts.receiverId,
    actorId: opts.senderId,
    type: "message",
    title: `Message from ${opts.senderName}`,
    body: opts.excerpt,
    link: `/messages?with=${opts.senderId}`,
  });
}
