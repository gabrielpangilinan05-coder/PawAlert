import { homeAreaDirectionsUrl } from "@/lib/directions";

export type OwnerContactSource = {
  pet_id?: unknown;
  contact_phone?: unknown;
  contact_email?: unknown;
  pet_show_phone?: unknown;
  pet_show_email?: unknown;
  pet_show_messenger?: unknown;
  pet_show_address?: unknown;
  owner_phone?: unknown;
  owner_email?: unknown;
  owner_messenger?: unknown;
  pet_home_lat?: unknown;
  pet_home_lng?: unknown;
  owner_address_lat?: unknown;
  owner_address_lng?: unknown;
};

export type OwnerContact = {
  phone: string | null;
  email: string | null;
  messenger: string | null;
  messengerHref: string | null;
  homeDirections: string | null;
};

function flagOn(value: unknown): boolean {
  return Number(value) === 1;
}

function asText(value: unknown): string | null {
  const s = value == null ? "" : String(value).trim();
  return s || null;
}

function messengerHref(raw: string | null): string | null {
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  const handle = raw.replace(/^@/, "").replace(/^m\.me\//i, "").trim();
  if (!handle) return null;
  return `https://m.me/${encodeURIComponent(handle)}`;
}

/**
 * Resolve owner contact for alerts from live pet privacy flags when linked to a pet.
 * Found/guest posts without privacy flags fall back to post.contact_*.
 */
export function resolveOwnerContact(row: OwnerContactSource): OwnerContact {
  const linkedPet = row.pet_id != null && Number(row.pet_id) > 0;
  // Privacy flags are 0/1 when the pet row exists; NULL means no linked pet / compat query.
  const hasPrivacyCols =
    row.pet_show_phone != null ||
    row.pet_show_email != null ||
    row.pet_show_messenger != null ||
    row.pet_show_address != null;

  if (linkedPet && hasPrivacyCols) {
    const phone = flagOn(row.pet_show_phone)
      ? asText(row.owner_phone) || asText(row.contact_phone)
      : null;
    const email = flagOn(row.pet_show_email)
      ? asText(row.owner_email) || asText(row.contact_email)
      : null;
    const messenger = flagOn(row.pet_show_messenger) ? asText(row.owner_messenger) : null;
    return {
      phone,
      email,
      messenger,
      messengerHref: messengerHref(messenger),
      homeDirections: homeAreaDirectionsUrl(row),
    };
  }

  // No pet / privacy columns unavailable — use values stored on the post.
  const phone = asText(row.contact_phone);
  const email = asText(row.contact_email);
  return {
    phone,
    email,
    messenger: null,
    messengerHref: null,
    homeDirections: homeAreaDirectionsUrl(row),
  };
}

export function hasOwnerContact(c: OwnerContact): boolean {
  return Boolean(c.phone || c.email || c.messengerHref || c.homeDirections);
}
