import Link from "next/link";
import { mediaUrl } from "@/lib/auth";
import type { FeedPost } from "@/lib/posts";

function badgeClass(type: string, status: string) {
  if (status === "resolved") return "badge badge-resolved";
  if (type === "missing") return "badge badge-missing";
  if (type === "found") return "badge badge-found";
  return "badge";
}

export function PostCard({ post }: { post: FeedPost }) {
  const photo =
    mediaUrl(post.photo_path) || mediaUrl(post.pet_photo_path) || "/icons/icon-512.png";
  const when =
    typeof post.created_at === "string"
      ? post.created_at
      : new Date(post.created_at).toLocaleString();

  return (
    <article className="post-card">
      <Link href={`/post/${post.id}`} className="post-card-media">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo} alt={post.title} />
      </Link>
      <div className="post-card-body">
        <div className="post-card-meta">
          <span className={badgeClass(post.type, post.status)}>
            {post.status === "resolved" ? "reunited" : post.type}
          </span>
          <span className="muted">{when}</span>
        </div>
        <h2>
          <Link href={`/post/${post.id}`}>{post.title}</Link>
        </h2>
        <p className="muted clamp-2">{post.description}</p>
        <div className="post-card-foot">
          <span>{post.author_name || "Guest"}</span>
          <span>
            {post.like_count} likes · {post.comment_count} comments
          </span>
        </div>
      </div>
    </article>
  );
}
