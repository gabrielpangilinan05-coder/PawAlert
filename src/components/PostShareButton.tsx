"use client";

import { useMemo, useState } from "react";
import {
  ShareAlertDialog,
  type ShareAlertDetails,
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
