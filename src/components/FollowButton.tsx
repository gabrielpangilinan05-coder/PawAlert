"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function FollowButton({
  userId,
  initialFollowing,
}: {
  userId: number;
  initialFollowing: boolean;
}) {
  const router = useRouter();
  const [following, setFollowing] = useState(initialFollowing);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    try {
      const res = await fetch("/api/follow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setFollowing(Boolean(data.following));
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      className={`btn btn-small ${following ? "btn-outline" : "btn-amber"}`}
      onClick={toggle}
      disabled={busy}
    >
      {following ? "Following" : "Follow"}
    </button>
  );
}
