import Link from "next/link";
import { notFound } from "next/navigation";
import { DeletePostButton } from "@/components/DeletePostButton";
import { LikeCommentBar } from "@/components/LikeCommentBar";
import { PostMediaGallery } from "@/components/PostMediaGallery";
import { PostPhotoZoom } from "@/components/PostPhotoZoom";
import { PostShareButton } from "@/components/PostShareButton";
import { getAdminUser } from "@/lib/admin";
import { getCurrentUser, mediaUrl } from "@/lib/auth";
import { alertPinDirectionsUrl } from "@/lib/directions";
import { appOrigin } from "@/lib/media";
import { hasOwnerContact, resolveOwnerContact } from "@/lib/owner-contact";
import { cleanPostBody, shortPlace } from "@/lib/post-display";
import { getPostById, listPostMedia } from "@/lib/posts";
import { postShareKind } from "@/lib/share";
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
  const place = shortPlace(String(post.location_text || ""));
  const desc =
    cleanPostBody(String(post.description || ""), {
      locationText: String(post.location_text || ""),
      species: String(post.species || ""),
    }) ||
    (place ? `Last seen near ${place}` : String(post.title));
  return {
    title: String(post.title),
    description: desc.slice(0, 160),
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

  let commentCount = 0;
  try {
    const pool = getPool();
    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS c FROM post_comments WHERE post_id = ?`,
      [postId],
    );
    commentCount = Number((countRows as { c: number }[])[0]?.c ?? 0);
  } catch {
    commentCount = 0;
  }

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
  const isAlert = isMissing || isFound || isResolved;

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

  const locationFull = String(post.location_text || "").trim();
  const locationShort = shortPlace(locationFull);
  const species = String(post.species || "").trim();
  const petBreed = post.pet_breed != null ? String(post.pet_breed).trim() : "";
  const body = cleanPostBody(String(post.description || ""), {
    locationText: locationFull,
    species,
    breed: petBreed,
  });

  const owner = resolveOwnerContact(post);
  const pinDir = isMissing || isFound ? alertPinDirectionsUrl(post) : null;
  const ownerUserId = Number(post.user_id) || 0;
  const canMessageOwner = ownerUserId > 0 && (!user || user.id !== ownerUserId);
  const hasContact =
    hasOwnerContact(owner) || Boolean(pinDir) || canMessageOwner;
  const canManage = Boolean(
    user && (ownerUserId === user.id || user.role === "admin"),
  );

  const shareKind = postShareKind(String(post.type), String(post.status));
  const origin = appOrigin();
  const sharePetName =
    (post.pet_name ? String(post.pet_name) : null) ||
    (shareKind !== "post"
      ? String(post.title).replace(/\s+is missing$/i, "")
      : String(post.title));
  const shareUrl = post.pet_slug
    ? `${origin}/pet/${String(post.pet_slug)}`
    : `${origin}/post/${postId}`;

  const facts: { label: string; value: string }[] = [];
  if (species || petBreed) {
    facts.push({
      label: "Pet",
      value: [species, petBreed].filter(Boolean).join(" · "),
    });
  }
  if (locationFull) {
    facts.push({
      label: isMissing || isResolved ? "Last seen" : "Location",
      value: locationFull,
    });
  }
  if (post.contact_name && isAlert) {
    facts.push({ label: "Posted by", value: String(post.contact_name) });
  }

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
        <div className="alert-hero__media">
          {galleryItems.length > 1 || galleryItems.some((g) => g.media_type === "video") ? (
            <PostMediaGallery items={galleryItems} alt={String(post.title)} />
          ) : (
            <PostPhotoZoom src={photo!} alt={String(post.title)} />
          )}
        </div>

        <div className="alert-hero-copy">
          <span className={`badge badge-${badgeClass}`}>{statusLabel}</span>
          <h1 className="alert-name">{String(post.title)}</h1>
          <p className="alert-kind">
            <span>{String(post.author_name || "Guest")}</span>
            {species ? (
              <>
                <span aria-hidden> · </span>
                <span>{species}</span>
              </>
            ) : null}
            {locationShort ? (
              <>
                <span aria-hidden> · </span>
                <span title={locationFull || undefined}>{locationShort}</span>
              </>
            ) : null}
          </p>

          {facts.length > 0 ? (
            <dl className="alert-facts">
              {facts.map((f) => (
                <div key={f.label} className="alert-facts__row">
                  <dt>{f.label}</dt>
                  <dd>{f.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}

          {body ? <p className="alert-body">{body}</p> : null}

          {hasContact ? (
            <div className="alert-contact-actions">
              {owner.phone ? (
                <a className="btn btn-amber" href={`tel:${owner.phone}`}>
                  Call
                </a>
              ) : null}
              {canMessageOwner ? (
                <Link
                  className="btn btn-amber"
                  href={user ? `/messages?with=${ownerUserId}` : "/login"}
                >
                  Message
                </Link>
              ) : null}
              {owner.messengerHref ? (
                <a
                  className="btn btn-outline"
                  href={owner.messengerHref}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Messenger
                </a>
              ) : null}
              {owner.homeDirections ? (
                <a
                  className="btn btn-outline"
                  href={owner.homeDirections}
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
                  Directions last seen
                </a>
              ) : null}
              {owner.email ? (
                <a className="btn btn-outline" href={`mailto:${owner.email}`}>
                  Email
                </a>
              ) : null}
            </div>
          ) : null}

          <div className="alert-contact-actions alert-owner-actions">
            <PostShareButton
              className="btn btn-outline"
              label="Share"
              details={{
                petName: sharePetName,
                species: species || null,
                breed: petBreed || null,
                lastSeenText: locationFull || null,
                lastSeenNotes: body || null,
                lastSeenAt:
                  post.pet_last_seen_at != null
                    ? String(post.pet_last_seen_at)
                    : String(post.created_at),
                publicUrl: shareUrl,
                photoUrl: photo,
                kind: shareKind,
              }}
            />
            {canManage ? (
              <>
                <Link className="btn btn-outline" href={`/post/${postId}/edit`}>
                  Edit post
                </Link>
                <DeletePostButton postId={postId} />
              </>
            ) : null}
          </div>
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
