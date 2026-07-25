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
  const [mediaLabel, setMediaLabel] = useState<string | null>(null);
  const [locationHint, setLocationHint] = useState<string | null>(null);
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
      setMediaLabel(null);
      return;
    }
    setMediaLabel(file.name);
    if (file.type.startsWith("image/")) {
      setPreviewUrl(URL.createObjectURL(file));
    } else {
      setPreviewUrl(null);
    }
  }

  /** Get GPS before opening the camera — more reliable on Android than after capture. */
  async function fillLocationFromGps(): Promise<boolean> {
    if (!navigator.geolocation) {
      setLocationHint("GPS not available — use Search or Use my location on the map.");
      return false;
    }
    setGpsBusy(true);
    setLocationHint("Getting your location… Allow location, then the camera will open.");
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
        setLocationHint("Location ready — opening camera…");
      } else {
        setLocationHint("GPS pin set — opening camera…");
      }
      return true;
    } catch {
      setLocationHint(
        "Could not get GPS (allow Location for this site). Opening camera anyway — use Use my location after.",
      );
      return false;
    } finally {
      setGpsBusy(false);
    }
  }

  async function onTakePhotoClick() {
    await fillLocationFromGps();
    // Small delay so address/state paint before leaving to the camera app
    await new Promise((r) => window.setTimeout(r, 150));
    cameraRef.current?.click();
  }

  function onGalleryChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file && cameraRef.current) cameraRef.current.value = "";
    applyMedia(file);
  }

  function onCameraChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file && galleryRef.current) galleryRef.current.value = "";
    applyMedia(file);
    if (file && locationText.trim()) {
      setLocationHint("Photo added. Location was set from GPS before the camera.");
    } else if (file) {
      setLocationHint("Photo added. Tap Use my location on the map if the address is empty.");
    }
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
    if (chosen) {
      form.set("media", chosen);
    }

    if (alert && !locationText.trim()) {
      setError("Add a location (search, GPS, or type an address).");
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
      {error && <div className="flash flash-error">{error}</div>}
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
        <input name="title" required />
      </label>
      <label>
        Description
        <textarea name="description" rows={5} required />
      </label>
      <label>
        Species
        <input name="species" defaultValue="Dog" list="species-list" />
      </label>

      <div className="create-media-block">
        <p style={{ margin: "0 0 0.45rem", fontWeight: 700 }}>Photo / video</p>
        <div className="create-media-actions">
          <button
            type="button"
            className="btn btn-amber"
            onClick={() => void onTakePhotoClick()}
            disabled={gpsBusy}
          >
            {gpsBusy ? "Getting location…" : "Take photo"}
          </button>
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => galleryRef.current?.click()}
            disabled={gpsBusy}
          >
            Choose from gallery
          </button>
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
        <span className="muted">
          Take photo asks for GPS first (Allow), then opens the camera. Photos ≤ 5MB · Videos ≤
          20MB.
        </span>
        {mediaLabel ? <p className="create-media-name">{mediaLabel}</p> : null}
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt="Selected media preview" className="create-media-preview" />
        ) : null}
      </div>

      <label>
        Location {alert ? <span className="muted">(required for alerts)</span> : null}
        <input
          name="location_text"
          value={locationText}
          onChange={(e) => setLocationText(e.target.value)}
          placeholder="Town / landmark / street"
          required={alert}
        />
        <span className="muted">
          {locationHint ||
            "Take photo gets GPS first, then camera — or search / Use my location / tap the map."}
        </span>
      </label>
      <MapPicker
        latName="location_lat"
        lngName="location_lng"
        initialLat={locationLat}
        initialLng={locationLng}
        searchPlaceholder="Search place (e.g. San Jose Malino, Mexico)"
        onLabel={(label) => setLocationText(label)}
        onCoords={(lat, lng) => {
          setLocationLat(lat);
          setLocationLng(lng);
        }}
      />

      {showPet && pets.length > 0 && (
        <label>
          Link a pet
          <select name="pet_id" defaultValue="">
            <option value="">— none —</option>
            {pets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.status})
              </option>
            ))}
          </select>
        </label>
      )}
      {alert && (
        <>
          <label>
            Contact name
            <input name="contact_name" defaultValue={userName || ""} />
          </label>
          <label>
            Contact phone
            <input name="contact_phone" defaultValue={userPhone || ""} />
          </label>
          <label>
            Contact email
            <input name="contact_email" type="email" defaultValue={userEmail || ""} />
          </label>
        </>
      )}
      <datalist id="species-list">
        {["Dog", "Cat", "Bird", "Horse", "Rabbit", "Reptile", "Ferret", "Other"].map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
      <div className="form-actions">
        <button className="btn btn-amber" type="submit" disabled={loading}>
          {loading ? "Publishing…" : "Publish"}
        </button>
        <Link className="btn btn-outline" href="/feed">
          Cancel
        </Link>
      </div>
    </form>
  );
}
