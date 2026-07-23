"use client";

import { useCallback, useEffect, useState } from "react";

/** Personal unseen delta vs last acknowledged count (localStorage). */
export function useUnseenCount(storageKey: string, current: number) {
  const [seen, setSeen] = useState(0);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      setSeen(raw != null ? Math.max(0, Number(raw) || 0) : 0);
    } catch {
      setSeen(0);
    }
  }, [storageKey]);

  const unread = Math.max(0, current - seen);

  const markSeen = useCallback(() => {
    try {
      localStorage.setItem(storageKey, String(current));
    } catch {
      /* ignore */
    }
    setSeen(current);
  }, [storageKey, current]);

  const syncSeen = useCallback(
    (value: number) => {
      try {
        localStorage.setItem(storageKey, String(value));
      } catch {
        /* ignore */
      }
      setSeen(value);
    },
    [storageKey],
  );

  return { unread, markSeen, syncSeen };
}
