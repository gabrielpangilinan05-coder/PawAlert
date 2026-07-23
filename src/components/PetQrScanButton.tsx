"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { petSlugFromQr } from "@/lib/qr-scan";
import { QrCameraScanner } from "@/components/QrCameraScanner";

/** Opens the same QR camera flow as the header Scan QR button. */
export function PetQrScanButton({ className = "btn btn-outline" }: { className?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [scanValue, setScanValue] = useState("");
  const [scanError, setScanError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setScanValue("");
      setScanError(null);
    }
  }, [open]);

  function openFromRaw(raw: string): boolean {
    const slug = petSlugFromQr(raw);
    if (!slug) {
      setScanError("That doesn’t look like a PawAlert pet QR.");
      return false;
    }
    setScanError(null);
    setOpen(false);
    router.push(`/pet/${encodeURIComponent(slug)}`);
    return true;
  }

  function goScan(e: FormEvent) {
    e.preventDefault();
    openFromRaw(scanValue);
  }

  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        Scan QR
      </button>

      {open ? (
        <div className="qr-scan-backdrop" role="presentation" onClick={() => setOpen(false)}>
          <div
            className="qr-scan-dialog"
            role="dialog"
            aria-label="Scan pet QR"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="qr-scan-head">
              <h2>Scan QR</h2>
            </div>
            <p className="qr-scan-hint muted">
              Point your camera at a PawAlert collar tag to open that pet’s live profile.
            </p>
            <div className="qr-scan-body">
              <QrCameraScanner onDetected={openFromRaw} onError={setScanError} />
              {scanError ? <div className="flash flash-error">{scanError}</div> : null}
              <form onSubmit={goScan} className="form-grid">
                <label>
                  Or paste URL / slug
                  <input
                    value={scanValue}
                    onChange={(e) => setScanValue(e.target.value)}
                    placeholder="e.g. /pet/… or slug"
                    autoComplete="off"
                  />
                </label>
                <div className="qr-scan-actions">
                  <button type="button" className="btn btn-outline" onClick={() => setOpen(false)}>
                    Close
                  </button>
                  <button type="submit" className="btn btn-amber">
                    Open
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
