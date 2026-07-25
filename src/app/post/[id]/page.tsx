import Link from "next/link";
import { notFound } from "next/navigation";
import { DeletePostButton } from "@/components/DeletePostButton";
import { LikeCommentBar } from "@/components/LikeCommentBar";
import { PostMediaGallery } from "@/components/PostMediaGallery";
import { PostPhotoZoom } from "@/components/PostPhotoZoom";
import { getAdminUser } from "@/lib/admin";
import { getCurrentUser, mediaUrl } from "@/lib/auth";
import {
  alertPinDirectionsUrl,
  homeAreaDirectionsUrl,
} from "@/lib/directions";
import { getPostById, listPostMedia } from "@/lib/posts";
import { postLikeCount, userLikedPost } from "@/lib/social";
import { getPool } from "@/lib/db";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const admin = await getAdminUser();
  const post = await getPostById(Number(id), { includeHidden: Boolean(admin) });
  if (!post) return { title: "Post" };
  return {
    title: String(post.title),
    description: String(post.description).slice(0, 160),
  };
}

export default async function PostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const postId = Number(id);
  if (!Number.isFinite(postId) || postId < 1) notFound();

  const admin = await getAdminUser();
  const post = await getPostById(postId, { includeHidden: Boolean(admin) });
  if (!post) notFound();

  const user = await getCurrentUser();
  const liked = await userLikedPost(postId, user?.id ?? null);
  const likes = await postLikeCount(postId);
  const isHidden = Boolean(post.hidden_at);

  const pool = getPool();
  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS c FROM post_comments WHERE post_id = ?`,
    [postId],
  );
  const commentCount = Number((countRows as { c: number }[])[0]?.c ?? 0);

  const gallery = await listPostMedia(postId);
  const photo =
    mediaUrl(post.photo_path as string | null) ||
    mediaUrl(post.pet_photo_path as string | null) ||
    (gallery[0] ? mediaUrl(gallery[0].file_path) : null) ||
    "/icons/icon-512.png";
  const galleryItems =
    gallery.length > 0
      ? gallery
      : post.photo_path
        ? [
            {
              id: 0,
              file_path: String(post.photo_path),
              media_type: String(post.media_type || "image"),
            },
          ]
        : [];

  const isMissing = post.type === "missing" && post.status !== "resolved";
  const isFound = post.type === "found" && post.status !== "resolved";
  const isResolved = post.status === "resolved";

  const statusLabel = isResolved
    ? "REUNITED"
    : isFound
      ? "FOUND"
      : isMissing
        ? "LOST"
        : String(post.type).toUpperCase();

  const badgeClass = isResolved
    ? "resolved"
    : isFound
      ? "found"
      : isMissing
        ? "missing"
        : String(post.type);

  return (
    <div className="page-wrap alert-detail">
      <p className="alert-detail__back">
        <Link href={admin ? "/admin?tab=posts" : "/feed"}>
          {admin ? "← Back to admin" : "← Back to feed"}
        </Link>
      </p>

      {isHidden && admin ? (
        <p className="alert-urgent">
          Hidden from the public feed
          {post.hidden_reason ? ` — ${String(post.hidden_reason)}` : ""}.{" "}
          <Link href="/admin?tab=posts">Manage in admin</Link>
        </p>
      ) : null}

      <div className="alert-hero">
        {galleryItems.length > 1 || galleryItems.some((g) => g.media_type === "video") ? (
          <PostMediaGallery items={galleryItems} alt={String(post.title)} />
        ) : (
          <PostPhotoZoom src={photo!} alt={String(post.title)} />
        )}

        <div className="alert-hero-copy">
          <span className={`badge badge-${badgeClass}`}>{statusLabel}</span>
          <h1 className="alert-name">{String(post.title)}</h1>
          <p className="alert-kind">
            {String(post.author_name || "Guest")}
            {post.location_text ? ` · ${String(post.location_text)}` : ""}
            {post.species ? ` · ${String(post.species)}` : ""}
          </p>

          {isMissing ? (
            <p className="alert-urgent">
              Missing alert — contact the poster if you have information.
            </p>
          ) : null}
          {isResolved ? (
            <p className="pp-banner pp-banner--safe" style={{ marginTop: "0.35rem" }}>
              Reunited — this alert is closed.
            </p>
          ) : null}

          <p className="alert-body">{String(post.description)}</p>

          {(() => {
            const homeDir = homeAreaDirectionsUrl(post);
            const pinDir = alertPinDirectionsUrl(post);
            const hasContact = Boolean(post.contact_phone || post.contact_email || homeDir || pinDir);
            if (!hasContact) return null;
            return (
              <div className="alert-contact-actions">
                {post.contact_phone ? (
                  <a className="btn btn-amber" href={`tel:${String(post.contact_phone)}`}>
                    Call
                  </a>
                ) : null}
                {homeDir ? (
                  <a
                    className="btn btn-amber"
                    href={homeDir}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Directions home
                  </a>
                ) : null}
                {pinDir ? (
                  <a
                    className="btn btn-outline"
                    href={pinDir}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {homeDir ? "Directions last seen" : "Get directions"}
                  </a>
                ) : null}
                {post.contact_email ? (
                  <a className="btn btn-outline" href={`mailto:${String(post.contact_email)}`}>
                    Email
                  </a>
                ) : null}
              </div>
            );
          })()}

          {user &&
          (Number(post.user_id) === user.id || user.role === "admin") ? (
            <div className="alert-contact-actions" style={{ marginTop: "0.75rem" }}>
              <Link className="btn btn-outline" href={`/post/${postId}/edit`}>
                Edit post
              </Link>
              <DeletePostButton postId={postId} />
            </div>
          ) : null}
        </div>
      </div>

      <div className="alert-detail__engage">
        <LikeCommentBar
          postId={postId}
          initialLiked={liked}
          initialLikeCount={likes}
          initialCommentCount={commentCount}
          loggedIn={Boolean(user)}
        />
      </div>
    </div>
  );
}
