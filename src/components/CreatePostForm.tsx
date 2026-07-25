"use client";

import dynamic from "next/dynamic";
import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const MapPicker = dynamic(
  () => import("@/components/MapPicker").then((m) => m.MapPicker),
  { ssr: false, loading: () => <p className="muted">Loading map…</p> },
);

type PetOpt = { id: number; name: string; status: string };

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
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [hasMedia, setHasMedia] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [gpsBusy, setGpsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const alert = type === "found" || type === "missing";

  const showPet = useMemo(
    () => type === "missing" || type === "story" || type === "tip" || type === "question",
    [type],
  );

  function applyMedia(file: File | null | undefined) {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (!file) {
      setPreviewUrl(null);
      setHasMedia(false);
      return;
    }
    setHasMedia(true);
    if (file.type.startsWith("image/")) {
      setPreviewUrl(URL.createObjectURL(file));
    } else {
      setPreviewUrl(null);
    }
  }

  async function fillLocationFromGps(): Promise<boolean> {
    if (!navigator.geolocation) {
      setStatus("GPS unavailable — search or tap the map.");
      return false;
    }
    setGpsBusy(true);
    setStatus("Getting location…");
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

  function onGalleryChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file && cameraRef.current) cameraRef.current.value = "";
    applyMedia(file);
    if (file) setStatus("Photo ready");
  }

  function onCameraChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file && galleryRef.current) galleryRef.current.value = "";
    applyMedia(file);
    if (file) {
      setStatus(locationText.trim() ? "Photo & location ready" : "Photo ready — set location below");
    }
  }

  function clearMedia() {
    if (cameraRef.current) cameraRef.current.value = "";
    if (galleryRef.current) galleryRef.current.value = "";
    applyMedia(null);
    setStatus(null);
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

    const cameraFile = cameraRef.current?.files?.[0];
    const galleryFile = galleryRef.current?.files?.[0];
    const chosen = cameraFile || galleryFile;
    if (chosen) form.set("media", chosen);

    if (alert && !locationText.trim()) {
      setError("Add a location for Found / Missing alerts.");
      setLoading(false);
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
        <h2 className="create-section__title">Photo</h2>
        <div className="create-media-actions">
          <button
            type="button"
            className="btn btn-amber"
            onClick={() => void onTakePhotoClick()}
            disabled={gpsBusy}
          >
            {gpsBusy ? "Locating…" : "Take photo"}
          </button>
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => galleryRef.current?.click()}
            disabled={gpsBusy}
          >
            Gallery
          </button>
          {hasMedia ? (
            <button type="button" className="btn btn-outline create-media-clear" onClick={clearMedia}>
              Remove
            </button>
          ) : null}
        </div>
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          aria-label="Take photo with camera"
          onChange={onCameraChange}
        />
        <input
          ref={galleryRef}
          type="file"
          accept="image/*,video/mp4,video/webm,video/quicktime"
          className="sr-only"
          aria-label="Choose photo or video from gallery"
          onChange={onGalleryChange}
        />
        {previewUrl ? (
          <div className="create-media-preview-wrap">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previewUrl} alt="Selected media preview" className="create-media-preview" />
            <span className="create-media-badge">Ready</span>
          </div>
        ) : hasMedia ? (
          <p className="create-status">Video selected</p>
        ) : (
          <p className="create-hint">Take photo sets location first, then opens the camera.</p>
        )}
      </section>

      <section className="create-section">
        <h2 className="create-section__title">
          Location {alert ? <span className="create-required">Required</span> : null}
        </h2>
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
        {status ? <p className="create-status">{status}</p> : null}
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
