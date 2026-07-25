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
      <div className="panel create-panel">
        <h1>Create a post</h1>
        <p className="muted create-lead">
          Story, tip, or Found / Missing alert.
          {!user ? " Guests can post Found alerts only." : null}
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
