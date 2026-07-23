"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Comment = {
  id: number;
  author_name: string;
  initial: string;
  body: string;
  time_ago: string;
};

export function LikeCommentBar({
  postId,
  initialLiked,
  initialLikeCount,
  initialCommentCount,
  loggedIn,
}: {
  postId: number;
  initialLiked: boolean;
  initialLikeCount: number;
  initialCommentCount: number;
  loggedIn: boolean;
}) {
  const [liked, setLiked] = useState(initialLiked);
  const [likes, setLikes] = useState(initialLikeCount);
  const [comments, setComments] = useState<Comment[]>([]);
  const [count, setCount] = useState(initialCommentCount);
  const [body, setBody] = useState("");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    fetch(`/api/comments?post_id=${postId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) {
          setComments(data.comments || []);
          setCount(data.count ?? 0);
        }
      })
      .catch(() => undefined);
  }, [open, postId]);

  async function toggleLike() {
    if (!loggedIn) {
      setError("Log in to like posts.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/like", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ post_id: postId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error === "login_required" ? "Log in to like posts." : "Could not like.");
        return;
      }
      setLiked(Boolean(data.liked));
      setLikes(Number(data.count || 0));
    } finally {
      setBusy(false);
    }
  }

  async function sendComment(e: React.FormEvent) {
    e.preventDefault();
    if (!loggedIn) {
      setError("Log in to comment.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ post_id: postId, body }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error === "login_required" ? "Log in to comment." : "Could not comment.");
        return;
      }
      if (data.comment) setComments((c) => [...c, data.comment]);
      setCount(Number(data.count || count + 1));
      setBody("");
      setOpen(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="social-bar">
      <div className="social-actions">
        <button
          type="button"
          className={`btn btn-outline btn-sm${liked ? " is-liked" : ""}`}
          onClick={toggleLike}
          disabled={busy}
        >
          {liked ? "♥ Liked" : "♡ Like"} · {likes}
        </button>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => setOpen((o) => !o)}>
          💬 Comments · {count}
        </button>
        {!loggedIn && (
          <Link href="/login" className="muted" style={{ fontSize: "0.9rem" }}>
            Log in to engage
          </Link>
        )}
      </div>
      {error && <div className="flash flash-error">{error}</div>}
      {open && (
        <div className="comments-panel">
          {comments.length === 0 ? (
            <p className="muted">No comments yet.</p>
          ) : (
            <ul className="comment-list">
              {comments.map((c) => (
                <li key={c.id}>
                  <span className="comment-avatar">{c.initial}</span>
                  <div>
                    <strong>{c.author_name}</strong>{" "}
                    <span className="muted">{c.time_ago}</span>
                    <p>{c.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {loggedIn && (
            <form onSubmit={sendComment} className="comment-form">
              <input
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Write a comment…"
                maxLength={1000}
                required
              />
              <button className="btn btn-amber btn-sm" type="submit" disabled={busy}>
                Post
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
