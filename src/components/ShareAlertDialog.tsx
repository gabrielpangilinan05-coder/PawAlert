"use client";

import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { appOrigin, mediaUrl } from "@/lib/media";
import type { FeedPost } from "@/lib/posts";

export type ShareKind = "missing" | "found" | "post";

export type ShareAlertDetails = {
  petName: string;
  species?: string | null;
  breed?: string | null;
  lastSeenText?: string | null;
  lastSeenNotes?: string | null;
  lastSeenAt?: string | null;
  publicUrl: string;
  /** Pet / last-seen photo for in-dialog preview (like the X card). */
  photoUrl?: string | null;
  /** Defaults to missing (manage-pet Share alert). */
  kind?: ShareKind;
};

function formatWhen(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function asIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  return value.toISOString();
}

/** Caption + URL for X / copy / native share. */
export function buildMissingShareMessage(d: ShareAlertDetails): string {
  const kind = d.kind || "missing";
  if (kind === "post") {
    const lines = [d.petName];
    if (d.lastSeenNotes) lines.push(d.lastSeenNotes);
    lines.push("");
    lines.push(d.publicUrl);
    return lines.join("\n");
  }
  if (kind === "found") {
    const lines = [`✅ FOUND: ${d.petName}`];
    const animal = [d.species, d.breed].filter(Boolean).join(" · ");
    if (animal) lines.push(animal);
    if (d.lastSeenText) lines.push(`Location: ${d.lastSeenText}`);
    if (d.lastSeenNotes) lines.push(`Details: ${d.lastSeenNotes}`);
    const when = formatWhen(d.lastSeenAt);
    if (when) lines.push(`Date & time: ${when}`);
    lines.push("");
    lines.push("Open the live profile:");
    lines.push(d.publicUrl);
    return lines.join("\n");
  }
  const lines = [`🚨 MISSING: ${d.petName}`];
  const animal = [d.species, d.breed].filter(Boolean).join(" · ");
  if (animal) lines.push(animal);
  if (d.lastSeenText) lines.push(`Last seen: ${d.lastSeenText}`);
  if (d.lastSeenNotes) lines.push(`Details: ${d.lastSeenNotes}`);
  const when = formatWhen(d.lastSeenAt);
  if (when) lines.push(`Date & time: ${when}`);
  lines.push("");
  lines.push("Help bring them home — open the live profile:");
  lines.push(d.publicUrl);
  return lines.join("\n");
}

/** Build share details from a feed / alert post (same dialog as Manage pet). */
export function shareDetailsFromFeedPost(post: FeedPost): ShareAlertDetails {
  const origin = appOrigin();

  let resolvedKind: ShareKind = "post";
  if (post.type === "missing") {
    resolvedKind = post.status === "resolved" ? "found" : "missing";
  } else if (post.type === "found") {
    resolvedKind = "found";
  }

  const petName =
    post.pet_name ||
    (resolvedKind !== "post" ? post.title.replace(/\s+is missing$/i, "") : post.title) ||
    "PawAlert";

  const publicUrl = post.pet_slug
    ? `${origin}/pet/${post.pet_slug}`
    : `${origin}/post/${post.id}`;

  const photo = mediaUrl(post.photo_path) || mediaUrl(post.pet_photo_path) || null;

  return {
    petName,
    species: post.species || null,
    breed: post.pet_breed,
    lastSeenText: post.pet_last_seen_text || post.location_text,
    lastSeenNotes:
      resolvedKind === "post"
        ? post.description?.trim() || null
        : post.pet_last_seen_notes || post.description?.trim() || null,
    lastSeenAt: asIso(post.pet_last_seen_at || (resolvedKind === "post" ? post.created_at : null)),
    publicUrl,
    photoUrl: photo,
    kind: resolvedKind,
  };
}

export function ShareAlertDialog({
  open,
  onClose,
  details,
  onShared,
}: {
  open: boolean;
  onClose: () => void;
  details: ShareAlertDetails;
  /** Fired once per successful share / copy action. */
  onShared?: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const [copied, setCopied] = useState(false);
  const kind = details.kind || "missing";
  const isLocal = /localhost|127\.0\.0\.1|192\.168\.|10\./i.test(details.publicUrl);
  const isPublic = !isLocal;

  const shareTitle =
    kind === "found"
      ? `${details.petName} was found`
      : kind === "post"
        ? details.petName
        : `${details.petName} is missing`;
  const shareMessage = useMemo(() => buildMissingShareMessage(details), [details]);
  const whenLabel = formatWhen(details.lastSeenAt);

  const kicker =
    kind === "found" ? "Found alert" : kind === "post" ? "Share post" : "Missing alert";
  const badge =
    kind === "found" ? "FOUND ALERT" : kind === "post" ? "PAWALERT" : "MISSING ALERT";
  const copyLabel = kind === "post" ? "Copy post" : "Copy full alert";

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open) {
      if (!el.open) el.showModal();
      setCopied(false);
    } else if (el.open) {
      el.close();
    }
  }, [open]);

  async function copyFullAlert() {
    try {
      await navigator.clipboard.writeText(shareMessage);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
      onShared?.();
      return true;
    } catch {
      return false;
    }
  }

  async function nativeShare() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareMessage,
          url: details.publicUrl,
        });
        onShared?.();
        return;
      } catch {
        /* cancelled */
      }
    }
    await copyFullAlert();
  }

  function guardLocal(e: MouseEvent<HTMLAnchorElement>) {
    if (isLocal) {
      e.preventDefault();
      void copyFullAlert();
      return;
    }
    onShared?.();
  }

  const quote = shareMessage.replace(details.publicUrl, "").trim();
  const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(details.publicUrl)}&quote=${encodeURIComponent(quote)}`;
  const messengerUrl = `https://www.facebook.com/dialog/send?link=${encodeURIComponent(details.publicUrl)}&app_id=966242223397117&redirect_uri=${encodeURIComponent(details.publicUrl)}`;
  const xUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareMessage)}`;

  return (
    <dialog
      ref={dialogRef}
      className="pa-share"
      data-ui="share-v8"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
    >
      <div className="pa-share__panel">
        <header className="pa-share__head">
          <div>
            <p className="pa-share__kicker">{kicker}</p>
            <h2 className="pa-share__title">Share {details.petName}</h2>
            <p className="pa-share__lead">
              Opens with full details + link so the preview card can load.
            </p>
          </div>
          <button type="button" className="pa-share__x" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </header>

        <div className="pa-share__body">
          <article className="pa-share__preview" aria-label="Share preview">
            <div className="pa-share__preview-card">
              <div className="pa-share__preview-photo">
                {details.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={details.photoUrl} alt={details.petName} />
                ) : (
                  <div className="pa-share__preview-photo-fallback">PawAlert</div>
                )}
              </div>
              <div className="pa-share__preview-copy">
                <div className="pa-share__preview-badge">{badge}</div>
                <h3 className="pa-share__preview-title">{shareTitle}</h3>
                <ul className="pa-share__preview-list">
                  {[details.species, details.breed].filter(Boolean).length > 0 ? (
                    <li>{[details.species, details.breed].filter(Boolean).join(" · ")}</li>
                  ) : null}
                  {details.lastSeenText ? (
                    <li>
                      <strong>{kind === "found" ? "Location:" : kind === "post" ? "Place:" : "Last seen:"}</strong>{" "}
                      {details.lastSeenText}
                    </li>
                  ) : null}
                  {details.lastSeenNotes ? (
                    <li>
                      <strong>Details:</strong> {details.lastSeenNotes}
                    </li>
                  ) : null}
                  {whenLabel ? (
                    <li>
                      <strong>Date &amp; time:</strong> {whenLabel}
                    </li>
                  ) : null}
                </ul>
                <p className="pa-share__preview-foot">pawalert · help bring them home</p>
              </div>
            </div>
            <p className="pa-share__preview-url">{details.publicUrl}</p>
          </article>

          {isLocal ? (
            <p className="pa-share__note">
              Localhost cannot show preview cards. Set{" "}
              <span className="pa-share__mono">NEXT_PUBLIC_APP_URL</span> to your live site, then
              share again.
            </p>
          ) : (
            <p className="pa-share__note">
              <strong>X</strong> usually shows the photo card right away.{" "}
              <strong>Facebook</strong> may need a new post after{" "}
              <a
                href={`https://developers.facebook.com/tools/debug/?q=${encodeURIComponent(details.publicUrl)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Scrape Again
              </a>
              .
            </p>
          )}

          <div className="pa-share__menu" role="menu" aria-label="Share options">
            <a
              className="pa-share__menu-item pa-share__menu-item--primary"
              role="menuitem"
              href={xUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={guardLocal}
            >
              <span className="pa-share__menu-icon" aria-hidden>
                𝕏
              </span>
              <span>
                <strong>Share to X (preview card)</strong>
                <small>Opens with details + link for the card</small>
              </span>
            </a>
            <a
              className="pa-share__menu-item"
              role="menuitem"
              href={isPublic ? fbUrl : "#"}
              target={isPublic ? "_blank" : undefined}
              rel="noopener noreferrer"
              onClick={guardLocal}
            >
              <span className="pa-share__menu-icon" aria-hidden>
                f
              </span>
              <span>
                <strong>Facebook</strong>
                <small>Opens share with caption + URL for the card</small>
              </span>
            </a>
            <a
              className="pa-share__menu-item"
              role="menuitem"
              href={isPublic ? messengerUrl : "#"}
              target={isPublic ? "_blank" : undefined}
              rel="noopener noreferrer"
              onClick={guardLocal}
            >
              <span className="pa-share__menu-icon" aria-hidden>
                ✉
              </span>
              <span>
                <strong>Messenger</strong>
                <small>Send the live profile link</small>
              </span>
            </a>
            <button type="button" className="pa-share__menu-item" role="menuitem" onClick={copyFullAlert}>
              <span className="pa-share__menu-icon" aria-hidden>
                📋
              </span>
              <span>
                <strong>{copied ? "Copied" : copyLabel}</strong>
                <small>Paste into any app (details + URL)</small>
              </span>
            </button>
            <button type="button" className="pa-share__menu-item" role="menuitem" onClick={nativeShare}>
              <span className="pa-share__menu-icon" aria-hidden>
                ⋯
              </span>
              <span>
                <strong>More</strong>
                <small>Phone share sheet</small>
              </span>
            </button>
          </div>

          <div className="pa-share__actions">
            <button type="button" className="pa-share__btn pa-share__btn--quiet" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </dialog>
  );
}
