"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export type FeedComment = {
  id: number;
  author_name: string;
  initial: string;
  body: string;
  time_ago: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  postId: number;
  title: string;
  loggedIn: boolean;
  userName?: string;
  userInitial?: string;
  onCountChange?: (count: number) => void;
};

export function CommentsDialog({
  open,
  onClose,
  postId,
  title,
  loggedIn,
  userName = "friend",
  userInitial = "?",
  onCountChange,
}: Props) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [comments, setComments] = useState<FeedComment[]>([]);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const firstName = userName.trim().split(/\s+/)[0] || "friend";

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open) {
      if (!el.open) el.showModal();
      setBody("");
      setError(null);
      setLoading(true);
      fetch(`/api/comments?post_id=${postId}`)
        .then((r) => r.json())
        .then((data) => {
          if (!data.ok) {
            setError("Could not load comments.");
            setComments([]);
            return;
          }
          setComments(data.comments || []);
          onCountChange?.(Number(data.count ?? data.comments?.length ?? 0));
        })
        .catch(() => setError("Could not load comments."))
        .finally(() => {
          setLoading(false);
          setTimeout(() => textareaRef.current?.focus(), 50);
        });
    } else if (el.open) {
      el.close();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, postId]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text || !loggedIn) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ post_id: postId, body: text }),
      });
      const data = await res.json();
      if (data.error === "login_required" || res.status === 401) {
        window.location.href = "/login";
        return;
      }
      if (!res.ok || !data.ok || !data.comment) {
        setError("Could not post comment.");
        return;
      }
      setComments((prev) => [...prev, data.comment]);
      onCountChange?.(Number(data.count ?? 0));
      setBody("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    } finally {
      setBusy(false);
    }
  }

  function autoGrow(el: HTMLTextAreaElement) {
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }

  return (
    <dialog
      ref={dialogRef}
      className="fb-comments-dialog"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
    >
      <header className="fb-create-head">
        <h2>{title || "Comments"}</h2>
        <button type="button" className="fb-close" aria-label="Close" onClick={onClose}>
          ×
        </button>
      </header>

      <div className="fb-comments-dialog-body">
        {loading ? (
          <p className="muted" style={{ padding: "0.5rem 1rem" }}>
            Loading…
          </p>
        ) : error && comments.length === 0 ? (
          <p className="muted" style={{ padding: "0.5rem 1rem" }}>
            {error}
          </p>
        ) : comments.length === 0 ? (
          <p className="fb-comments-empty muted">No comments yet. Be the first to reply.</p>
        ) : (
          <div className="fb-comment-list">
            {comments.map((c) => (
              <div key={c.id} className="fb-comment-item">
                <div className="composer-avatar small">{c.initial}</div>
                <div className="fb-comment-main">
                  <div className="fb-comment-bubble">
                    <strong>{c.author_name}</strong>
                    <p>{c.body}</p>
                  </div>
                  <div className="fb-comment-meta">
                    <span>{c.time_ago}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {loggedIn ? (
        <form className="fb-comment-composer" onSubmit={send}>
          <div className="composer-avatar small">{userInitial}</div>
          <div className="fb-comment-input-wrap">
            <textarea
              ref={textareaRef}
              value={body}
              onChange={(e) => {
                setBody(e.target.value);
                autoGrow(e.target);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  e.currentTarget.form?.requestSubmit();
                }
              }}
              required
              maxLength={1000}
              rows={1}
              placeholder={`Comment as ${firstName}…`}
              disabled={busy}
            />
            <button className="fb-comment-send" type="submit" aria-label="Send comment" disabled={busy}>
              ➤
            </button>
          </div>
        </form>
      ) : (
        <p className="muted fb-comments-login">
          <Link href="/login">Log in</Link> to comment.
        </p>
      )}
    </dialog>
  );
}
