/** Parse DB / form coordinates safely. */
export function toCoord(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Google Maps turn-by-turn directions to a destination pin. */
export function directionsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${lat},${lng}`)}`;
}

/** Open a pin on Google Maps (view, not routing). */
export function mapViewUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${encodeURIComponent(`${lat},${lng}`)}`;
}

export function directionsFromCoords(
  lat: unknown,
  lng: unknown,
): string | null {
  const a = toCoord(lat);
  const b = toCoord(lng);
  if (a == null || b == null) return null;
  return directionsUrl(a, b);
}
