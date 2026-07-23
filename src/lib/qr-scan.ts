/** Extract a PawAlert pet public slug from a QR payload (URL or raw slug). */
export function petSlugFromQr(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;

  try {
    const url = new URL(value, "http://local.invalid");
    const slugParam = url.searchParams.get("slug");
    if (slugParam?.trim()) return slugParam.trim();

    const pathMatch = url.pathname.match(/\/pet\/([^/]+)/i);
    if (pathMatch?.[1]) return decodeURIComponent(pathMatch[1]);
  } catch {
    /* plain slug */
  }

  // Reject obvious non-slugs (spaces, long garbage)
  if (/^[\w.-]{4,80}$/.test(value)) return value;
  return null;
}
