"use client";

import { useEffect, useRef } from "react";
import type { Circle, Map as LeafletMap, Marker } from "leaflet";

const FALLBACK_LAT = 15.1451;
const FALLBACK_LNG = 120.5887;

type Props = {
  lat: number;
  lng: number;
  radiusMiles: number;
  onCoords: (lat: number, lng: number) => void;
  onLabel?: (label: string) => void;
};

function safeCoord(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

export function AlertRadiusMap({ lat, lng, radiusMiles, onCoords, onLabel }: Props) {
  const mapEl = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const circleRef = useRef<Circle | null>(null);
  const onCoordsRef = useRef(onCoords);
  const onLabelRef = useRef(onLabel);
  const reverseSeq = useRef(0);
  const lastRadiusRef = useRef<number | null>(null);

  const safeLat = safeCoord(lat, FALLBACK_LAT);
  const safeLng = safeCoord(lng, FALLBACK_LNG);
  const safeRadius = Number.isFinite(radiusMiles) && radiusMiles > 0 ? radiusMiles : 25;

  onCoordsRef.current = onCoords;
  onLabelRef.current = onLabel;

  async function reverseGeocode(nextLat: number, nextLng: number) {
    const seq = ++reverseSeq.current;
    try {
      const res = await fetch(
        `/api/geocode?lat=${encodeURIComponent(String(nextLat))}&lng=${encodeURIComponent(String(nextLng))}`,
      );
      const data = await res.json();
      if (seq !== reverseSeq.current) return;
      if (data.ok && data.results?.[0]?.label) {
        onLabelRef.current?.(String(data.results[0].label));
      }
    } catch {
      /* ignore */
    }
  }

  function fitRadiusBounds() {
    const map = mapRef.current;
    const circle = circleRef.current;
    if (!map || !circle) return;
    map.invalidateSize();
    try {
      map.fitBounds(circle.getBounds(), { padding: [16, 16], maxZoom: 13 });
    } catch {
      map.setView(circle.getLatLng(), 11);
    }
  }

  useEffect(() => {
    let cancelled = false;
    const timers: number[] = [];
    const startLat = safeLat;
    const startLng = safeLng;
    const startRadius = safeRadius;

    (async () => {
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      if (cancelled || !mapEl.current || mapRef.current) return;

      const map = L.map(mapEl.current, { zoomControl: true }).setView([startLat, startLng], 11);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap",
        maxZoom: 19,
      }).addTo(map);

      const applyPin = (nextLat: number, nextLng: number) => {
        if (!Number.isFinite(nextLat) || !Number.isFinite(nextLng)) return;
        circleRef.current?.setLatLng([nextLat, nextLng]);
        onCoordsRef.current(nextLat, nextLng);
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

      const meters = Math.max(1, startRadius) * 1609.34;
      const circle = L.circle([startLat, startLng], {
        radius: meters,
        color: "#2f6b4f",
        fillColor: "#2f6b4f",
        fillOpacity: 0.15,
        weight: 2,
      }).addTo(map);

      mapRef.current = map;
      markerRef.current = marker;
      circleRef.current = circle;
      lastRadiusRef.current = startRadius;

      for (const ms of [50, 200, 500, 1000]) {
        timers.push(
          window.setTimeout(() => {
            if (!cancelled) fitRadiusBounds();
          }, ms),
        );
      }
    })();

    return () => {
      cancelled = true;
      for (const t of timers) window.clearTimeout(t);
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
      circleRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Move pin/circle without changing zoom when coords update from outside or click.
  useEffect(() => {
    const map = mapRef.current;
    const marker = markerRef.current;
    const circle = circleRef.current;
    if (!map || !marker || !circle) return;
    const cur = marker.getLatLng();
    if (Math.abs(cur.lat - safeLat) > 1e-7 || Math.abs(cur.lng - safeLng) > 1e-7) {
      marker.setLatLng([safeLat, safeLng]);
      circle.setLatLng([safeLat, safeLng]);
      map.panTo([safeLat, safeLng], { animate: true });
    }
  }, [safeLat, safeLng]);

  // Only zoom to fit when the distance slider changes.
  useEffect(() => {
    const map = mapRef.current;
    const circle = circleRef.current;
    if (!map || !circle) return;
    circle.setRadius(Math.max(1, safeRadius) * 1609.34);
    if (lastRadiusRef.current !== safeRadius) {
      lastRadiusRef.current = safeRadius;
      fitRadiusBounds();
    }
  }, [safeRadius]);

  useEffect(() => {
    const el = mapEl.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      mapRef.current?.invalidateSize();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="alert-filter-map">
      <div
        ref={mapEl}
        className="alert-filter-map-canvas"
        role="application"
        aria-label="Search area map"
      />
      <p className="alert-filter-map-hint">Tap or drag the pin to set the search center.</p>
    </div>
  );
}
