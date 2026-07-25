"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const MapPicker = dynamic(
  () => import("@/components/MapPicker").then((m) => m.MapPicker),
  { ssr: false, loading: () => <p className="muted">Loading map…</p> },
);

type PetOpt = { id: number; name: string; status: string };

type DraftMedia = {
  key: string;
  file: File;
  url: string;
  kind: "image" | "video";
};

const MAX_MEDIA = 8;

export function CreatePostForm({
  userName,
  userPhone,
  userEmail,
  pets,
  defaultType = "story",
}: {
  userName?: string;
  userPhone?: string | null;
  userEmail?: string | null;
  pets: PetOpt[];
  defaultType?: string;
}) {
  const router = useRouter();
  const cameraRef = useRef<HTMLInputElement | null>(null);
  const galleryRef = useRef<HTMLInputElement | null>(null);
  const [type, setType] = useState(defaultType);
  const [locationText, setLocationText] = useState("");
  const [locationLat, setLocationLat] = useState<number | null>(null);
  const [locationLng, setLocationLng] = useState<number | null>(null);
  const [locationOpen, setLocationOpen] = useState(true);
  const [drafts, setDrafts] = useState<DraftMedia[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [gpsBusy, setGpsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const alert = type === "found" || type === "missing";

  const showPet = useMemo(
    () => type === "missing" || type === "story" || type === "tip" || type === "question",
    [type],
  );

  useEffect(() => {
    return () => {
      drafts.forEach((d) => URL.revokeObjectURL(d.url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function addFiles(fileList: FileList | File[] | null | undefined) {
    if (!fileList) return;
    const incoming = Array.from(fileList).filter((f) => f && f.size > 0);
    if (!incoming.length) return;

    setDrafts((prev) => {
      const next = [...prev];
      for (const file of incoming) {
        if (next.length >= MAX_MEDIA) break;
        const kind = file.type.startsWith("video/")
          ? "video"
          : file.type.startsWith("image/")
            ? "image"
            : null;
        if (!kind) continue;
        next.push({
          key: `${file.name}-${file.size}-${file.lastModified}-${Math.random()}`,
          file,
          url: URL.createObjectURL(file),
          kind,
        });
      }
      return next;
    });
    setStatus("Media ready — reorder or remove before publishing");
  }

  function removeDraft(key: string) {
    setDrafts((prev) => {
      const target = prev.find((d) => d.key === key);
      if (target) URL.revokeObjectURL(target.url);
      return prev.filter((d) => d.key !== key);
    });
  }

  function moveDraft(key: string, dir: -1 | 1) {
    setDrafts((prev) => {
      const index = prev.findIndex((d) => d.key === key);
      if (index < 0) return prev;
      const nextIndex = index + dir;
      if (nextIndex < 0 || nextIndex >= prev.length) return prev;
      const copy = [...prev];
      const [item] = copy.splice(index, 1);
      copy.splice(nextIndex, 0, item!);
      return copy;
    });
  }

  function setAsCover(key: string) {
    setDrafts((prev) => {
      const index = prev.findIndex((d) => d.key === key);
      if (index <= 0) return prev;
      const copy = [...prev];
      const [item] = copy.splice(index, 1);
      copy.unshift(item!);
      return copy;
    });
    setStatus("Cover updated");
  }

  async function fillLocationFromGps(): Promise<boolean> {
    if (!navigator.geolocation) {
      setStatus("GPS unavailable — search or tap the map.");
      return false;
    }
    setGpsBusy(true);
    setStatus("Getting location…");
    setLocationOpen(true);
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 30000,
        });
      });
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      setLocationLat(lat);
      setLocationLng(lng);

      const res = await fetch(
        `/api/geocode?lat=${encodeURIComponent(String(lat))}&lng=${encodeURIComponent(String(lng))}`,
      );
      const data = await res.json();
      if (data.ok && data.results?.[0]?.label) {
        setLocationText(data.results[0].label);
        setStatus("Location set");
        setLocationOpen(false);
      } else {
        setStatus("GPS pin set — confirm on the map");
      }
      return true;
    } catch {
      setStatus("Location blocked — search or tap the map");
      return false;
    } finally {
      setGpsBusy(false);
    }
  }

  async function onTakePhotoClick() {
    await fillLocationFromGps();
    await new Promise((r) => window.setTimeout(r, 150));
    cameraRef.current?.click();
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    form.set("type", type);
    form.set("location_text", locationText.trim());
    if (locationLat != null) form.set("location_lat", String(locationLat));
    if (locationLng != null) form.set("location_lng", String(locationLng));
    form.delete("media");
    for (const draft of drafts) {
      form.append("media", draft.file);
    }

    if (alert && !locationText.trim()) {
      setError("Add a location for Found / Missing alerts.");
      setLoading(false);
      setLocationOpen(true);
      return;
    }

    try {
      const res = await fetch("/api/posts", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not publish.");
        return;
      }
      router.push(`/post/${data.id}`);
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  const locationSummary = locationText.trim() || "Add address or pin";

  return (
    <form onSubmit={onSubmit} className="form-grid create-post-form">
      {error ? <div className="flash flash-error">{error}</div> : null}

      <section className="create-section">
        <h2 className="create-section__title">Details</h2>
        <label>
          Post type
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="story">Pet story</option>
            <option value="tip">Care tip</option>
            <option value="question">Question</option>
            <option value="found">Found</option>
            <option value="missing">Missing</option>
          </select>
        </label>
        <label>
          Title
          <input name="title" required placeholder="Short headline" />
        </label>
        <label>
          Description
          <textarea name="description" rows={4} required placeholder="What should people know?" />
        </label>
        <label>
          Species
          <input name="species" defaultValue="Dog" list="species-list" />
        </label>
        {showPet && pets.length > 0 ? (
          <label>
            Link a pet
            <select name="pet_id" defaultValue="">
              <option value="">— optional —</option>
              {pets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.status})
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </section>

      <section className="create-section">
        <h2 className="create-section__title">
          Photos &amp; video
          <span className="create-count">
            {drafts.length}/{MAX_MEDIA}
          </span>
        </h2>
        <div className="create-media-actions">
          <button
            type="button"
            className="btn btn-amber"
            onClick={() => void onTakePhotoClick()}
            disabled={gpsBusy || drafts.length >= MAX_MEDIA}
          >
            {gpsBusy ? "Locating…" : "Take photo"}
          </button>
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => galleryRef.current?.click()}
            disabled={gpsBusy || drafts.length >= MAX_MEDIA}
          >
            Add media
          </button>
        </div>
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          aria-label="Take photo with camera"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <input
          ref={galleryRef}
          type="file"
          accept="image/*,video/mp4,video/webm,video/quicktime"
          multiple
          className="sr-only"
          aria-label="Choose photos or videos"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />
        {drafts.length === 0 ? (
          <p className="create-hint">Add up to {MAX_MEDIA} photos or videos. First item is the cover.</p>
        ) : (
          <ul className="create-media-grid">
            {drafts.map((item, index) => (
              <li key={item.key} className="create-media-item">
                {item.kind === "video" ? (
                  <video src={item.url} muted playsInline preload="metadata" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.url} alt="" />
                )}
                {index === 0 ? <span className="create-media-badge">Cover</span> : null}
                {item.kind === "video" ? (
                  <span className="create-media-badge create-media-badge--video">Video</span>
                ) : null}
                <div className="create-media-item__actions">
                  <button type="button" onClick={() => moveDraft(item.key, -1)} disabled={index === 0}>
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => moveDraft(item.key, 1)}
                    disabled={index === drafts.length - 1}
                  >
                    ↓
                  </button>
                  {index > 0 ? (
                    <button type="button" onClick={() => setAsCover(item.key)}>
                      Cover
                    </button>
                  ) : null}
                  <button type="button" className="is-danger" onClick={() => removeDraft(item.key)}>
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {status ? <p className="create-status">{status}</p> : null}
      </section>

      <section className="create-section create-location">
        <button
          type="button"
          className="create-collapse-head"
          onClick={() => setLocationOpen((o) => !o)}
          aria-expanded={locationOpen}
        >
          <span className="create-section__title">
            Location {alert ? <span className="create-required">Required</span> : null}
          </span>
          <span className="create-collapse-summary">{locationSummary}</span>
          <span className="create-collapse-chevron" aria-hidden>
            {locationOpen ? "▾" : "▸"}
          </span>
        </button>

        {locationOpen ? (
          <div className="create-collapse-body">
            <label className="create-location-label">
              <span className="sr-only">Address</span>
              <input
                name="location_text"
                value={locationText}
                onChange={(e) => setLocationText(e.target.value)}
                placeholder="Address or landmark"
                required={alert}
              />
            </label>
            <MapPicker
              latName="location_lat"
              lngName="location_lng"
              initialLat={locationLat}
              initialLng={locationLng}
              searchPlaceholder="Search place"
              quiet
              onLabel={(label) => {
                setLocationText(label);
                setStatus("Location set");
              }}
              onCoords={(lat, lng) => {
                setLocationLat(lat);
                setLocationLng(lng);
              }}
            />
          </div>
        ) : (
          <input type="hidden" name="location_text" value={locationText} />
        )}
        {!locationOpen ? (
          <>
            <input type="hidden" name="location_lat" value={locationLat ?? ""} readOnly />
            <input type="hidden" name="location_lng" value={locationLng ?? ""} readOnly />
          </>
        ) : null}
      </section>

      {alert ? (
        <section className="create-section">
          <h2 className="create-section__title">Contact</h2>
          <label>
            Name
            <input name="contact_name" defaultValue={userName || ""} />
          </label>
          <label>
            Phone
            <input name="contact_phone" defaultValue={userPhone || ""} />
          </label>
          <label>
            Email
            <input name="contact_email" type="email" defaultValue={userEmail || ""} />
          </label>
        </section>
      ) : null}

      <datalist id="species-list">
        {["Dog", "Cat", "Bird", "Horse", "Rabbit", "Reptile", "Ferret", "Other"].map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>

      <div className="form-actions create-actions">
        <button className="btn btn-amber" type="submit" disabled={loading || gpsBusy}>
          {loading ? "Publishing…" : "Publish"}
        </button>
        <Link className="btn btn-outline" href="/feed">
          Cancel
        </Link>
      </div>
    </form>
  );
}
