import Link from "next/link";
import { AlertFeedCard } from "@/components/AlertFeedCard";
import {
  AlertFilterPanel,
  DEFAULT_ALERT_LOCATION,
} from "@/components/AlertFilterPanel";
import { BodyClass } from "@/components/BodyClass";
import { SocialCard } from "@/components/SocialCard";
import { UserAvatar } from "@/components/UserAvatar";
import { getCurrentUser } from "@/lib/auth";
import { listFeedPosts } from "@/lib/posts";
import { likedPostIds } from "@/lib/social";

export const metadata = { title: "Feed" };

const FILTERS = [
  { key: "all", label: "All" },
  { key: "story", label: "Stories" },
  { key: "tip", label: "Tips" },
  { key: "question", label: "Questions" },
  { key: "found", label: "Found" },
  { key: "missing", label: "Missing" },
  { key: "resolved", label: "Resolved" },
] as const;

function typeToStatus(type: string): string {
  if (type === "found") return "found";
  if (type === "resolved") return "reunited";
  return "lost";
}

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{
    type?: string;
    species?: string;
    sex?: string;
    sort?: string;
    within?: string;
    loc?: string;
    near_lat?: string;
    near_lng?: string;
    radius?: string;
  }>;
}) {
  const params = await searchParams;
  const type = params.type || "all";
  const isAlert = type === "missing" || type === "found" || type === "resolved";
  const user = await getCurrentUser();

  const nearLatRaw = params.near_lat ? Number(params.near_lat) : NaN;
  const nearLngRaw = params.near_lng ? Number(params.near_lng) : NaN;
  const nearLat = Number.isFinite(nearLatRaw)
    ? nearLatRaw
    : isAlert
      ? DEFAULT_ALERT_LOCATION.lat
      : undefined;
  const nearLng = Number.isFinite(nearLngRaw)
    ? nearLngRaw
    : isAlert
      ? DEFAULT_ALERT_LOCATION.lng
      : undefined;
  const radiusRaw = params.radius ? Number(params.radius) : NaN;
  const radiusMiles = Number.isFinite(radiusRaw) && radiusRaw > 0 ? radiusRaw : isAlert ? 25 : undefined;
  const locationLabel = params.loc || DEFAULT_ALERT_LOCATION.label;

  const posts = await listFeedPosts(
    isAlert
      ? {
          type,
          species: params.species,
          sex: params.sex,
          sort: params.sort || "updated",
          within: params.within || "3m",
          nearLat: Number.isFinite(nearLat) ? nearLat : undefined,
          nearLng: Number.isFinite(nearLng) ? nearLng : undefined,
          radiusMiles: Number.isFinite(radiusMiles) ? radiusMiles : 25,
        }
      : { type },
  );

  const liked = user
    ? await likedPostIds(
        posts.map((p) => p.id),
        user.id,
      )
    : new Set<number>();

  const firstName = user?.name?.trim().split(/\s+/)[0] || "friend";
  const createType = type === "found" ? "found" : "missing";
  const createHref = isAlert ? `/create?type=${createType}` : "/create";
  const pageTitle =
    type === "missing" ? "Missing" : type === "found" ? "Found" : type === "resolved" ? "Resolved" : "Feed";

  return (
    <>
      <BodyClass name="feed-page" />
      <div className={`page-wrap social-feed-wrap${isAlert ? " alert-feed-wrap" : ""}`}>
        <div className="dash-head feed-head">
          <div className="feed-head__intro">
            <h1 className="page-title">{pageTitle}</h1>
            <p className="muted">
              {isAlert
                ? "Filter by status, location, and distance to find pets that need help."
                : "Community tips, stories, and urgent Found & Missing alerts near you."}
            </p>
          </div>
          {isAlert ? (
            <Link className="btn btn-primary" href={createHref}>
              Post {createType === "missing" ? "Missing" : "Found"} alert
            </Link>
          ) : null}
        </div>

        <nav className="feed-filters" aria-label="Feed filters">
          {FILTERS.map((f) => (
            <Link
              key={f.key}
              href={f.key === "all" ? "/feed" : `/feed?type=${f.key}`}
              className={type === f.key ? "active" : undefined}
            >
              {f.label}
            </Link>
          ))}
        </nav>

        {isAlert ? (
          <div className="alert-feed-layout">
            <AlertFilterPanel
              alertType={type}
              initial={{
                status: typeToStatus(type),
                species: params.species || "all",
                sex: params.sex || "all",
                sort: params.sort || "updated",
                within: params.within || "3m",
                location: locationLabel,
                nearLat: String(nearLat ?? DEFAULT_ALERT_LOCATION.lat),
                nearLng: String(nearLng ?? DEFAULT_ALERT_LOCATION.lng),
                radius: String(radiusMiles ?? 25),
              }}
            />

            <div className="alert-feed-main">
              {posts.length === 0 ? (
                <div className="feed-empty">
                  <strong>No alerts match these filters</strong>
                  <p className="muted">
                    Try a wider distance, different status, or longer date range — or post an alert.
                  </p>
                  <Link className="btn btn-amber" href={createHref}>
                    Post {createType === "missing" ? "Missing" : "Found"} alert
                  </Link>
                </div>
              ) : (
                <div className="alert-feed-list">
                  {posts.map((post) => (
                    <AlertFeedCard key={post.id} post={post} />
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="composer-block">
              {user ? (
                <Link href="/create" className="composer-card">
                  <UserAvatar name={user.name} src={user.avatarPath} />
                  <div className="composer-prompt">
                    Share a tip or alert, {firstName}…
                  </div>
                </Link>
              ) : (
                <Link href="/login" className="composer-card">
                  <div className="composer-avatar">?</div>
                  <div className="composer-prompt">Log in to share with the community…</div>
                </Link>
              )}
              <div className="composer-chips" aria-label="Quick post types">
                <Link href="/create?type=missing" className="composer-chip composer-chip--missing">
                  Missing
                </Link>
                <Link href="/create?type=found" className="composer-chip composer-chip--found">
                  Found
                </Link>
                <Link href="/create?type=tip" className="composer-chip">
                  Tip
                </Link>
                <Link href="/create?type=story" className="composer-chip">
                  Story
                </Link>
              </div>
            </div>

            {posts.length === 0 ? (
              <div className="feed-empty">
                <strong>No posts here yet</strong>
                <p className="muted">Be the first to share a tip, story, or Found &amp; Missing alert.</p>
                <Link className="btn btn-amber" href="/create">
                  Create a post
                </Link>
              </div>
            ) : (
              <div className="social-feed">
                {posts.map((post) => (
                  <SocialCard
                    key={post.id}
                    post={post}
                    liked={liked.has(post.id)}
                    loggedIn={Boolean(user)}
                    currentUserName={user?.name}
                    currentUserId={user?.id ?? null}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
