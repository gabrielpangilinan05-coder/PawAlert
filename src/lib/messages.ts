import { getPool } from "@/lib/db";

export type ThreadPartner = {
  id: number;
  name: string;
  email: string;
  avatar_path: string | null;
  last_body: string | null;
  last_at: string | null;
  unread: number;
};

export type ChatMessage = {
  id: number;
  sender_id: number;
  receiver_id: number;
  body: string;
  created_at: string;
  sender_name: string;
};

export async function unreadMessageCount(userId: number): Promise<number> {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS c FROM messages WHERE receiver_id = ? AND read_at IS NULL`,
    [userId],
  );
  return Number((rows as { c: number }[])[0]?.c ?? 0);
}

export async function conversationPartners(userId: number): Promise<ThreadPartner[]> {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT u.id, u.name, u.email, u.avatar_path,
      (
        SELECT m.body FROM messages m
        WHERE (m.sender_id = u.id AND m.receiver_id = ?)
           OR (m.sender_id = ? AND m.receiver_id = u.id)
        ORDER BY m.id DESC LIMIT 1
      ) AS last_body,
      (
        SELECT m.created_at FROM messages m
        WHERE (m.sender_id = u.id AND m.receiver_id = ?)
           OR (m.sender_id = ? AND m.receiver_id = u.id)
        ORDER BY m.id DESC LIMIT 1
      ) AS last_at,
      (
        SELECT COUNT(*) FROM messages m
        WHERE m.sender_id = u.id AND m.receiver_id = ? AND m.read_at IS NULL
      ) AS unread
     FROM users u
     WHERE u.id IN (
       SELECT DISTINCT IF(sender_id = ?, receiver_id, sender_id)
       FROM messages
       WHERE sender_id = ? OR receiver_id = ?
     )
     ORDER BY last_at DESC`,
    [userId, userId, userId, userId, userId, userId, userId, userId],
  );
  return (rows as ThreadPartner[]).map((r) => ({
    ...r,
    avatar_path: r.avatar_path ?? null,
    unread: Number(r.unread ?? 0),
    last_at: r.last_at ? String(r.last_at) : null,
  }));
}

export async function markMessagesRead(viewerId: number, partnerId: number): Promise<void> {
  const pool = getPool();
  await pool.execute(
    `UPDATE messages SET read_at = NOW()
     WHERE receiver_id = ? AND sender_id = ? AND read_at IS NULL`,
    [viewerId, partnerId],
  );
}

export async function threadMessages(
  userId: number,
  partnerId: number,
  afterId = 0,
): Promise<ChatMessage[]> {
  const pool = getPool();
  const params: (number | string)[] = [userId, partnerId, partnerId, userId];
  let sql = `SELECT m.*, s.name AS sender_name
    FROM messages m
    JOIN users s ON s.id = m.sender_id
    WHERE ((m.sender_id = ? AND m.receiver_id = ?) OR (m.sender_id = ? AND m.receiver_id = ?))`;
  if (afterId > 0) {
    sql += ` AND m.id > ?`;
    params.push(afterId);
  }
  sql += ` ORDER BY m.id ASC LIMIT 200`;
  const [rows] = await pool.query(sql, params);
  return (rows as ChatMessage[]).map((m) => ({
    ...m,
    created_at: String(m.created_at),
  }));
}

export async function sendMessage(
  senderId: number,
  receiverId: number,
  body: string,
): Promise<ChatMessage> {
  const text = body.trim();
  if (!text || senderId === receiverId) {
    throw new Error("Invalid message.");
  }
  if (text.length > 2000) {
    throw new Error("Message is too long.");
  }
  const pool = getPool();
  const [result] = await pool.execute(
    `INSERT INTO messages (sender_id, receiver_id, body) VALUES (?, ?, ?)`,
    [senderId, receiverId, text],
  );
  const id = Number((result as { insertId: number }).insertId);
  const [rows] = await pool.query(
    `SELECT m.*, s.name AS sender_name FROM messages m
     JOIN users s ON s.id = m.sender_id WHERE m.id = ?`,
    [id],
  );
  const msg = (rows as ChatMessage[])[0];
  if (!msg) throw new Error("Could not send message.");

  const { notifyNewMessage } = await import("@/lib/notifications");
  await notifyNewMessage({
    receiverId,
    senderId,
    senderName: msg.sender_name,
    excerpt: text.slice(0, 140),
  });

  return { ...msg, created_at: String(msg.created_at) };
}
