"use client";

import { useEffect, useMemo, useState } from "react";
import { mediaUrl } from "@/lib/media";

export type PublicMediaItem = {
  id: string;
  src: string;
  type: "image" | "video";
  label?: string;
};

type Props = {
  petName: string;
  coverSrc: string;
  statusLabel: string;
  statusClass: "missing" | "safe";
  media: { id: number; file_path: string; media_type: string }[];
  lastSeenSrc?: string | null;
  lastSeenType?: string | null;
};

export function PetPublicMedia({
  petName,
  coverSrc,
  statusLabel,
  statusClass,
  media,
  lastSeenSrc,
  lastSeenType,
}: Props) {
  const items = useMemo(() => {
    const list: PublicMediaItem[] = [];
    const seen = new Set<string>();

    function push(item: PublicMediaItem) {
      if (!item.src || seen.has(item.src)) return;
      seen.add(item.src);
      list.push(item);
    }

    push({ id: "cover", src: coverSrc, type: "image", label: petName });

    for (const m of media) {
      const src = mediaUrl(m.file_path);
      if (!src) continue;
      push({
        id: `m-${m.id}`,
        src,
        type: m.media_type === "video" ? "video" : "image",
        label: m.media_type === "video" ? "Video" : "Photo",
      });
    }

    if (lastSeenSrc) {
      push({
        id: "last-seen",
        src: lastSeenSrc,
        type: lastSeenType === "video" ? "video" : "image",
        label: "Last seen",
      });
    }

    return list;
  }, [coverSrc, media, lastSeenSrc, lastSeenType, petName]);

  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const viewer = viewerIndex != null ? items[viewerIndex] : null;
  const thumbs = items.slice(0, 8);

  useEffect(() => {
    if (viewerIndex == null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setViewerIndex(null);
      if (e.key === "ArrowRight" && items.length > 1) {
        setViewerIndex((i) => (i == null ? 0 : (i + 1) % items.length));
      }
      if (e.key === "ArrowLeft" && items.length > 1) {
        setViewerIndex((i) => (i == null ? 0 : (i - 1 + items.length) % items.length));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [viewerIndex, items.length]);

  return (
    <>
      <div className="pp-media">
        <button
          type="button"
          className="pp-photo pp-photo--zoom"
          onClick={() => setViewerIndex(0)}
          aria-label={`View ${petName} photo larger`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={coverSrc} alt={petName} />
          <span className={`pp-photo-badge badge badge-${statusClass}`}>{statusLabel}</span>
          <span className="pp-zoom-hint" aria-hidden>
            Tap to zoom
          </span>
        </button>

        {thumbs.length > 1 ? (
          <div className="pp-thumbs" aria-label="More photos">
            {thumbs.map((item, index) => (
              <button
                key={item.id}
                type="button"
                className="pp-thumb pp-thumb--zoom"
                onClick={() => setViewerIndex(index)}
                aria-label={item.label ? `View ${item.label}` : "View media"}
              >
                {item.type === "video" ? (
                  <video src={item.src} muted playsInline preload="metadata" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.src} alt="" />
                )}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {viewer ? (
        <div
          className="media-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="Photo viewer"
          onClick={() => setViewerIndex(null)}
        >
          <div className="media-lightbox-inner" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="media-lightbox-close"
              onClick={() => setViewerIndex(null)}
              aria-label="Close"
            >
              ×
            </button>
            {items.length > 1 ? (
              <>
                <button
                  type="button"
                  className="media-lightbox-nav media-lightbox-prev"
                  aria-label="Previous"
                  onClick={() =>
                    setViewerIndex((i) => (i == null ? 0 : (i - 1 + items.length) % items.length))
                  }
                >
                  ‹
                </button>
                <button
                  type="button"
                  className="media-lightbox-nav media-lightbox-next"
                  aria-label="Next"
                  onClick={() => setViewerIndex((i) => (i == null ? 0 : (i + 1) % items.length))}
                >
                  ›
                </button>
              </>
            ) : null}
            {viewer.type === "video" ? (
              <video
                src={viewer.src}
                controls
                autoPlay
                playsInline
                className="media-lightbox-media"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={viewer.src} alt={viewer.label || petName} className="media-lightbox-media" />
            )}
            <p className="media-lightbox-caption muted">
              {(viewerIndex ?? 0) + 1} / {items.length}
              {viewer.label ? ` · ${viewer.label}` : ""} · Esc or click outside to close
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}
