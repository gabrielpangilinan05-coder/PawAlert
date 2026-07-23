"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { NotifBadge } from "@/components/NotifBadge";

type NotifItem = {
  id: number;
  type: "comment" | "message" | "share";
  title: string;
  body: string | null;
  link: string;
  read_at: string | null;
  time_ago: string;
};

function typeLabel(type: NotifItem["type"]): string {
  if (type === "comment") return "Comment";
  if (type === "share") return "Share";
  return "Message";
}

export function NotificationBell() {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<NotifItem[]>([]);
  const [loading, setLoading] = useState(false);

  async function pull() {
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      const data = await res.json();
      if (!data?.ok) return;
      setUnread(Number(data.unread || 0));
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (cancelled) return;
      await pull();
    }
    run();
    const id = window.setInterval(run, 30000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function toggleOpen() {
    const next = !open;
    setOpen(next);
    if (next) {
      setLoading(true);
      await pull();
      setLoading(false);
    }
  }

  async function openItem(item: NotifItem) {
    if (!item.read_at) {
      try {
        await fetch("/api/notifications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "read", id: item.id }),
        });
        setItems((prev) =>
          prev.map((n) => (n.id === item.id ? { ...n, read_at: new Date().toISOString() } : n)),
        );
        setUnread((u) => Math.max(0, u - 1));
      } catch {
        /* ignore */
      }
    }
    setOpen(false);
    router.push(item.link);
  }

  async function markAll() {
    try {
      await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "read_all" }),
      });
      setItems((prev) => prev.map((n) => ({ ...n, read_at: n.read_at || new Date().toISOString() })));
      setUnread(0);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="notif-bell" ref={rootRef}>
      <button
        type="button"
        className="notif-bell__btn"
        aria-label="Notifications"
        aria-expanded={open}
        onClick={toggleOpen}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="notif-bell__icon">
          <path d="M12 3a5 5 0 0 0-5 5v2.2c0 .7-.2 1.4-.6 2L5 14.5V16h14v-1.5L15.6 12.2c-.4-.6-.6-1.3-.6-2V8a5 5 0 0 0-5-5Z" />
          <path d="M10 18a2 2 0 0 0 4 0" />
        </svg>
        <NotifBadge count={unread} label={`${unread} unread notifications`} />
      </button>

      {open ? (
        <div className="notif-panel" role="dialog" aria-label="Notifications">
          <div className="notif-panel__head">
            <strong>Notifications</strong>
            {unread > 0 ? (
              <button type="button" className="link-plain" onClick={markAll}>
                Mark all read
              </button>
            ) : null}
          </div>
          <div className="notif-panel__list">
            {loading && items.length === 0 ? (
              <p className="muted notif-panel__empty">Loading…</p>
            ) : null}
            {!loading && items.length === 0 ? (
              <p className="muted notif-panel__empty">No notifications yet.</p>
            ) : null}
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`notif-item${item.read_at ? "" : " is-unread"}`}
                onClick={() => openItem(item)}
              >
                <span className="notif-item__type">{typeLabel(item.type)}</span>
                <span className="notif-item__title">{item.title}</span>
                {item.body ? <span className="notif-item__body">{item.body}</span> : null}
                <span className="notif-item__time">{item.time_ago}</span>
              </button>
            ))}
          </div>
          <div className="notif-panel__foot">
            <Link href="/messages" onClick={() => setOpen(false)}>
              Open messages
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
