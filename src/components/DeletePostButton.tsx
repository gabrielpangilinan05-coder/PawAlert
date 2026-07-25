"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function DeletePostButton({
  postId,
  className = "btn btn-danger",
  redirectTo = "/profile",
}: {
  postId: number;
  className?: string;
  redirectTo?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onDelete() {
    if (
      !window.confirm(
        "Delete this post permanently? Photos/videos on it will be removed too.",
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/posts/${postId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        window.alert(data.error || "Could not delete post.");
        return;
      }
      router.push(redirectTo);
      router.refresh();
    } catch {
      window.alert("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" className={className} disabled={busy} onClick={() => void onDelete()}>
      {busy ? "Deleting…" : "Delete post"}
    </button>
  );
}
