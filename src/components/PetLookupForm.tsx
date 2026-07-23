"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { petSlugFromQr } from "@/lib/qr-scan";
import { QrCameraScanner } from "@/components/QrCameraScanner";

/** Inline scan + paste to open a pet profile (used on /pet fallback). */
export function PetLookupForm() {
  const router = useRouter();
  const [scanValue, setScanValue] = useState("");
  const [scanError, setScanError] = useState<string | null>(null);

  function openFromRaw(raw: string): boolean {
    const slug = petSlugFromQr(raw);
    if (!slug) {
      setScanError("That doesn’t look like a PawAlert pet QR or profile link.");
      return false;
    }
    setScanError(null);
    router.push(`/pet/${encodeURIComponent(slug)}`);
    return true;
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    openFromRaw(scanValue);
  }

  return (
    <div className="pet-fallback-lookup">
      <QrCameraScanner onDetected={openFromRaw} onError={setScanError} />
      {scanError ? <div className="flash flash-error">{scanError}</div> : null}
      <form onSubmit={onSubmit} className="form-grid">
        <label>
          Or paste profile URL / slug
          <input
            value={scanValue}
            onChange={(e) => setScanValue(e.target.value)}
            placeholder="e.g. https://…/pet/your-slug or the slug alone"
            autoComplete="off"
          />
        </label>
        <button type="submit" className="btn btn-amber">
          Open pet profile
        </button>
      </form>
    </div>
  );
}
