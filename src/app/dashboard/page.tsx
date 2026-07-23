import Link from "next/link";
import { redirect } from "next/navigation";
import { BodyClass } from "@/components/BodyClass";
import { mediaUrl } from "@/lib/media";
import { getCurrentUser } from "@/lib/auth";
import { getPool } from "@/lib/db";

export const metadata = { title: "Dashboard" };

function postTypeLabel(type: string): string {
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

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const pool = getPool();
  const [petRows] = await pool.query(
    `SELECT id, name, species, breed, status, public_slug, photo_path
     FROM pets WHERE user_id = ? ORDER BY updated_at DESC`,
    [user.id],
  );
  const pets = petRows as {
    id: number;
    name: string;
    species: string;
    breed: string | null;
    status: string;
    public_slug: string;
    photo_path: string | null;
  }[];

  const [postRows] = await pool.query(
    `SELECT id, type, title, status, photo_path, location_text
     FROM posts WHERE user_id = ? ORDER BY created_at DESC LIMIT 6`,
    [user.id],
  );
  const posts = postRows as {
    id: number;
    type: string;
    title: string;
    status: string;
    photo_path: string | null;
    location_text: string | null;
  }[];

  return (
    <>
      <BodyClass name="dashboard-page" />
      <div className="page-wrap dashboard-wrap">
        <div className="dash-head dashboard-head">
          <div>
            <h1 className="page-title">Dashboard</h1>
            <p className="muted">Pets, QR tags, and your recent posts.</p>
          </div>
          <div className="dashboard-actions">
            <Link className="btn btn-small btn-outline" href="/pets/new">
              Add pet
            </Link>
            <Link className="btn btn-small btn-outline" href="/create">
              New post
            </Link>
          </div>
        </div>

        <section className="dashboard-section">
          <div className="dashboard-section-head">
            <h2>Your pets</h2>
            <span className="meta">{pets.length} registered</span>
          </div>
          {pets.length === 0 ? (
            <div className="empty">No pets yet. Register one to generate a QR tag.</div>
          ) : (
            <div className="pet-grid">
              {pets.map((pet) => (
                <article key={pet.id} className="pet-tile">
                  {pet.photo_path ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={mediaUrl(pet.photo_path) || undefined} alt={pet.name} />
                  ) : (
                    <div className="cover-img pet-cover-empty" />
                  )}
                  <div className="tile-body">
                    <span className={`badge badge-${pet.status}`}>{pet.status}</span>
                    <h3>{pet.name}</h3>
                    <p className="meta">
                      {pet.species}
                      {pet.breed ? ` · ${pet.breed}` : ""}
                    </p>
                    <div className="tile-actions">
                      <Link className="btn btn-small" href={`/pets/${pet.id}`}>
                        Manage
                      </Link>
                      <Link
                        className="btn btn-small btn-outline"
                        href={`/pet/${pet.public_slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Public page
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="dashboard-section">
          <div className="dashboard-section-head">
            <h2>Recent posts</h2>
            <Link className="meta dashboard-link" href="/feed">
              Open feed
            </Link>
          </div>
          {posts.length === 0 ? (
            <div className="empty">No posts yet. Share a story or Found/Missing alert.</div>
          ) : (
            <div className="feed-grid">
              {posts.map((post) => (
                <Link key={post.id} className="feed-tile" href={`/post/${post.id}`}>
                  {post.photo_path ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={mediaUrl(post.photo_path) || undefined} alt="" />
                  ) : (
                    <div className="cover-img post-cover-empty" />
                  )}
                  <div className="tile-body">
                    <span
                      className={`badge badge-${post.status === "resolved" ? "resolved" : post.type}`}
                    >
                      {post.status === "resolved" ? "resolved" : postTypeLabel(post.type)}
                    </span>
                    <h3>{post.title}</h3>
                    <p className="meta">{post.location_text || "No location noted"}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
