import { CreatePostForm } from "@/components/CreatePostForm";
import { getCurrentUser } from "@/lib/auth";
import { listOwnedPets } from "@/lib/pets";

export const metadata = { title: "Create post" };

export default async function CreatePostPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const user = await getCurrentUser();
  const params = await searchParams;
  const pets = user ? await listOwnedPets(user.id) : [];

  return (
    <div className="page-wrap">
      <div className="panel" style={{ maxWidth: 560 }}>
        <h1>Create a post</h1>
        <p className="muted">
          Share a story, tip, question, or Found / Missing alert with the community.
          {!user && " Guests can only post Found alerts — log in for other types."}
        </p>
        <CreatePostForm
          userName={user?.name}
          userPhone={user?.phone}
          userEmail={user?.email}
          pets={pets}
          defaultType={params.type || "story"}
        />
      </div>
    </div>
  );
}
