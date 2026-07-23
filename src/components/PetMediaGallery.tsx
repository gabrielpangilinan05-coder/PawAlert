"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { mediaUrl } from "@/lib/media";

export type PetMediaItem = {
  id: number;
  file_path: string;
  media_type: string;
};

export function PetMediaGallery({ petId, media }: { petId: number; media: PetMediaItem[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<number | null>(null);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  const viewer = viewerIndex != null ? media[viewerIndex] : null;
  const viewerSrc = viewer ? mediaUrl(viewer.file_path) : null;

  useEffect(() => {
    if (viewerIndex == null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setViewerIndex(null);
      if (e.key === "ArrowRight" && media.length > 1) {
        setViewerIndex((i) => (i == null ? 0 : (i + 1) % media.length));
      }
      if (e.key === "ArrowLeft" && media.length > 1) {
        setViewerIndex((i) => (i == null ? 0 : (i - 1 + media.length) % media.length));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [viewerIndex, media.length]);

  async function act(action: "set_cover" | "delete_media", mediaId: number) {
    if (action === "delete_media" && !confirm("Remove this file?")) return;
    setBusy(mediaId);
    try {
      const fd = new FormData();
      fd.set("action", action);
      fd.set("media_id", String(mediaId));
      const res = await fetch(`/api/pets/${petId}`, { method: "POST", body: fd });
      if (res.ok) {
        if (viewerIndex != null) setViewerIndex(null);
        router.refresh();
      }
    } finally {
      setBusy(null);
    }
  }

  if (!media.length) {
    return (
      <p className="muted" style={{ margin: 0 }}>
        No photos or videos yet. Choose files below, then Save changes.
      </p>
    );
  }

  return (
    <>
      <div className="media-grid media-tiles">
        {media.map((m, index) => {
          const src = mediaUrl(m.file_path) || undefined;
          return (
            <div key={m.id} className="media-tile">
              <button
                type="button"
                className="media-tile-open"
                onClick={() => setViewerIndex(index)}
                aria-label={m.media_type === "video" ? "View video" : "View photo"}
              >
                {m.media_type === "video" ? (
                  <>
                    <video src={src} muted playsInline preload="metadata" />
                    <span className="media-tile-badge">Video</span>
                  </>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={src} alt="" />
                )}
              </button>
              <div className="media-tile-actions">
                {m.media_type === "image" && (
                  <button
                    type="button"
                    className="btn btn-small btn-outline"
                    disabled={busy === m.id}
                    onClick={() => act("set_cover", m.id)}
                  >
                    Cover
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-small btn-danger"
                  disabled={busy === m.id}
                  onClick={() => act("delete_media", m.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {viewer && viewerSrc ? (
        <div
          className="media-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="Media viewer"
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
            {media.length > 1 ? (
              <>
                <button
                  type="button"
                  className="media-lightbox-nav media-lightbox-prev"
                  aria-label="Previous"
                  onClick={() =>
                    setViewerIndex((i) => (i == null ? 0 : (i - 1 + media.length) % media.length))
                  }
                >
                  ‹
                </button>
                <button
                  type="button"
                  className="media-lightbox-nav media-lightbox-next"
                  aria-label="Next"
                  onClick={() => setViewerIndex((i) => (i == null ? 0 : (i + 1) % media.length))}
                >
                  ›
                </button>
              </>
            ) : null}
            {viewer.media_type === "video" ? (
              <video src={viewerSrc} controls autoPlay playsInline className="media-lightbox-media" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={viewerSrc} alt="" className="media-lightbox-media" />
            )}
            <p className="media-lightbox-caption muted">
              {(viewerIndex ?? 0) + 1} / {media.length} · click outside or Esc to close
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}
