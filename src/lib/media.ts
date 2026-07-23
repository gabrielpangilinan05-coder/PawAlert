/** Client-safe media URL helper (no server imports). */
export function mediaUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  const clean = path.replace(/^\/+/, "");
  if (clean.startsWith("uploads/")) {
    return `/${clean}`;
  }
  return `/uploads/${clean}`;
}

/** Public origin for share links / Open Graph (set via NEXT_PUBLIC_APP_URL). */
export function appOrigin(): string {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "http://localhost:3000";
}

/**
 * Origin of the current request (Cloudflare / reverse proxy aware).
 * Prefer this for og:image so crawlers get a reachable HTTPS URL.
 */
export async function requestOrigin(): Promise<string> {
  try {
    const { headers } = await import("next/headers");
    const h = await headers();
    const host = (h.get("x-forwarded-host") || h.get("host") || "")
      .split(",")[0]
      ?.trim();
    if (host) {
      const protoHeader = h.get("x-forwarded-proto")?.split(",")[0]?.trim();
      const proto =
        protoHeader ||
        (host.includes("localhost") || host.startsWith("127.") ? "http" : "https");
      return `${proto}://${host}`;
    }
  } catch {
    /* generateStaticParams / build */
  }
  return appOrigin();
}

/** Absolute media URL for crawlers (Facebook, X, etc.). */
export function absoluteMediaUrl(
  path: string | null | undefined,
  fallback = "/og-default.png",
  origin = appOrigin(),
): string {
  const rel = mediaUrl(path) || fallback;
  if (/^https?:\/\//i.test(rel)) return rel;
  return `${origin}${rel.startsWith("/") ? rel : `/${rel}`}`;
}
