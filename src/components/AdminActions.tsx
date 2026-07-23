"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

async function postJson(url: string, body: Record<string, unknown>) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "Request failed");
  }
  return data;
}

export function AdminPostActions({
  postId,
  hidden,
}: {
  postId: number;
  hidden: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: string) {
    if (action === "delete" && !window.confirm(`Delete post #${postId} permanently?`)) return;
    setBusy(true);
    setError(null);
    try {
      const reason =
        action === "hide"
          ? window.prompt("Hide reason (optional):", "Hidden by moderator") || undefined
          : undefined;
      await postJson("/api/admin/posts", { action, post_id: postId, reason });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-actions">
      {hidden ? (
        <button type="button" className="btn btn-sm btn-outline" disabled={busy} onClick={() => run("unhide")}>
          Unhide
        </button>
      ) : (
        <button type="button" className="btn btn-sm btn-outline" disabled={busy} onClick={() => run("hide")}>
          Hide
        </button>
      )}
      <button type="button" className="btn btn-sm btn-danger" disabled={busy} onClick={() => run("delete")}>
        Delete
      </button>
      {error ? <span className="admin-error">{error}</span> : null}
    </div>
  );
}

export function AdminUserActions({
  userId,
  banned,
  isAdmin,
}: {
  userId: number;
  banned: boolean;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: string) {
    setBusy(true);
    setError(null);
    try {
      const reason =
        action === "ban"
          ? window.prompt("Ban reason (optional):", "Banned by moderator") || undefined
          : undefined;
      await postJson("/api/admin/users", { action, user_id: userId, reason });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-actions">
      {banned ? (
        <button type="button" className="btn btn-sm btn-outline" disabled={busy} onClick={() => run("unban")}>
          Unban
        </button>
      ) : (
        <button type="button" className="btn btn-sm btn-danger" disabled={busy} onClick={() => run("ban")}>
          Ban
        </button>
      )}
      {isAdmin ? (
        <button
          type="button"
          className="btn btn-sm btn-outline"
          disabled={busy}
          onClick={() => run("remove_admin")}
        >
          Remove admin
        </button>
      ) : (
        <button
          type="button"
          className="btn btn-sm btn-outline"
          disabled={busy}
          onClick={() => run("make_admin")}
        >
          Make admin
        </button>
      )}
      {error ? <span className="admin-error">{error}</span> : null}
    </div>
  );
}

export function AdminReportActions({ reportId }: { reportId: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function run(action: string) {
    setBusy(true);
    try {
      await postJson("/api/admin/reports", { action, report_id: reportId });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-actions">
      <button type="button" className="btn btn-sm btn-amber" disabled={busy} onClick={() => run("resolve")}>
        Resolve
      </button>
      <button type="button" className="btn btn-sm btn-outline" disabled={busy} onClick={() => run("dismiss")}>
        Dismiss
      </button>
    </div>
  );
}
