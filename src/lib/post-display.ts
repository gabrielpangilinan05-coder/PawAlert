/** Short place label for meta lines (avoid full geocoder dump). */
export function shortPlace(raw: string | null | undefined, max = 48): string {
  const t = (raw || "").trim();
  if (!t) return "";
  const first = t.split(",")[0]?.trim() || t;
  if (first.length <= max) return first;
  return `${first.slice(0, max - 1).trimEnd()}…`;
}

function asNote(value: unknown): string | null {
  const s = value == null ? "" : String(value).trim();
  return s || null;
}

function labeledChunk(text: string, label: "Notes" | "Details"): string | null {
  const re = new RegExp(
    `(?:^|\\b)${label}:\\s*(.+?)(?=\\s*(?:Notes:|Details:|Last seen:|Please help|$))`,
    "is",
  );
  const m = text.match(re);
  return asNote(m?.[1]?.replace(/\s+/g, " "));
}

/**
 * Resolve pet appearance notes vs last-seen details for structured facts.
 * Prefers live pet columns; falls back to legacy "Notes:" / "Details:" in description.
 */
export function splitAlertNotes(opts: {
  description?: unknown;
  medicalNotes?: unknown;
  lastSeenNotes?: unknown;
}): { petNote: string | null; lastSeenNote: string | null } {
  const raw = String(opts.description || "").trim();
  const petNote = asNote(opts.medicalNotes) || labeledChunk(raw, "Notes");
  const lastSeenNote = asNote(opts.lastSeenNotes) || labeledChunk(raw, "Details");
  return { petNote, lastSeenNote };
}

/**
 * Strip auto-generated duplicates from older missing-alert descriptions
 * (species, "Last seen: …", trailing help line when we show structured UI).
 */
export function cleanPostBody(
  description: string | null | undefined,
  opts: {
    locationText?: string | null;
    species?: string | null;
    breed?: string | null;
    /** Extra phrases already shown as structured facts */
    dropNotes?: Array<string | null | undefined>;
  } = {},
): string {
  let text = String(description || "").trim();
  if (!text) return "";

  const location = String(opts.locationText || "").trim();
  const species = String(opts.species || "").trim();
  const breed = String(opts.breed || "").trim();

  const dropExact = new Set(
    [
      species,
      breed && species ? `${breed} ${species}` : "",
      breed,
      "Please help us bring them home.",
      "Please help us bring them home",
      location ? `Last seen: ${location}.` : "",
      location ? `Last seen: ${location}` : "",
      location,
      ...(opts.dropNotes || []),
    ]
      .map((s) => String(s || "").trim().toLowerCase())
      .filter(Boolean),
  );

  // Split on sentence-ish boundaries while keeping readable paragraphs
  const parts = text
    .split(/(?<=\.)\s+|\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  const kept = parts.filter((part) => {
    const norm = part.replace(/\s+/g, " ").trim().toLowerCase();
    if (dropExact.has(norm)) return false;
    if (location && norm.includes(location.toLowerCase()) && /^last seen:/i.test(part)) {
      return false;
    }
    if (species && norm === species.toLowerCase()) return false;
    if (breed && species && norm === `${breed} ${species}`.toLowerCase()) return false;
    return true;
  });

  let out = kept.join(" ").replace(/\s+/g, " ").trim();
  // Drop "persian Cat Notes:" / "Cat Notes:" style auto prefixes
  if (species) {
    const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const lead = breed
      ? new RegExp(`^${esc(breed)}\\s+${esc(species)}\\s+(Notes|Details):\\s*`, "i")
      : new RegExp(`^${esc(species)}\\s+(Notes|Details):\\s*`, "i");
    out = out.replace(lead, "");
  }
  out = out.replace(/^(Notes|Details):\s*/i, "");
  out = out.replace(/\b(?:Notes|Details):\s*/gi, "");
  for (const note of opts.dropNotes || []) {
    const n = String(note || "").trim();
    if (!n) continue;
    const esc = n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    out = out.replace(new RegExp(`(?:^|\\s)${esc}\\.?(?=\\s|$)`, "gi"), " ");
  }
  return out.replace(/\s+/g, " ").trim();
}
