"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { mediaUrl } from "@/lib/media";
import { UserAvatar } from "@/components/UserAvatar";
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
  const [reportBusy, setReportBusy] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareRecorded, setShareRecorded] = useState(false);

  const commentUnseen = useUnseenCount(`pa-comment-${post.id}`, comments);
  const shareUnseen = useUnseenCount(`pa-share-${post.id}`, shares);

  const author = post.author_name || "Community";
  const photo =
    mediaUrl(post.photo_path) ||
    mediaUrl(post.pet_photo_path) ||
    (post.type === "missing" || post.type === "found" || post.status === "resolved"
      ? "/icons/icon-512.png"
      : null);
  const title = post.title;
  const body = post.description;
  const showTitle = title !== "" && !body.trim().toLowerCase().startsWith(title.toLowerCase());
  const when = relativeTime(post.created_at);
  const meName = currentUserName?.trim() || "friend";
  const shareDetails = useMemo(() => shareDetailsFromFeedPost(post), [post]);

  const isResolved = post.status === "resolved";
  const isAlert =
    post.type === "missing" || post.type === "found" || post.type === "resolved" || isResolved;
  const tone = isResolved
    ? "is-reunited"
    : post.type === "missing"
      ? "is-missing"
      : post.type === "found"
        ? "is-found"
        : "";
  const location = (post.pet_last_seen_text || post.location_text || "").trim();
  const petName = post.pet_name?.trim() || null;
  const contactHref = post.contact_phone
    ? `tel:${post.contact_phone}`
    : post.contact_email
      ? `mailto:${post.contact_email}`
      : null;
  const profileUrl = post.pet_slug ? `/pet/${post.pet_slug}` : `/post/${post.id}`;

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

  async function reportPost() {
    if (!loggedIn) {
      router.push("/login");
      return;
    }
    const reason = window.prompt(
      "Report reason: spam, harassment, scam, inappropriate, misinformation, or other",
      "spam",
    );
    if (!reason) return;
    const details = window.prompt("Optional details:") || "";
    setReportBusy(true);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_type: "post",
          target_id: post.id,
          reason: reason.trim().toLowerCase(),
          details,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        window.alert(data.error || "Could not submit report.");
        return;
      }
      window.alert("Thanks — moderators will review this post.");
    } catch {
      window.alert("Could not submit report.");
    } finally {
      setReportBusy(false);
    }
  }

  return (
    <article
      className={`social-card${isAlert ? ` social-card--alert ${tone}` : ""}`}
      id={`post-${post.id}`}
    >
      <header className="social-card-head">
        <UserAvatar name={author} src={post.author_avatar_path} />
        <div className="social-card-head__meta">
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
          </div>
        </div>
      </header>

      {isAlert && photo ? (
        <Link className="social-media social-media--hero" href={profileUrl}>
          {post.media_type === "video" ? (
            <video src={photo} muted playsInline />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt={petName || title || "Pet alert"} />
          )}
          <span className="social-media__banner" aria-hidden>
            {isResolved ? "REUNITED" : post.type === "found" ? "FOUND ALERT" : "MISSING ALERT"}
          </span>
        </Link>
      ) : null}

      {isAlert && (petName || location) ? (
        <div className="social-alert-meta">
          {petName ? <span className="social-alert-name">{petName}</span> : null}
          {location ? <span className="social-loc-chip">{location}</span> : null}
        </div>
      ) : null}

      {showTitle ? (
        <h3 className="social-title">
          <Link href={`/post/${post.id}`}>{title}</Link>
        </h3>
      ) : null}
      <p className="social-body" style={{ whiteSpace: "pre-wrap" }}>
        {excerpt(body)}
      </p>

      {!isAlert && photo ? (
        <Link className="social-media" href={`/post/${post.id}`}>
          {post.media_type === "video" ? (
            <video src={photo} muted playsInline />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt="" />
          )}
        </Link>
      ) : null}

      {!isAlert && location ? (
        <p className="social-loc-inline muted">{location}</p>
      ) : null}

      {isAlert ? (
        <div className="social-alert-cta">
          {contactHref ? (
            <a className="btn btn-amber" href={contactHref}>
              Contact owner
            </a>
          ) : (
            <Link className="btn btn-amber" href={profileUrl}>
              View pet profile
            </Link>
          )}
          <Link className="btn btn-outline" href={`/post/${post.id}`}>
            Full post
          </Link>
        </div>
      ) : null}

      <div className="social-stats">
        <span>
          {likes} {likes === 1 ? "like" : "likes"}
        </span>
        <button type="button" className="link-plain" onClick={openComments}>
          {comments} {comments === 1 ? "comment" : "comments"}
        </button>
        {shares > 0 ? (
          <span className="muted">
            {shares} {shares === 1 ? "share" : "shares"}
          </span>
        ) : null}
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
        <button
          type="button"
          className="social-action social-action--report"
          onClick={reportPost}
          disabled={reportBusy}
        >
          Report
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
