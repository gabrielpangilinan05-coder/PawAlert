"use client";

import { useState } from "react";

export function CopyLinkButton({ url }: { url: string }) {
  const [label, setLabel] = useState("Copy link");

  return (
    <button
      className="btn btn-small btn-outline"
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url);
          setLabel("Copied!");
          setTimeout(() => setLabel("Copy link"), 1600);
        } catch {
          setLabel("Copy failed");
          setTimeout(() => setLabel("Copy link"), 1600);
        }
      }}
    >
      {label}
    </button>
  );
}
