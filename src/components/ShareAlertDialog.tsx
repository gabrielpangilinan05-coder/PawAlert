"use client";

import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { appOrigin, mediaUrl } from "@/lib/media";
import { splitAlertNotes } from "@/lib/post-display";
import type { FeedPost } from "@/lib/posts";
import type { ShareKind } from "@/lib/share";

export type { ShareKind };

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
  const { lastSeenNote } = splitAlertNotes({
    description: post.description,
    medicalNotes: post.pet_medical_notes,
    lastSeenNotes: post.pet_last_seen_notes,
  });

  return {
    petName,
    species: post.species || null,
    breed: post.pet_breed,
    lastSeenText: post.pet_last_seen_text || post.location_text,
    lastSeenNotes:
      resolvedKind === "post" ? post.description?.trim() || null : lastSeenNote,
    lastSeenAt: asIso(post.pet_last_seen_at || (resolvedKind === "post" ? post.created_at : null)),
    publicUrl,
    photoUrl: photo,
    kind: resolvedKind,
  };
}

type ShareTarget = {
  key: string;
  label: string;
  tone: string;
  href?: string;
  onClick?: () => void;
  external?: boolean;
};

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
  const [copied, setCopied] = useState<"link" | "full" | null>(null);
  const [caption, setCaption] = useState("");
  const kind = details.kind || "missing";
  const isLocal = /localhost|127\.0\.0\.1|192\.168\.|10\./i.test(details.publicUrl);
  const isPublic = !isLocal;

  const shareTitle =
    kind === "found"
      ? `${details.petName} was found`
      : kind === "post"
        ? details.petName
        : `${details.petName} is missing`;
  const baseMessage = useMemo(() => buildMissingShareMessage(details), [details]);
  const shareMessage = useMemo(() => {
    const note = caption.trim();
    if (!note) return baseMessage;
    return `${note}\n\n${baseMessage}`;
  }, [baseMessage, caption]);
  const whenLabel = formatWhen(details.lastSeenAt);

  const badge =
    kind === "found" ? "FOUND" : kind === "post" ? "POST" : "MISSING";

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open) {
      if (!el.open) el.showModal();
      setCopied(null);
      setCaption("");
    } else if (el.open) {
      el.close();
    }
  }, [open]);

  async function copyText(text: string, mode: "link" | "full") {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(mode);
      setTimeout(() => setCopied(null), 2200);
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
    await copyText(shareMessage, "full");
  }

  function guardLocal(e: MouseEvent<HTMLAnchorElement>) {
    if (isLocal) {
      e.preventDefault();
      void copyText(shareMessage, "full");
      return;
    }
    onShared?.();
  }

  const quote = shareMessage.replace(details.publicUrl, "").trim();
  const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(details.publicUrl)}&quote=${encodeURIComponent(quote)}`;
  const messengerUrl = `https://www.facebook.com/dialog/send?link=${encodeURIComponent(details.publicUrl)}&app_id=966242223397117&redirect_uri=${encodeURIComponent(details.publicUrl)}`;
  const xUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareMessage)}`;
  const waUrl = `https://wa.me/?text=${encodeURIComponent(shareMessage)}`;
  const smsUrl = `sms:?&body=${encodeURIComponent(shareMessage)}`;
  const viberUrl = `viber://forward?text=${encodeURIComponent(shareMessage)}`;
  const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(details.publicUrl)}&text=${encodeURIComponent(quote || shareTitle)}`;
  const mailUrl = `mailto:?subject=${encodeURIComponent(shareTitle)}&body=${encodeURIComponent(shareMessage)}`;

  const targets: ShareTarget[] = [
    {
      key: "messenger",
      label: "Messenger",
      tone: "messenger",
      href: isPublic ? messengerUrl : "#",
      external: isPublic,
    },
    {
      key: "whatsapp",
      label: "WhatsApp",
      tone: "whatsapp",
      href: waUrl,
      external: true,
    },
    {
      key: "facebook",
      label: "Facebook",
      tone: "facebook",
      href: isPublic ? fbUrl : "#",
      external: isPublic,
    },
    {
      key: "x",
      label: "X",
      tone: "x",
      href: xUrl,
      external: true,
    },
    {
      key: "telegram",
      label: "Telegram",
      tone: "telegram",
      href: telegramUrl,
      external: true,
    },
    {
      key: "sms",
      label: "Messages",
      tone: "sms",
      href: smsUrl,
    },
    {
      key: "viber",
      label: "Viber",
      tone: "viber",
      href: viberUrl,
    },
    {
      key: "email",
      label: "Email",
      tone: "email",
      href: mailUrl,
    },
    {
      key: "copy",
      label: copied === "link" ? "Copied" : "Copy link",
      tone: "copy",
      onClick: () => void copyText(details.publicUrl, "link"),
    },
    {
      key: "more",
      label: "More",
      tone: "more",
      onClick: () => void nativeShare(),
    },
  ];

  return (
    <dialog
      ref={dialogRef}
      className="pa-share"
      data-ui="share-sheet-v1"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
    >
      <div className="pa-share__panel">
        <header className="pa-share__sheet-head">
          <h2 className="pa-share__sheet-title">Share</h2>
          <button type="button" className="pa-share__x" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </header>

        <div className="pa-share__body pa-share__body--sheet">
          <article className="pa-share__preview pa-share__preview--compact" aria-label="Share preview">
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
                {details.lastSeenText ? (
                  <p className="pa-share__preview-place">{details.lastSeenText}</p>
                ) : null}
                {whenLabel ? <p className="pa-share__preview-when">{whenLabel}</p> : null}
                <p className="pa-share__preview-foot">pawalert · help bring them home</p>
              </div>
            </div>
            <p className="pa-share__preview-url">{details.publicUrl}</p>
          </article>

          <label className="pa-share__caption">
            <span className="sr-only">Add a message</span>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={2}
              placeholder="Say something about this… (optional)"
            />
          </label>

          <section className="pa-share__to" aria-label="Share to">
            <h3 className="pa-share__section-label">Share to</h3>
            <div className="pa-share__icons" role="list">
              {targets.map((t) =>
                t.href ? (
                  <a
                    key={t.key}
                    role="listitem"
                    className={`pa-share__icon-btn pa-share__icon-btn--${t.tone}`}
                    href={t.href}
                    target={t.external ? "_blank" : undefined}
                    rel={t.external ? "noopener noreferrer" : undefined}
                    onClick={t.external || t.key === "messenger" || t.key === "facebook" ? guardLocal : undefined}
                  >
                    <span className="pa-share__icon-circle" aria-hidden>
                      {iconGlyph(t.key)}
                    </span>
                    <span className="pa-share__icon-label">{t.label}</span>
                  </a>
                ) : (
                  <button
                    key={t.key}
                    type="button"
                    role="listitem"
                    className={`pa-share__icon-btn pa-share__icon-btn--${t.tone}`}
                    onClick={t.onClick}
                  >
                    <span className="pa-share__icon-circle" aria-hidden>
                      {iconGlyph(t.key)}
                    </span>
                    <span className="pa-share__icon-label">{t.label}</span>
                  </button>
                ),
              )}
            </div>
          </section>

          <div className="pa-share__menu" role="menu" aria-label="More share options">
            <button
              type="button"
              className="pa-share__menu-item"
              role="menuitem"
              onClick={() => void copyText(shareMessage, "full")}
            >
              <span className="pa-share__menu-icon" aria-hidden>
                📋
              </span>
              <span>
                <strong>{copied === "full" ? "Copied" : "Copy full alert"}</strong>
                <small>Details + link — paste anywhere</small>
              </span>
            </button>
            {isPublic ? (
              <a
                className="pa-share__menu-item"
                role="menuitem"
                href={`https://developers.facebook.com/tools/debug/?q=${encodeURIComponent(details.publicUrl)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="pa-share__menu-icon" aria-hidden>
                  f
                </span>
                <span>
                  <strong>Refresh Facebook preview</strong>
                  <small>Scrape Again if the card is stale</small>
                </span>
              </a>
            ) : (
              <p className="pa-share__note">
                Localhost can’t show preview cards. Set{" "}
                <span className="pa-share__mono">NEXT_PUBLIC_APP_URL</span> to your live site.
              </p>
            )}
          </div>
        </div>
      </div>
    </dialog>
  );
}

function iconGlyph(key: string): string {
  switch (key) {
    case "messenger":
      return "💬";
    case "whatsapp":
      return "WA";
    case "facebook":
      return "f";
    case "x":
      return "𝕏";
    case "telegram":
      return "TG";
    case "sms":
      return "✉️";
    case "viber":
      return "V";
    case "email":
      return "@";
    case "copy":
      return "🔗";
    case "more":
      return "⋯";
    default:
      return "•";
  }
}
