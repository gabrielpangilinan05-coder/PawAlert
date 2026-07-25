"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { User } from "@/lib/auth";
import { petSlugFromQr } from "@/lib/qr-scan";
import { QrCameraScanner } from "@/components/QrCameraScanner";
import { NotifBadge } from "@/components/NotifBadge";
import { NotificationBell } from "@/components/NotificationBell";

export function SiteHeader({
  user,
  initialUnreadMessages = 0,
}: {
  user: User | null;
  initialUnreadMessages?: number;
}) {
  const router = useRouter();
  const [navOpen, setNavOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [scanValue, setScanValue] = useState("");
  const [scanError, setScanError] = useState<string | null>(null);
  const [unreadMessages, setUnreadMessages] = useState(initialUnreadMessages);

  useEffect(() => {
    document.body.classList.toggle("nav-open", navOpen);
  }, [navOpen]);

  useEffect(() => {
    setUnreadMessages(initialUnreadMessages);
  }, [initialUnreadMessages]);

  useEffect(() => {
    if (!user) {
      setUnreadMessages(0);
      return;
    }
    let cancelled = false;
    async function pull() {
      try {
        const res = await fetch("/api/notifications", { cache: "no-store" });
        const data = await res.json();
        if (!cancelled && data?.ok) {
          setUnreadMessages(Number(data.messages || 0));
        }
      } catch {
        /* ignore */
      }
    }
    pull();
    const id = window.setInterval(pull, 30000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [user]);

  useEffect(() => {
    if (!scanOpen) {
      setScanValue("");
      setScanError(null);
    }
  }, [scanOpen]);

  function openFromRaw(raw: string): boolean {
    const slug = petSlugFromQr(raw);
    if (!slug) {
      setScanError("That doesn’t look like a PawAlert pet QR.");
      return false;
    }
    setScanError(null);
    setScanOpen(false);
    router.push(`/pet/${encodeURIComponent(slug)}`);
    return true;
  }

  function goScan(e: React.FormEvent) {
    e.preventDefault();
    openFromRaw(scanValue);
  }

  return (
    <>
      <header className={`site-header${navOpen ? " nav-open" : ""}`}>
        <Link href="/" className="brand">
          PawAlert
        </Link>
        <div className="header-tools">
          {user ? (
            <form className="header-search" action="/people" method="get" role="search">
              <svg className="header-search-icon" aria-hidden="true" viewBox="0 0 24 24">
                <path d="m21 21-4.35-4.35m2.35-5.65a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z" />
              </svg>
              <input type="search" name="q" placeholder="Search PawAlert" aria-label="Search PawAlert users" />
            </form>
          ) : null}
          <button
            type="button"
            className="header-scan-btn"
            aria-label="Scan pet QR code"
            title="Scan pet QR"
            onClick={() => setScanOpen(true)}
          >
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <path d="M4 7V5a1 1 0 0 1 1-1h2M17 4h2a1 1 0 0 1 1 1v2M20 17v2a1 1 0 0 1-1 1h-2M7 20H5a1 1 0 0 1-1-1v-2" />
              <path d="M7 7h3v3H7V7Zm7 0h3v3h-3V7ZM7 14h3v3H7v-3Zm7 2h3M14 14h1.5" />
            </svg>
            <span>Scan QR</span>
          </button>
        </div>
        <button
          className="nav-toggle"
          type="button"
          aria-label="Menu"
          aria-expanded={navOpen}
          onClick={() => setNavOpen((o) => !o)}
        >
          ☰
        </button>
        <nav className="site-nav" onClick={(e) => {
          const t = e.target as HTMLElement;
          if (t.closest("a") || t.closest("button.linkish")) setNavOpen(false);
        }}>
          <Link href="/how-it-works">How it Works</Link>
          <Link href="/feed">Feed</Link>
          {user ? (
            <>
              <NotificationBell />
              <Link href="/messages" className="nav-link-notif">
                Messages
                <NotifBadge
                  count={unreadMessages}
                  label={`${unreadMessages} unread messages`}
                />
              </Link>
              <Link href="/dashboard">Dashboard</Link>
              <Link href="/profile">Profile</Link>
              {user.role === "admin" ? <Link href="/admin">Admin</Link> : null}
              <Link href="/pets/new">Add Pet</Link>
              <form action="/api/auth/logout" method="post" className="inline">
                <button type="submit" className="nav-muted linkish">
                  Log out
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login">Log in</Link>
              <Link href="/register" className="btn btn-sm btn-amber">
                Get started
              </Link>
            </>
          )}
        </nav>
      </header>

      {scanOpen ? (
        <div className="qr-scan-backdrop" role="presentation" onClick={() => setScanOpen(false)}>
          <div
            className="qr-scan-dialog"
            role="dialog"
            aria-label="Scan pet QR"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="qr-scan-head">
              <h2>Scan QR</h2>
            </div>
            <p className="qr-scan-hint muted">
              Use your phone camera here, or the built-in Camera app on a printed tag with a live public
              URL.
            </p>
            <div className="qr-scan-body">
              <QrCameraScanner onDetected={openFromRaw} onError={setScanError} />
              {scanError ? <div className="flash flash-error">{scanError}</div> : null}
              <form onSubmit={goScan} className="form-grid">
                <label>
                  Or paste URL / slug
                  <input
                    value={scanValue}
                    onChange={(e) => setScanValue(e.target.value)}
                    placeholder="e.g. /pet/… or slug"
                    autoComplete="off"
                  />
                </label>
                <div className="qr-scan-actions">
                  <button type="button" className="btn btn-outline" onClick={() => setScanOpen(false)}>
                    Close
                  </button>
                  <button type="submit" className="btn btn-amber">
                    Open
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
