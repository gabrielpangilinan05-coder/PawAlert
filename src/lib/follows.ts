import { getPool } from "@/lib/db";

export async function isFollowing(followerId: number, followingId: number): Promise<boolean> {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT id FROM follows WHERE follower_id = ? AND following_id = ? LIMIT 1`,
    [followerId, followingId],
  );
  return (rows as unknown[]).length > 0;
}

export async function followingSet(
  followerId: number,
  targetIds: number[],
): Promise<Set<number>> {
  const out = new Set<number>();
  if (targetIds.length === 0) return out;
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT following_id FROM follows WHERE follower_id = ? AND following_id IN (?)`,
    [followerId, targetIds],
  );
  for (const row of rows as { following_id: number }[]) {
    out.add(Number(row.following_id));
  }
  return out;
}

export async function followerCounts(userIds: number[]): Promise<Record<number, number>> {
  const map: Record<number, number> = {};
  for (const id of userIds) map[id] = 0;
  if (userIds.length === 0) return map;
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT following_id AS id, COUNT(*) AS c FROM follows WHERE following_id IN (?) GROUP BY following_id`,
    [userIds],
  );
  for (const row of rows as { id: number; c: number }[]) {
    map[Number(row.id)] = Number(row.c);
  }
  return map;
}

export async function toggleFollow(followerId: number, followingId: number): Promise<boolean> {
  if (followerId === followingId) return false;
  const pool = getPool();
  if (await isFollowing(followerId, followingId)) {
    await pool.execute(`DELETE FROM follows WHERE follower_id = ? AND following_id = ?`, [
      followerId,
      followingId,
    ]);
    return false;
  }
  await pool.execute(`INSERT INTO follows (follower_id, following_id) VALUES (?, ?)`, [
    followerId,
    followingId,
  ]);
  return true;
}

export async function followerCount(userId: number): Promise<number> {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS c FROM follows WHERE following_id = ?`,
    [userId],
  );
  return Number((rows as { c: number }[])[0]?.c ?? 0);
}

export async function followingCount(userId: number): Promise<number> {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS c FROM follows WHERE follower_id = ?`,
    [userId],
  );
  return Number((rows as { c: number }[])[0]?.c ?? 0);
}
