"use client";

import { useMemo, useState } from "react";
import {
  ShareAlertDialog,
  type ShareAlertDetails,
  type ShareKind,
} from "@/components/ShareAlertDialog";

export function PostShareButton({
  details,
  className = "btn btn-outline",
  label = "Share",
}: {
  details: ShareAlertDetails;
  className?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const resolved = useMemo(() => details, [details]);

  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        {label}
      </button>
      <ShareAlertDialog open={open} onClose={() => setOpen(false)} details={resolved} />
    </>
  );
}

export function postShareKind(type: string, status: string): ShareKind {
  if (type === "missing") return status === "resolved" ? "found" : "missing";
  if (type === "found") return "found";
  return "post";
}
