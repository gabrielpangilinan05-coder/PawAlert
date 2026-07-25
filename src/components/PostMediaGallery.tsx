"use client";

import { useState } from "react";
import { mediaUrl } from "@/lib/media";

export type GalleryItem = {
  id?: number | string;
  file_path: string;
  media_type: string;
};

export function PostMediaGallery({
  items,
  alt = "Post media",
  className = "",
}: {
  items: GalleryItem[];
  alt?: string;
  className?: string;
}) {
  const list = items
    .map((item) => ({
      ...item,
      url: mediaUrl(item.file_path),
    }))
    .filter((item) => Boolean(item.url));

  const [active, setActive] = useState(0);
  if (!list.length) return null;

  const current = list[Math.min(active, list.length - 1)]!;
  const isVideo = current.media_type === "video";

  return (
    <div className={`post-media-gallery ${className}`.trim()}>
      <div className="post-media-gallery__main">
        {isVideo ? (
          <video src={current.url!} controls playsInline preload="metadata" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={current.url!} alt={alt} />
        )}
        {list.length > 1 ? (
          <span className="post-media-gallery__count">
            {active + 1}/{list.length}
          </span>
        ) : null}
      </div>
      {list.length > 1 ? (
        <div className="post-media-gallery__thumbs" role="list">
          {list.map((item, index) => (
            <button
              key={String(item.id ?? item.url)}
              type="button"
              className={`post-media-gallery__thumb${index === active ? " is-active" : ""}`}
              onClick={() => setActive(index)}
              aria-label={`Media ${index + 1}`}
            >
              {item.media_type === "video" ? (
                <video src={item.url!} muted playsInline preload="metadata" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.url!} alt="" />
              )}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
