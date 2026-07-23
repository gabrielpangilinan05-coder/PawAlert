"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useState, useTransition } from "react";
import { AlertRadiusMap } from "@/components/AlertRadiusMap";
import { ANIMAL_SPECIES } from "@/lib/species";

const ALL_SPECIES_LABEL = "All Species";

function normalizeSpecies(raw: string): string {
  const q = raw.trim();
  if (!q || q.toLowerCase() === "all" || q.toLowerCase() === "all species") {
    return "all";
  }
  const exact = ANIMAL_SPECIES.find((s) => s.toLowerCase() === q.toLowerCase());
  if (exact) return exact;
  const partial = ANIMAL_SPECIES.find((s) => s.toLowerCase().startsWith(q.toLowerCase()));
  return partial || q;
}

function speciesDisplay(value: string): string {
  if (!value || value === "all") return ALL_SPECIES_LABEL;
  return value;
}

const STATUS = [
  { value: "lost", label: "Lost" },
  { value: "found", label: "Found/Stray" },
  { value: "reunited", label: "Reunited" },
] as const;

const SEX = [
  { value: "all", label: "All" },
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "unknown", label: "Unknown" },
] as const;

const SORT = [
  { value: "updated", label: "Recently updated" },
  { value: "posted", label: "Originally posted" },
  { value: "nearest", label: "Nearest distance" },
] as const;

const WITHIN = [
  { value: "1m", label: "1 Month" },
  { value: "3m", label: "3 Months" },
  { value: "6m", label: "6 Months" },
  { value: "1y", label: "1 Year" },
] as const;

export const DEFAULT_ALERT_LOCATION = {
  label: "Angeles City, Central Luzon, Philippines",
  lat: 15.1451,
  lng: 120.5887,
};

export type AlertFilterValues = {
  status?: string;
  species?: string;
  sex?: string;
  sort?: string;
  within?: string;
  location?: string;
  nearLat?: string;
  nearLng?: string;
  radius?: string;
};

function statusToType(status: string): "missing" | "found" | "resolved" {
  if (status === "found") return "found";
  if (status === "reunited") return "resolved";
  return "missing";
}

function typeToStatus(type: string): string {
  if (type === "found") return "found";
  if (type === "resolved") return "reunited";
  return "lost";
}

function RadioGrid({
  name,
  options,
  value,
  onChange,
  columns = 3,
}: {
  name: string;
  options: readonly { value: string; label: string }[] | readonly string[];
  value: string;
  onChange: (v: string) => void;
  columns?: 2 | 3;
}) {
  const items = options.map((o) =>
    typeof o === "string" ? { value: o === "All Species" ? "all" : o, label: o } : o,
  );

  return (
    <div
      className={`alert-filter-grid alert-filter-grid--${columns}`}
      role="radiogroup"
      aria-label={name}
    >
      {items.map((item) => {
        const selected = value.toLowerCase() === item.value.toLowerCase();
        return (
          <label key={item.value} className={`alert-filter-option${selected ? " is-selected" : ""}`}>
            <input
              type="radio"
              name={name}
              value={item.value}
              checked={selected}
              onChange={() => onChange(item.value)}
            />
            <span className="alert-filter-radio" aria-hidden />
            <span className="alert-filter-label">{item.label}</span>
          </label>
        );
      })}
    </div>
  );
}

export function AlertFilterPanel({
  alertType,
  initial,
}: {
  alertType: "missing" | "found" | "resolved";
  initial: AlertFilterValues;
}) {
  const router = useRouter();
  const speciesListId = useId();
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState(initial.status || typeToStatus(alertType));
  const [species, setSpecies] = useState(() => {
    const v = initial.species || "all";
    return !v || v === "all" ? "all" : v;
  });
  const [speciesQuery, setSpeciesQuery] = useState(() => speciesDisplay(initial.species || "all"));
  const [sex, setSex] = useState(initial.sex || "all");
  const [sort, setSort] = useState(initial.sort || "updated");
  const [within, setWithin] = useState(initial.within || "3m");
  const [location, setLocation] = useState(
    initial.location || DEFAULT_ALERT_LOCATION.label,
  );
  const [nearLat, setNearLat] = useState(() => {
    const n = Number(initial.nearLat);
    return Number.isFinite(n) ? n : DEFAULT_ALERT_LOCATION.lat;
  });
  const [nearLng, setNearLng] = useState(() => {
    const n = Number(initial.nearLng);
    return Number.isFinite(n) ? n : DEFAULT_ALERT_LOCATION.lng;
  });
  const [radius, setRadius] = useState(() => {
    const n = Number(initial.radius || 25);
    return Number.isFinite(n) && n > 0 ? n : 25;
  });
  const [suggestions, setSuggestions] = useState<
    { label: string; lat: number | null; lng: number | null }[]
  >([]);
  const [error, setError] = useState<string | null>(null);

  const bannerText = useMemo(() => {
    const place = location.trim() || "your area";
    const miles = Math.round(radius);
    const kind =
      status === "found"
        ? "found pets"
        : status === "reunited"
          ? "reunited pets"
          : "lost and found pets";
    return `Showing ${kind} within ${miles} miles of ${place}`;
  }, [location, radius, status]);

  useEffect(() => {
    const q = location.trim();
    if (q.length < 3) {
      setSuggestions([]);
      return;
    }
    if (q === DEFAULT_ALERT_LOCATION.label && nearLat && nearLng) {
      setSuggestions([]);
      return;
    }
    const t = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        if (data.ok && Array.isArray(data.results)) {
          setSuggestions(data.results.slice(0, 5));
        }
      } catch {
        /* ignore */
      }
    }, 400);
    return () => window.clearTimeout(t);
  }, [location, nearLat, nearLng]);

  function commitSpeciesQuery() {
    const next = normalizeSpecies(speciesQuery);
    setSpecies(next);
    setSpeciesQuery(speciesDisplay(next));
  }

  function pickSuggestion(s: { label: string; lat: number | null; lng: number | null }) {
    setLocation(s.label);
    if (s.lat != null && s.lng != null) {
      setNearLat(s.lat);
      setNearLng(s.lng);
    }
    setSuggestions([]);
  }

  async function resolveCoords(): Promise<{ lat: number; lng: number; label: string } | null> {
    const q = location.trim();
    if (!q) return null;

    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      const first = data.ok && Array.isArray(data.results) ? data.results[0] : null;
      if (first?.lat != null && first?.lng != null) {
        return {
          lat: Number(first.lat),
          lng: Number(first.lng),
          label: String(first.label || q),
        };
      }
    } catch {
      /* fall through */
    }

    if (Number.isFinite(nearLat) && Number.isFinite(nearLng)) {
      return { lat: nearLat, lng: nearLng, label: q };
    }
    return null;
  }

  async function apply() {
    setError(null);
    const resolvedSpecies = normalizeSpecies(speciesQuery);
    setSpecies(resolvedSpecies);
    setSpeciesQuery(speciesDisplay(resolvedSpecies));

    const coords = await resolveCoords();
    if (!coords) {
      setError("Enter a city, zip, or address in the Philippines.");
      return;
    }

    setLocation(coords.label);
    setNearLat(coords.lat);
    setNearLng(coords.lng);

    const params = new URLSearchParams();
    const feedType = statusToType(status);
    params.set("type", feedType);
    params.set("loc", coords.label);
    params.set("near_lat", String(coords.lat));
    params.set("near_lng", String(coords.lng));
    params.set("radius", String(Math.round(radius)));
    if (resolvedSpecies && resolvedSpecies !== "all") params.set("species", resolvedSpecies);
    if (sex && sex !== "all") params.set("sex", sex);
    if (sort) params.set("sort", sort);
    if (within) params.set("within", within);

    startTransition(() => {
      router.push(`/feed?${params.toString()}`);
    });
  }

  return (
    <aside className="alert-filter-panel" aria-label="Alert filters">
      <div className="alert-filter-banner">{bannerText}</div>

      <div className="alert-filter-body">
        <section className="alert-filter-section">
          <h3>Status</h3>
          <RadioGrid name="status" options={STATUS} value={status} onChange={setStatus} columns={3} />
        </section>

        <section className="alert-filter-section">
          <h3>Location</h3>
          <label className="alert-filter-field">
            <span>City, Zip, or Address</span>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Angeles City, Pampanga"
              autoComplete="off"
            />
          </label>
          {suggestions.length > 0 ? (
            <ul className="alert-filter-suggest">
              {suggestions.map((s) => (
                <li key={s.label}>
                  <button type="button" onClick={() => pickSuggestion(s)}>
                    {s.label}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          <AlertRadiusMap
            lat={nearLat}
            lng={nearLng}
            radiusMiles={radius}
            onCoords={(nextLat, nextLng) => {
              setNearLat(nextLat);
              setNearLng(nextLng);
            }}
            onLabel={(label) => setLocation(label)}
          />

          <div className="alert-filter-distance">
            <div className="alert-filter-distance-head">
              <span>Distance</span>
              <strong>{Math.round(radius)} Miles</strong>
            </div>
            <input
              type="range"
              min={1}
              max={100}
              step={1}
              value={radius}
              onChange={(e) => setRadius(Number(e.target.value))}
              aria-label="Search radius in miles"
            />
          </div>
        </section>

        <section className="alert-filter-section">
          <h3>Animal</h3>
          <label className="alert-filter-field">
            <span>Type</span>
            <input
              type="text"
              list={speciesListId}
              className="js-species-input"
              value={speciesQuery}
              onChange={(e) => {
                const next = e.target.value;
                setSpeciesQuery(next);
                setSpecies(normalizeSpecies(next));
              }}
              onBlur={commitSpeciesQuery}
              placeholder="Type to search: Dog, Cat, Rabbit…"
              autoComplete="off"
              aria-label="Animal type"
            />
          </label>
          <datalist id={speciesListId}>
            <option value={ALL_SPECIES_LABEL} />
            {ANIMAL_SPECIES.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </section>

        <section className="alert-filter-section">
          <h3>Sex</h3>
          <RadioGrid name="sex" options={SEX} value={sex} onChange={setSex} />
        </section>

        <section className="alert-filter-section">
          <h3>Sort</h3>
          <RadioGrid name="sort" options={SORT} value={sort} onChange={setSort} />
        </section>

        <section className="alert-filter-section">
          <h3>Within Past</h3>
          <RadioGrid name="within" options={WITHIN} value={within} onChange={setWithin} />
        </section>

        {error ? <p className="alert-filter-error">{error}</p> : null}
      </div>

      <button type="button" className="alert-filter-find" onClick={apply} disabled={pending}>
        {pending ? "Finding…" : "Find"}
      </button>
    </aside>
  );
}
