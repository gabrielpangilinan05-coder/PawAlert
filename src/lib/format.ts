/** Client-safe string helpers (no Node fs). */

export function relativeTime(datetime: string | Date): string {
  const ts = typeof datetime === "string" ? Date.parse(datetime) : datetime.getTime();
  if (!Number.isFinite(ts)) return String(datetime);
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(ts).toLocaleDateString();
}

export function userInitial(name: string): string {
  const t = name.trim();
  return t ? t[0]!.toUpperCase() : "?";
}

export function excerptText(text: string, limit = 280): string {
  const t = text.trim();
  if (t.length <= limit) return t;
  return `${t.slice(0, limit - 1).trimEnd()}…`;
}
