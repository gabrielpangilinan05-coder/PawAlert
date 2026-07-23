"use client";

/** Small red count pill for nav / action buttons. */
export function NotifBadge({
  count,
  label,
}: {
  count: number;
  /** Accessible label, e.g. "3 unread messages" */
  label?: string;
}) {
  if (!count || count < 1) return null;
  const text = count > 99 ? "99+" : String(count);
  return (
    <span className="notif-badge" aria-label={label || `${count} new`}>
      {text}
    </span>
  );
}
