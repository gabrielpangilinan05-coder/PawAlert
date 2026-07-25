import { directionsFromCoords, toCoord } from "@/lib/maps";

type Locatable = {
  location_lat?: unknown;
  location_lng?: unknown;
  pet_last_seen_lat?: unknown;
  pet_last_seen_lng?: unknown;
  pet_show_address?: unknown;
  pet_home_lat?: unknown;
  pet_home_lng?: unknown;
  owner_address_lat?: unknown;
  owner_address_lng?: unknown;
};

/** Home-area directions only when owner opted in (show_address). */
export function homeAreaDirectionsUrl(row: Locatable): string | null {
  if (Number(row.pet_show_address) !== 1) return null;
  return (
    directionsFromCoords(row.pet_home_lat, row.pet_home_lng) ||
    directionsFromCoords(row.owner_address_lat, row.owner_address_lng)
  );
}

/** Alert / last-seen pin on the post (not gated by Home area). */
export function alertPinDirectionsUrl(row: Locatable): string | null {
  return (
    directionsFromCoords(row.location_lat, row.location_lng) ||
    directionsFromCoords(row.pet_last_seen_lat, row.pet_last_seen_lng)
  );
}

/** Prefer home area (if public), else alert pin. */
export function bestDirectionsUrl(row: Locatable): string | null {
  return homeAreaDirectionsUrl(row) || alertPinDirectionsUrl(row);
}

export function hasCoords(lat: unknown, lng: unknown): boolean {
  return toCoord(lat) != null && toCoord(lng) != null;
}
