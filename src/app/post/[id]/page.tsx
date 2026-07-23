import Link from "next/link";
import { notFound } from "next/navigation";
import { LikeCommentBar } from "@/components/LikeCommentBar";
import { getCurrentUser, mediaUrl } from "@/lib/auth";
import { getPostById } from "@/lib/posts";
import { postLikeCount, userLikedPost } from "@/lib/social";
import { getPool } from "@/lib/db";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const post = await getPostById(Number(id));
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

  const post = await getPostById(postId);
  if (!post) notFound();

  const user = await getCurrentUser();
  const liked = await userLikedPost(postId, user?.id ?? null);
  const likes = await postLikeCount(postId);

  const pool = getPool();
  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS c FROM post_comments WHERE post_id = ?`,
    [postId],
  );
  const commentCount = Number((countRows as { c: number }[])[0]?.c ?? 0);

  const photo =
    mediaUrl(post.photo_path as string | null) ||
    mediaUrl(post.pet_photo_path as string | null) ||
    "/icons/icon-512.png";

  const statusLabel =
    post.status === "resolved"
      ? "REUNITED"
      : post.type === "found"
        ? "FOUND"
        : post.type === "missing"
          ? "LOST"
          : String(post.type).toUpperCase();

  return (
    <div className="page-wrap alert-detail">
      <p>
        <Link href="/feed">← Back to feed</Link>
      </p>
      <div className="alert-photo">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo!} alt={String(post.title)} />
      </div>
      <div>
        <span className={`badge badge-${post.status === "resolved" ? "resolved" : post.type}`}>
          {statusLabel}
        </span>
        <h1 style={{ fontFamily: "var(--font-display)", margin: "0.5rem 0" }}>{String(post.title)}</h1>
        <p className="muted">
          {String(post.author_name || "Guest")}
          {post.location_text ? ` · ${String(post.location_text)}` : ""}
        </p>
        <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.55 }}>{String(post.description)}</p>
        {Boolean(post.contact_phone || post.contact_email) && (
          <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", marginTop: "1rem" }}>
            {post.contact_phone ? (
              <a className="btn btn-amber" href={`tel:${String(post.contact_phone)}`}>
                Call
              </a>
            ) : null}
            {post.contact_email ? (
              <a className="btn btn-outline" href={`mailto:${String(post.contact_email)}`}>
                Email
              </a>
            ) : null}
          </div>
        )}
      </div>

      <LikeCommentBar
        postId={postId}
        initialLiked={liked}
        initialLikeCount={likes}
        initialCommentCount={commentCount}
        loggedIn={Boolean(user)}
      />
    </div>
  );
}
