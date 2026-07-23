import Link from "next/link";
import { redirect } from "next/navigation";
import { BodyClass } from "@/components/BodyClass";
import { MessengerChat } from "@/components/MessengerChat";
import { getCurrentUser } from "@/lib/auth";
import { getPool } from "@/lib/db";
import { conversationPartners, markMessagesRead, threadMessages } from "@/lib/messages";
import { excerptText, userInitial } from "@/lib/format";

export const metadata = { title: "Messages" };

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ with?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { with: withRaw } = await searchParams;
  const withId = Number(withRaw || 0);
  const threads = await conversationPartners(user.id);

  let partner: { id: number; name: string; email: string } | null = null;
  let messages: Awaited<ReturnType<typeof threadMessages>> = [];

  if (withId > 0 && withId !== user.id) {
    const pool = getPool();
    const [rows] = await pool.query(`SELECT id, name, email FROM users WHERE id = ? LIMIT 1`, [
      withId,
    ]);
    partner = (rows as { id: number; name: string; email: string }[])[0] ?? null;
    if (!partner) redirect("/messages");
    await markMessagesRead(user.id, partner.id);
    messages = await threadMessages(user.id, partner.id);
  }

  return (
    <>
      <BodyClass name="messages-page" />
      <div className="page-wrap messenger-wrap">
        <aside className="messenger-sidebar social-card">
          <div className="messenger-side-head">
            <h1>Messages</h1>
            <Link className="btn btn-small btn-outline" href="/people">
              Find people
            </Link>
          </div>
          {threads.length === 0 ? (
            <p className="muted" style={{ padding: "0.5rem 1rem" }}>
              No conversations yet. Search someone and tap Message.
            </p>
          ) : (
            <div className="thread-list">
              {threads.map((t) => (
                <Link
                  key={t.id}
                  href={`/messages?with=${t.id}`}
                  className={`thread-item${partner?.id === t.id ? " active" : ""}`}
                >
                  <div className="composer-avatar small">{userInitial(t.name)}</div>
                  <div className="thread-meta">
                    <strong>{t.name}</strong>
                    <div className="meta">{excerptText(t.last_body || "", 42)}</div>
                  </div>
                  {t.unread > 0 ? <span className="unread-pill">{t.unread}</span> : null}
                </Link>
              ))}
            </div>
          )}
        </aside>

        <section className="messenger-main social-card">
          {!partner ? (
            <div className="messenger-empty">
              <h2>Your chats</h2>
              <p className="muted">Select a conversation or find someone to message.</p>
              <Link className="btn btn-amber" href="/people">
                Search people
              </Link>
            </div>
          ) : (
            <>
              <header className="messenger-chat-head">
                <div className="composer-avatar small">{userInitial(partner.name)}</div>
                <div>
                  <strong>
                    <Link href={`/profile?id=${partner.id}`}>{partner.name}</Link>
                  </strong>
                  <div className="meta">Direct message</div>
                </div>
              </header>
              <MessengerChat
                meId={user.id}
                partnerId={partner.id}
                initialMessages={messages}
              />
            </>
          )}
        </section>
      </div>
    </>
  );
}
