"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { mediaUrl } from "@/lib/media";
import { relativeTime, userInitial } from "@/lib/format";
import type { FeedPost } from "@/lib/posts";
import { useUnseenCount } from "@/lib/unseen";
import {
  ShareAlertDialog,
  shareDetailsFromFeedPost,
} from "@/components/ShareAlertDialog";
import { NotifBadge } from "@/components/NotifBadge";

const CommentsDialog = dynamic(
  () => import("@/components/CommentsDialog").then((m) => m.CommentsDialog),
  { ssr: false },
);

function postTypeLabel(type: string, status: string): string {
  if (status === "resolved") return "Resolved";
  switch (type) {
    case "found":
      return "Found";
    case "missing":
      return "Missing";
    case "story":
      return "Pet Story";
    case "tip":
      return "Care Tip";
    case "question":
      return "Question";
    default:
      return type;
  }
}

function badgeClass(type: string, status: string): string {
  if (status === "resolved") return "resolved";
  return type;
}

function excerpt(text: string, limit = 280): string {
  const t = text.trim();
  if (t.length <= limit) return t;
  return `${t.slice(0, limit - 1).trimEnd()}…`;
}

export function SocialCard({
  post,
  liked: initialLiked,
  loggedIn,
  currentUserName,
}: {
  post: FeedPost;
  liked: boolean;
  loggedIn: boolean;
  currentUserName?: string | null;
}) {
  const router = useRouter();
  const [liked, setLiked] = useState(initialLiked);
  const [likes, setLikes] = useState(Number(post.like_count));
  const [comments, setComments] = useState(Number(post.comment_count));
  const [shares, setShares] = useState(Number(post.share_count || 0));
  const [busy, setBusy] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareRecorded, setShareRecorded] = useState(false);

  const commentUnseen = useUnseenCount(`pa-comment-${post.id}`, comments);
  const shareUnseen = useUnseenCount(`pa-share-${post.id}`, shares);

  const author = post.author_name || "Community";
  const photo = mediaUrl(post.photo_path);
  const title = post.title;
  const body = post.description;
  const showTitle = title !== "" && !body.trim().toLowerCase().startsWith(title.toLowerCase());
  const when = relativeTime(post.created_at);
  const meName = currentUserName?.trim() || "friend";
  const shareDetails = useMemo(() => shareDetailsFromFeedPost(post), [post]);

  async function toggleLike() {
    if (!loggedIn) {
      router.push("/login");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/like", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ post_id: post.id }),
      });
      const data = await res.json();
      if (res.ok) {
        setLiked(Boolean(data.liked));
        setLikes(Number(data.count || 0));
      }
    } finally {
      setBusy(false);
    }
  }

  function openComments() {
    if (!loggedIn) {
      router.push("/login");
      return;
    }
    commentUnseen.markSeen();
    setCommentsOpen(true);
  }

  function openShare() {
    shareUnseen.markSeen();
    setShareOpen(true);
    setShareRecorded(false);
  }

  async function recordShare() {
    if (shareRecorded) return;
    setShareRecorded(true);
    try {
      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ post_id: post.id }),
      });
      const data = await res.json();
      if (res.ok) {
        const next = Number(data.share_count || shares + 1);
        setShares(next);
        shareUnseen.syncSeen(next);
      }
    } catch {
      setShareRecorded(false);
    }
  }

  return (
    <article className="social-card" id={`post-${post.id}`}>
      <header className="social-card-head">
        <div className="composer-avatar">{userInitial(author)}</div>
        <div>
          <strong>
            {post.user_id ? (
              <Link href={`/profile?id=${post.user_id}`}>{author}</Link>
            ) : (
              author
            )}
          </strong>
          <div className="meta">
            <span className={`badge badge-${badgeClass(post.type, post.status)}`}>
              {postTypeLabel(post.type, post.status)}
            </span>
            {" · "}
            {when}
            {post.location_text ? ` · ${post.location_text}` : ""}
          </div>
        </div>
      </header>

      {showTitle ? (
        <h3 className="social-title">
          <Link href={`/post/${post.id}`}>{title}</Link>
        </h3>
      ) : null}
      <p className="social-body" style={{ whiteSpace: "pre-wrap" }}>
        {excerpt(body)}
      </p>

      {photo ? (
        <Link className="social-media" href={`/post/${post.id}`}>
          {post.media_type === "video" ? (
            <video src={photo} muted playsInline />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt="" />
          )}
        </Link>
      ) : null}

      <div className="social-stats">
        <span>{likes} likes</span>
        <button type="button" className="link-plain" onClick={openComments}>
          {comments} comments
        </button>
        {shares > 0 ? <span className="muted">{shares} shares</span> : null}
      </div>

      <div className="social-actions">
        {loggedIn ? (
          <button
            type="button"
            className={`social-action${liked ? " is-liked" : ""}`}
            onClick={toggleLike}
            disabled={busy}
          >
            {liked ? "Liked" : "Like"}
          </button>
        ) : (
          <Link className="social-action" href="/login">
            Like
          </Link>
        )}
        <button type="button" className="social-action social-action--notif" onClick={openComments}>
          <span>Comment</span>
          <NotifBadge count={commentUnseen.unread} label={`${commentUnseen.unread} new comments`} />
        </button>
        <button type="button" className="social-action social-action--notif" onClick={openShare}>
          <span>Share</span>
          <NotifBadge count={shareUnseen.unread} label={`${shareUnseen.unread} new shares`} />
        </button>
      </div>

      {commentsOpen ? (
        <CommentsDialog
          open={commentsOpen}
          onClose={() => setCommentsOpen(false)}
          postId={post.id}
          title={title || "Comments"}
          loggedIn={loggedIn}
          userName={meName}
          userInitial={userInitial(meName)}
          onCountChange={(n) => {
            setComments(n);
            commentUnseen.syncSeen(n);
          }}
        />
      ) : null}

      <ShareAlertDialog
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        details={shareDetails}
        onShared={recordShare}
      />
    </article>
  );
}
