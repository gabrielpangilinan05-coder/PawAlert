"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, Marker } from "leaflet";

type Props = {
  latName: string;
  lngName: string;
  labelId?: string;
  initialLat?: number | null;
  initialLng?: number | null;
  onLabel?: (label: string) => void;
  onCoords?: (lat: number | null, lng: number | null) => void;
  searchPlaceholder?: string;
  /** Hide verbose map status line (parent shows its own status). */
  quiet?: boolean;
};

export function MapPicker({
  latName,
  lngName,
  initialLat = null,
  initialLng = null,
  onLabel,
  onCoords,
  searchPlaceholder = "Search place",
  quiet = false,
}: Props) {
  const mapEl = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const onLabelRef = useRef(onLabel);
  const onCoordsRef = useRef(onCoords);
  const reverseSeq = useRef(0);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ label: string; lat: number; lng: number }[]>([]);
  const [lat, setLat] = useState<number | null>(initialLat);
  const [lng, setLng] = useState<number | null>(initialLng);
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState(
    quiet ? "" : "Search a place, use GPS, or tap the map.",
  );
  const [expanded, setExpanded] = useState(false);

  onLabelRef.current = onLabel;
  onCoordsRef.current = onCoords;

  useEffect(() => {
    if (!expanded) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setExpanded(false);
    }
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [expanded]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const t = window.setTimeout(() => map.invalidateSize(), 80);
    return () => window.clearTimeout(t);
  }, [expanded]);

  async function reverseGeocode(nextLat: number, nextLng: number) {
    const seq = ++reverseSeq.current;
    setHint("Looking up address…");
    try {
      const res = await fetch(
        `/api/geocode?lat=${encodeURIComponent(String(nextLat))}&lng=${encodeURIComponent(String(nextLng))}`,
      );
      const data = await res.json();
      if (seq !== reverseSeq.current) return;
      if (data.ok && data.results?.[0]?.label) {
        onLabelRef.current?.(data.results[0].label);
        setHint("Address filled from map pin.");
      } else {
        setHint("Pin set — type an address if lookup found nothing.");
      }
    } catch {
      if (seq !== reverseSeq.current) return;
      setHint("Pin set — could not look up address. Type it above.");
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");
      // Fix default marker icons in bundlers
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      if (cancelled || !mapEl.current || mapRef.current) return;
      const startLat = initialLat ?? 15.15;
      const startLng = initialLng ?? 120.75;
      const map = L.map(mapEl.current, { zoomControl: true }).setView([startLat, startLng], 13);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap",
        maxZoom: 19,
      }).addTo(map);

      const applyPin = (nextLat: number, nextLng: number) => {
        setLat(nextLat);
        setLng(nextLng);
        onCoordsRef.current?.(nextLat, nextLng);
        void reverseGeocode(nextLat, nextLng);
      };

      const marker = L.marker([startLat, startLng], { draggable: true }).addTo(map);
      marker.on("dragend", () => {
        const p = marker.getLatLng();
        applyPin(p.lat, p.lng);
      });
      map.on("click", (e: { latlng: { lat: number; lng: number } }) => {
        marker.setLatLng(e.latlng);
        applyPin(e.latlng.lat, e.latlng.lng);
      });

      mapRef.current = map;
      markerRef.current = marker;
      if (initialLat != null && initialLng != null) {
        setLat(initialLat);
        setLng(initialLng);
      }
      setTimeout(() => map.invalidateSize(), 200);
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Sync pin when parent updates coords (e.g. auto-GPS after camera). */
  useEffect(() => {
    if (initialLat == null || initialLng == null) return;
    setLat(initialLat);
    setLng(initialLng);
    onCoordsRef.current?.(initialLat, initialLng);
    markerRef.current?.setLatLng([initialLat, initialLng]);
    mapRef.current?.setView([initialLat, initialLng], 15);
  }, [initialLat, initialLng]);

  function setPin(nextLat: number, nextLng: number, label?: string) {
    setLat(nextLat);
    setLng(nextLng);
    onCoords?.(nextLat, nextLng);
    markerRef.current?.setLatLng([nextLat, nextLng]);
    mapRef.current?.setView([nextLat, nextLng], 15);
    if (label) onLabel?.(label);
  }

  async function search() {
    if (!query.trim()) return;
    setBusy(true);
    setHint("Searching…");
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(query.trim())}`);
      const data = await res.json();
      if (!data.ok || !data.results?.length) {
        setResults([]);
        setHint("No places found. Try a nearby landmark.");
        return;
      }
      const list = data.results
        .filter((r: { lat: number | null; lng: number | null }) => r.lat != null && r.lng != null)
        .map((r: { label: string; lat: number; lng: number }) => ({
          label: r.label,
          lat: Number(r.lat),
          lng: Number(r.lng),
        }));
      setResults(list);
      if (list[0]) {
        setPin(list[0].lat, list[0].lng, list[0].label);
        setHint("Confirm the pin, then continue.");
      }
    } catch {
      setHint("Search failed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  function useGps() {
    if (!navigator.geolocation) {
      setHint("GPS not available on this device/browser.");
      return;
    }
    setBusy(true);
    setHint("Getting GPS…");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setPin(latitude, longitude);
        await reverseGeocode(latitude, longitude);
        setBusy(false);
      },
      () => {
        setHint("Could not get GPS. Try Search or tap the map.");
        setBusy(false);
      },
      { enableHighAccuracy: true, timeout: 12000 },
    );
  }

  return (
    <div className={`map-picker${expanded ? " map-picker--expanded" : ""}`}>
      {expanded ? (
        <div className="map-picker-expanded-head">
          <strong>Pick a location</strong>
          <button
            type="button"
            className="btn btn-sm btn-amber"
            onClick={() => setExpanded(false)}
          >
            Done
          </button>
        </div>
      ) : null}
      <input type="hidden" name={latName} value={lat ?? ""} readOnly />
      <input type="hidden" name={lngName} value={lng ?? ""} readOnly />
      <div className="map-search-row">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={searchPlaceholder}
          autoComplete="off"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              search();
            }
          }}
        />
        <button type="button" className="btn btn-small btn-outline" onClick={search} disabled={busy}>
          Search
        </button>
        <button type="button" className="btn btn-small btn-outline" onClick={useGps} disabled={busy}>
          {busy ? "…" : "GPS"}
        </button>
      </div>
      {results.length > 0 && (
        <div className="map-search-results">
          {results.map((r, i) => (
            <button
              key={i}
              type="button"
              className="map-search-item"
              onClick={() => {
                setPin(r.lat, r.lng, r.label);
                setResults([]);
              }}
            >
              {r.label}
            </button>
          ))}
        </div>
      )}
      <div className="map-canvas-wrap">
        <div ref={mapEl} className="map-canvas" role="application" aria-label="Map" />
        {!expanded ? (
          <button
            type="button"
            className="map-expand-fab"
            onClick={() => setExpanded(true)}
            aria-label="Enlarge map"
            title="Enlarge map"
          >
            ⛶
          </button>
        ) : null}
      </div>
      {!quiet && hint ? <p className="map-coords-hint muted">{hint}</p> : null}
      {quiet && hint && (busy || hint.toLowerCase().includes("could not")) ? (
        <p className="map-coords-hint muted">{hint}</p>
      ) : null}
    </div>
  );
}
