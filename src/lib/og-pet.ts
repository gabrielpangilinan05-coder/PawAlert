/** Shared Open Graph / share caption helpers for missing pets. */

export function formatDisplayDatetime(iso: unknown): string | null {
  if (iso == null || iso === "") return null;
  const d = new Date(String(iso));
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function truncateText(value: string, max: number): string {
  const t = value.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

type PetLike = {
  name?: unknown;
  status?: unknown;
  species?: unknown;
  breed?: unknown;
  last_seen_text?: unknown;
  last_seen_notes?: unknown;
  last_seen_at?: unknown;
};

/** Facebook og:description — Last seen / Details / Date & time. */
export function buildPetOgDescription(pet: PetLike): string {
  const status = String(pet.status || "");
  const species = String(pet.species || "");
  const breed = pet.breed ? String(pet.breed) : "";
  const kind = [species, breed].filter(Boolean).join(" · ");
  const lines: string[] = [];
  if (kind) lines.push(kind);

  if (status === "missing") {
    if (pet.last_seen_text) lines.push(`Last seen: ${String(pet.last_seen_text)}`);
    if (pet.last_seen_notes) lines.push(`Details: ${String(pet.last_seen_notes)}`);
    const when = formatDisplayDatetime(pet.last_seen_at);
    if (when) lines.push(`Date & time: ${when}`);
  }

  if (!lines.length) return "Help find this pet on PawAlert.";
  return lines.join(" · ");
}

/** Short lines for the OG image (right panel). */
export function buildPetOgImageLines(pet: PetLike): string[] {
  const status = String(pet.status || "");
  const species = String(pet.species || "");
  const breed = pet.breed ? String(pet.breed) : "";
  const kind = [species, breed].filter(Boolean).join(" · ");
  const lines: string[] = [];
  if (kind) lines.push(kind);

  if (status === "missing") {
    if (pet.last_seen_text) {
      lines.push(`Last seen: ${truncateText(String(pet.last_seen_text), 72)}`);
    }
    if (pet.last_seen_notes) {
      lines.push(`Details: ${truncateText(String(pet.last_seen_notes), 64)}`);
    }
    const when = formatDisplayDatetime(pet.last_seen_at);
    if (when) lines.push(`Date & time: ${when}`);
  }

  return lines;
}
