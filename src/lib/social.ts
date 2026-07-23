import { getPool } from "@/lib/db";
import { relativeTime, userInitial } from "@/lib/format";

export async function postLikeCount(postId: number): Promise<number> {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS c FROM post_likes WHERE post_id = ?`,
    [postId],
  );
  return Number((rows as { c: number }[])[0]?.c ?? 0);
}

export async function userLikedPost(postId: number, userId: number | null): Promise<boolean> {
  if (!userId) return false;
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT id FROM post_likes WHERE post_id = ? AND user_id = ? LIMIT 1`,
    [postId, userId],
  );
  return (rows as unknown[]).length > 0;
}

/** One query for which of these posts the user liked. */
export async function likedPostIds(
  postIds: number[],
  userId: number | null,
): Promise<Set<number>> {
  const liked = new Set<number>();
  if (!userId || postIds.length === 0) return liked;
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT post_id FROM post_likes WHERE user_id = ? AND post_id IN (?)`,
    [userId, postIds],
  );
  for (const row of rows as { post_id: number }[]) {
    liked.add(Number(row.post_id));
  }
  return liked;
}

export async function togglePostLike(postId: number, userId: number): Promise<boolean> {
  const liked = await userLikedPost(postId, userId);
  const pool = getPool();
  if (liked) {
    await pool.execute(`DELETE FROM post_likes WHERE post_id = ? AND user_id = ?`, [
      postId,
      userId,
    ]);
    return false;
  }
  await pool.execute(`INSERT INTO post_likes (post_id, user_id) VALUES (?, ?)`, [postId, userId]);
  return true;
}

export async function listComments(postId: number) {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT c.id, c.body, c.created_at, c.user_id, u.name AS author_name
     FROM post_comments c
     JOIN users u ON u.id = c.user_id
     WHERE c.post_id = ?
     ORDER BY c.created_at ASC
     LIMIT 200`,
    [postId],
  );
  return (rows as {
    id: number;
    body: string;
    created_at: Date | string;
    user_id: number;
    author_name: string;
  }[]).map((row) => ({
    id: row.id,
    user_id: row.user_id,
    author_name: row.author_name,
    initial: userInitial(row.author_name),
    body: row.body,
    created_at: String(row.created_at),
    time_ago: relativeTime(row.created_at),
  }));
}

export async function addComment(postId: number, userId: number, body: string) {
  const pool = getPool();
  const [result] = await pool.execute(
    `INSERT INTO post_comments (post_id, user_id, body) VALUES (?, ?, ?)`,
    [postId, userId, body],
  );
  const id = Number((result as { insertId: number }).insertId);
  const comments = await listComments(postId);
  return comments.find((c) => c.id === id) ?? null;
}
