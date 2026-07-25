import { redirect, notFound } from "next/navigation";
import { EditPostForm } from "@/components/EditPostForm";
import { getCurrentUser, mediaUrl } from "@/lib/auth";
import { getPostById, listPostMedia } from "@/lib/posts";

export const metadata = { title: "Edit post" };

export default async function EditPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const postId = Number(id);
  if (!Number.isFinite(postId) || postId < 1) notFound();

  const post = await getPostById(postId);
  if (!post) notFound();

  const ownerId = post.user_id == null ? null : Number(post.user_id);
  if (ownerId !== user.id && user.role !== "admin") {
    redirect(`/post/${postId}`);
  }

  const gallery = await listPostMedia(postId);
  const media =
    gallery.length > 0
      ? gallery.map((g) => ({
          id: g.id,
          url: mediaUrl(g.file_path) || "",
          kind: (g.media_type === "video" ? "video" : "image") as "image" | "video",
        }))
      : post.photo_path
        ? [
            {
              id: 0,
              url: mediaUrl(String(post.photo_path)) || "",
              kind: (String(post.media_type || "image") === "video"
                ? "video"
                : "image") as "image" | "video",
            },
          ]
        : [];

  const toNum = (v: unknown) => {
    if (v == null || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  return (
    <div className="page-wrap">
      <div className="panel create-panel">
        <h1>Edit post</h1>
        <p className="muted create-lead">Update details or add more photos and videos.</p>
        <EditPostForm
          postId={postId}
          initial={{
            type: String(post.type),
            title: String(post.title || ""),
            description: String(post.description || ""),
            species: String(post.species || "Dog"),
            locationText: String(post.location_text || ""),
            locationLat: toNum(post.location_lat),
            locationLng: toNum(post.location_lng),
            contactName: String(post.contact_name || user.name || ""),
            contactPhone: String(post.contact_phone || ""),
            contactEmail: String(post.contact_email || ""),
            media: media.filter((m) => m.url),
          }}
        />
      </div>
    </div>
  );
}
