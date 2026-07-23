"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  /** Return true when the payload was accepted (stops further scans). */
  onDetected: (text: string) => boolean;
  onError?: (message: string) => void;
};

export function QrCameraScanner({ onDetected, onError }: Props) {
  const onDetectedRef = useRef(onDetected);
  const onErrorRef = useRef(onError);
  const handledRef = useRef(false);
  const [status, setStatus] = useState("Starting camera…");

  onDetectedRef.current = onDetected;
  onErrorRef.current = onError;

  useEffect(() => {
    let cancelled = false;
    let started = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let scanner: any = null;

    (async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (cancelled) return;

        const elId = "pawalert-qr-reader";
        scanner = new Html5Qrcode(elId);
        await scanner.start(
          { facingMode: "environment" },
          { fps: 8, qrbox: { width: 240, height: 240 }, aspectRatio: 1 },
          (decoded: string) => {
            if (handledRef.current || cancelled) return;
            const ok = onDetectedRef.current(decoded);
            if (ok) {
              handledRef.current = true;
              setStatus("QR found — opening…");
            }
          },
          () => {
            /* ignore frame misses */
          },
        );

        if (cancelled) {
          // Unmounted while start() was in flight — stop quietly.
          try {
            await scanner.stop();
            await scanner.clear();
          } catch {
            /* not running */
          }
          return;
        }

        started = true;
        setStatus("Point your camera at a PawAlert QR tag.");
      } catch (err) {
        const message = err instanceof Error ? err.message : "Could not open camera.";
        if (!cancelled) {
          setStatus("Camera unavailable — paste a link below.");
          onErrorRef.current?.(
            /Permission|NotAllowed/i.test(message)
              ? "Camera permission denied. Allow camera access, or paste the QR link."
              : "Camera needs HTTPS (or localhost). Use a public tunnel on phone, or paste the link.",
          );
        }
      }
    })();

    return () => {
      cancelled = true;
      const s = scanner;
      scanner = null;
      if (!s || !started) return;

      void (async () => {
        try {
          const state = typeof s.getState === "function" ? s.getState() : null;
          // Html5QrcodeScannerState: 2 = SCANNING, 3 = PAUSED
          if (state == null || state === 2 || state === 3) {
            await s.stop();
          }
        } catch {
          /* already stopped / never started */
        }
        try {
          await s.clear();
        } catch {
          /* ignore */
        }
      })();
    };
  }, []);

  return (
    <div className="qr-camera">
      <div id="pawalert-qr-reader" className="qr-camera-viewport" />
      <p className="qr-camera-status muted">{status}</p>
    </div>
  );
}
