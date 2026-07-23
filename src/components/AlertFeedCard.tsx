"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import type { FeedPost } from "@/lib/posts";
import { mediaUrl } from "@/lib/media";
import {
  ShareAlertDialog,
  shareDetailsFromFeedPost,
} from "@/components/ShareAlertDialog";

function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

function formatSex(sex: string | null | undefined): string {
  if (!sex || sex === "unknown") return "Unknown";
  return sex.charAt(0).toUpperCase() + sex.slice(1);
}

function toNum(v: number | string | null | undefined): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function AlertFeedCard({ post }: { post: FeedPost }) {
  const [shareOpen, setShareOpen] = useState(false);
  const shareDetails = useMemo(() => shareDetailsFromFeedPost(post), [post]);

  const isMissing = post.type === "missing";
  const statusLabel = post.status === "resolved" ? "REUNITED" : isMissing ? "LOST" : "FOUND";
  const bannerLabel = isMissing ? "MISSING ALERT" : "FOUND ALERT";

  const photo =
    mediaUrl(post.photo_path) || mediaUrl(post.pet_photo_path) || "/icons/icon-512.png";
  const name = post.pet_name || post.title.replace(/\s+is missing$/i, "") || "Unknown pet";
  const species = post.species || "Pet";
  const location = post.pet_last_seen_text || post.location_text || "—";
  const when = formatDate(post.pet_last_seen_at || post.created_at);
  const notes = post.pet_last_seen_notes || null;
  const message = post.description?.trim() || null;
  const lat = toNum(post.location_lat);
  const lng = toNum(post.location_lng);
  const profileUrl = post.pet_slug ? `/pet/${post.pet_slug}` : `/post/${post.id}`;

  const contactHref = post.contact_phone
    ? `tel:${post.contact_phone}`
    : post.contact_email
      ? `mailto:${post.contact_email}`
      : null;

  const rows: { label: string; value: ReactNode }[] = [
    {
      label: "Status",
      value: <span className={`alert-status-pill alert-status-pill--${statusLabel.toLowerCase()}`}>{statusLabel}</span>,
    },
    { label: isMissing ? "Date Last Seen" : "Date Posted", value: when },
    { label: isMissing ? "Location Last Seen" : "Location", value: location },
    { label: "Name", value: name },
    { label: "Sex", value: formatSex(post.pet_sex) },
    { label: "Alert ID", value: String(post.id) },
    { label: "Species", value: [species, post.pet_breed].filter(Boolean).join(" · ") },
  ];

  if (notes) {
    rows.push({ label: "Description", value: notes });
  }

  if (message) {
    rows.push({ label: "Message", value: message });
  }

  return (
    <article className={`alert-feed-card${isMissing ? " is-missing" : " is-found"}`} id={`post-${post.id}`}>
      <div className="alert-feed-card__media">
        <div className="alert-feed-card__banner">
          <span aria-hidden>📢</span>
          {bannerLabel}
        </div>
        <div className="alert-feed-card__photo-wrap">
          <div className="alert-feed-card__rail" aria-hidden />
          <Link href={profileUrl} className="alert-feed-card__photo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo!} alt={name} />
            <span className="alert-feed-card__id">ID: {post.id}</span>
          </Link>
          <div className="alert-feed-card__rail" aria-hidden />
        </div>
        <button type="button" className="alert-feed-card__share" onClick={() => setShareOpen(true)}>
          Share alert
        </button>
      </div>

      <div className="alert-feed-card__info">
        <div className="alert-feed-card__actions">
          {contactHref ? (
            <a className="alert-feed-card__btn alert-feed-card__btn--contact" href={contactHref}>
              Contact owner
            </a>
          ) : (
            <Link className="alert-feed-card__btn alert-feed-card__btn--contact" href={profileUrl}>
              View profile
            </Link>
          )}
          <button
            type="button"
            className="alert-feed-card__btn alert-feed-card__btn--fb"
            onClick={() => setShareOpen(true)}
          >
            Share on Facebook
          </button>
        </div>

        <dl className="alert-feed-card__table">
          {rows.map((row) => (
            <div key={row.label} className="alert-feed-card__row">
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>

        {lat != null && lng != null ? (
          <div className="alert-feed-card__map">
            <iframe
              title={`Map for ${name}`}
              src={`https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.02}%2C${lat - 0.015}%2C${lng + 0.02}%2C${lat + 0.015}&layer=mapnik&marker=${lat}%2C${lng}`}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        ) : null}

        <p className="alert-feed-card__more">
          <Link href={`/post/${post.id}`}>Open full post →</Link>
        </p>
      </div>

      <ShareAlertDialog
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        details={shareDetails}
      />
    </article>
  );
}
