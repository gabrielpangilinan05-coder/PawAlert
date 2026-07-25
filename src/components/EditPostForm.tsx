"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { DeletePostButton } from "@/components/DeletePostButton";

const MapPicker = dynamic(
  () => import("@/components/MapPicker").then((m) => m.MapPicker),
  { ssr: false, loading: () => <p className="muted">Loading map…</p> },
);

type ExistingMedia = {
  id: number;
  url: string;
  kind: "image" | "video";
};

type DraftMedia = {
  key: string;
  file: File;
  url: string;
  kind: "image" | "video";
};

const MAX_MEDIA = 8;

export function EditPostForm({
  postId,
  initial,
}: {
  postId: number;
  initial: {
    type: string;
    title: string;
    description: string;
    species: string;
    locationText: string;
    locationLat: number | null;
    locationLng: number | null;
    contactName: string;
    contactPhone: string;
    contactEmail: string;
    media: ExistingMedia[];
  };
}) {
  const router = useRouter();
  const cameraRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLInputElement | null>(null);
  const galleryRef = useRef<HTMLInputElement | null>(null);

  const alert = initial.type === "found" || initial.type === "missing";
  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description);
  const [species, setSpecies] = useState(initial.species || "Dog");
  const [locationText, setLocationText] = useState(initial.locationText);
  const [locationLat, setLocationLat] = useState<number | null>(initial.locationLat);
  const [locationLng, setLocationLng] = useState<number | null>(initial.locationLng);
  const [locationOpen, setLocationOpen] = useState(Boolean(initial.locationText));
  const [contactName, setContactName] = useState(initial.contactName);
  const [contactPhone, setContactPhone] = useState(initial.contactPhone);
  const [contactEmail, setContactEmail] = useState(initial.contactEmail);
  const [existing, setExisting] = useState<ExistingMedia[]>(initial.media);
  const [drafts, setDrafts] = useState<DraftMedia[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [mediaBusy, setMediaBusy] = useState(false);

  const totalCount = existing.length + drafts.length;
  const room = Math.max(0, MAX_MEDIA - existing.length - drafts.length);

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
      const cap = MAX_MEDIA - existing.length;
      for (const file of incoming) {
        if (next.length >= cap) break;
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
    setStatus("New media ready — save to upload");
  }

  function removeDraft(key: string) {
    setDrafts((prev) => {
      const target = prev.find((d) => d.key === key);
      if (target) URL.revokeObjectURL(target.url);
      return prev.filter((d) => d.key !== key);
    });
  }

  async function removeExisting(mediaId: number) {
    setMediaBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("action", "remove_media");
      form.set("media_id", String(mediaId));
      const res = await fetch(`/api/posts/${postId}`, { method: "PATCH", body: form });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not remove media.");
        return;
      }
      setExisting((prev) => prev.filter((m) => m.id !== mediaId));
      setStatus("Media removed");
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setMediaBusy(false);
    }
  }

  async function setCover(mediaId: number) {
    setMediaBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("action", "set_cover");
      form.set("media_id", String(mediaId));
      const res = await fetch(`/api/posts/${postId}`, { method: "PATCH", body: form });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not set cover.");
        return;
      }
      setExisting((prev) => {
        const index = prev.findIndex((m) => m.id === mediaId);
        if (index <= 0) return prev;
        const copy = [...prev];
        const [item] = copy.splice(index, 1);
        copy.unshift(item!);
        return copy;
      });
      setStatus("Cover updated");
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setMediaBusy(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (alert && !locationText.trim()) {
      setError("Add a location for Found / Missing alerts.");
      setLoading(false);
      setLocationOpen(true);
      return;
    }

    const form = new FormData();
    form.set("action", "update");
    form.set("title", title.trim());
    form.set("description", description.trim());
    form.set("species", species);
    form.set("location_text", locationText.trim());
    if (locationLat != null) form.set("location_lat", String(locationLat));
    if (locationLng != null) form.set("location_lng", String(locationLng));
    form.set("contact_name", contactName.trim());
    form.set("contact_phone", contactPhone.trim());
    form.set("contact_email", contactEmail.trim());
    for (const draft of drafts) {
      form.append("media", draft.file);
    }

    try {
      const res = await fetch(`/api/posts/${postId}`, { method: "PATCH", body: form });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not save.");
        return;
      }
      drafts.forEach((d) => URL.revokeObjectURL(d.url));
      router.push(`/post/${postId}`);
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
        <p className="muted" style={{ marginTop: 0 }}>
          Type: <strong>{initial.type}</strong> (can’t change after posting)
        </p>
        <label>
          Title
          <input required value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label>
          Description
          <textarea
            rows={4}
            required
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <label>
          Species
          <input value={species} onChange={(e) => setSpecies(e.target.value)} list="species-list" />
        </label>
      </section>

      <section className="create-section">
        <h2 className="create-section__title">
          Photos &amp; video
          <span className="create-count">
            {totalCount}/{MAX_MEDIA}
          </span>
        </h2>
        <div className="create-media-actions">
          <button
            type="button"
            className="btn btn-amber"
            onClick={() => cameraRef.current?.click()}
            disabled={mediaBusy || room <= 0}
          >
            Take photo
          </button>
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => videoRef.current?.click()}
            disabled={mediaBusy || room <= 0}
          >
            Record video
          </button>
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => galleryRef.current?.click()}
            disabled={mediaBusy || room <= 0}
          >
            Gallery
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
          ref={videoRef}
          type="file"
          accept="video/*"
          capture="environment"
          className="sr-only"
          aria-label="Record video with camera"
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

        {existing.length === 0 && drafts.length === 0 ? (
          <p className="create-hint">Up to {MAX_MEDIA} photos/videos. Add more anytime.</p>
        ) : (
          <ul className="create-media-grid">
            {existing.map((item, index) => (
              <li key={`e-${item.id}`} className="create-media-item">
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
                  {index > 0 ? (
                    <button type="button" disabled={mediaBusy} onClick={() => void setCover(item.id)}>
                      Cover
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="is-danger"
                    disabled={mediaBusy}
                    onClick={() => void removeExisting(item.id)}
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
            {drafts.map((item) => (
              <li key={item.key} className="create-media-item">
                {item.kind === "video" ? (
                  <video src={item.url} muted playsInline preload="metadata" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.url} alt="" />
                )}
                <span className="create-media-badge">New</span>
                {item.kind === "video" ? (
                  <span className="create-media-badge create-media-badge--video">Video</span>
                ) : null}
                <div className="create-media-item__actions">
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
        ) : null}
      </section>

      {alert ? (
        <section className="create-section">
          <h2 className="create-section__title">Contact</h2>
          <label>
            Name
            <input value={contactName} onChange={(e) => setContactName(e.target.value)} />
          </label>
          <label>
            Phone
            <input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
          </label>
          <label>
            Email
            <input
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
            />
          </label>
        </section>
      ) : null}

      <datalist id="species-list">
        {["Dog", "Cat", "Bird", "Horse", "Rabbit", "Reptile", "Ferret", "Other"].map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>

      <div className="form-actions create-actions">
        <button className="btn btn-amber" type="submit" disabled={loading || mediaBusy}>
          {loading ? "Saving…" : "Save changes"}
        </button>
        <Link className="btn btn-outline" href={`/post/${postId}`}>
          Cancel
        </Link>
        <DeletePostButton postId={postId} className="btn btn-danger" />
      </div>
    </form>
  );
}
