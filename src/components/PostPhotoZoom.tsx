"use client";

import { useEffect, useState } from "react";

export function PostPhotoZoom({ src, alt }: { src: string; alt: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="alert-photo alert-photo--zoom"
        onClick={() => setOpen(true)}
        aria-label={`View ${alt} larger`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} />
        <span className="pp-zoom-hint" aria-hidden>
          Tap to zoom
        </span>
      </button>

      {open ? (
        <div
          className="media-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="Photo viewer"
          onClick={() => setOpen(false)}
        >
          <div className="media-lightbox-inner" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="media-lightbox-close"
              onClick={() => setOpen(false)}
              aria-label="Close"
            >
              ×
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={alt} className="media-lightbox-media" />
            <p className="media-lightbox-caption muted">{alt}</p>
          </div>
        </div>
      ) : null}
    </>
  );
}
