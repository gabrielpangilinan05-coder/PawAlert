"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { SpeciesBreedFields } from "@/components/SpeciesBreedFields";
import { ShareAlertDialog } from "@/components/ShareAlertDialog";
import { PetMediaGallery, type PetMediaItem } from "@/components/PetMediaGallery";
import { mediaUrl } from "@/lib/media";

const MapPicker = dynamic(
  () => import("@/components/MapPicker").then((m) => m.MapPicker),
  { ssr: false, loading: () => <p className="muted">Loading map…</p> },
);

export type ManagePet = {
  id: number;
  name: string;
  species: string;
  breed: string | null;
  sex: string;
  medical_notes: string | null;
  status: string;
  public_slug: string;
  show_phone: number;
  show_email: number;
  show_messenger: number;
  show_address: number;
  last_seen_text: string | null;
  last_seen_notes: string | null;
  last_seen_at: string | null;
  last_seen_media_path: string | null;
  last_seen_media_type: string | null;
  last_seen_lat: number | null;
  last_seen_lng: number | null;
  home_lat: number | null;
  home_lng: number | null;
  owner_address: string | null;
};

function localDatetimeValue(d = new Date()) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDisplayDatetime(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function ManagePetForm({
  pet,
  media = [],
  lastSeenMediaUrl,
  coverPhotoUrl,
  publicUrl,
}: {
  pet: ManagePet;
  media?: PetMediaItem[];
  lastSeenMediaUrl?: string | null;
  coverPhotoUrl?: string | null;
  publicUrl: string;
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(pet.status);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [lastSeenText, setLastSeenText] = useState(pet.last_seen_text || "");
  const [when, setWhen] = useState(localDatetimeValue());

  useEffect(() => {
    setStatus(pet.status);
    setLastSeenText(pet.last_seen_text || "");
  }, [pet.status, pet.last_seen_text]);

  const sharePhotoUrl =
    (pet.last_seen_media_type === "image" && lastSeenMediaUrl) ||
    coverPhotoUrl ||
    mediaUrl(media.find((m) => m.media_type === "image")?.file_path) ||
    null;

  async function submit(form: FormData) {
    setLoading(true);
    setError(null);
    setMsg(null);
    try {
      const res = await fetch(`/api/pets/${pet.id}`, { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Update failed.");
        return false;
      }
      if (data.deleted) {
        router.push("/profile");
        router.refresh();
        return true;
      }
      if (data.status) setStatus(data.status);
      setMsg("Saved.");
      router.refresh();
      return true;
    } catch {
      setError("Network error");
      return false;
    } finally {
      setLoading(false);
    }
  }

  function openMissingDialog() {
    setWhen(localDatetimeValue());
    setDialogOpen(true);
    dialogRef.current?.showModal();
    // Leaflet needs a layout pass after the dialog paints
    setTimeout(() => window.dispatchEvent(new Event("resize")), 250);
  }

  function closeMissingDialog() {
    dialogRef.current?.close();
    setDialogOpen(false);
  }

  async function deletePet() {
    const ok = window.confirm(
      `Delete ${pet.name} permanently?\n\nThis removes the pet profile, QR link, photos/videos, and related Missing alerts. This cannot be undone.`,
    );
    if (!ok) return;
    const fd = new FormData();
    fd.set("action", "delete_pet");
    await submit(fd);
  }

  return (
    <>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "1rem",
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <div>
          <span className={`badge badge-${status === "missing" ? "missing" : "safe"}`}>
            {status}
          </span>
          <h1 style={{ marginTop: "0.35rem", fontFamily: "var(--font-display)" }}>
            Manage {pet.name}
          </h1>
        </div>
        <div className="form-actions" style={{ margin: 0 }}>
          {status === "safe" ? (
            <button className="btn btn-danger" type="button" onClick={openMissingDialog}>
              Mark MISSING
            </button>
          ) : (
            <>
              <button className="btn btn-outline" type="button" onClick={() => setShareOpen(true)}>
                Share alert
              </button>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const fd = new FormData();
                  fd.set("action", "mark_safe");
                  await submit(fd);
                }}
                className="form-actions"
                style={{ margin: 0 }}
              >
                <button className="btn btn-safe" type="submit" disabled={loading}>
                  Mark SAFE
                </button>
              </form>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="flash flash-error" style={{ margin: "1rem 0" }}>
          {error}
        </div>
      )}
      {msg && (
        <div className="flash flash-success" style={{ margin: "1rem 0" }}>
          {msg}
        </div>
      )}

      {status === "missing" &&
        (pet.last_seen_text || pet.last_seen_notes || pet.last_seen_at || pet.last_seen_media_path) && (
          <div className="flash flash-error" style={{ margin: "1rem 0" }}>
            {pet.last_seen_text && (
              <div>
                <strong>Last seen:</strong> {pet.last_seen_text}
              </div>
            )}
            {pet.last_seen_notes && (
              <div>
                <strong>Details:</strong> {pet.last_seen_notes}
              </div>
            )}
            {pet.last_seen_at && (
              <div>
                <strong>Date &amp; time:</strong> {formatDisplayDatetime(pet.last_seen_at)}
              </div>
            )}
            {pet.last_seen_media_path && lastSeenMediaUrl && (
              <div style={{ marginTop: "0.75rem" }}>
                {pet.last_seen_media_type === "video" ? (
                  <video
                    controls
                    style={{ width: "100%", maxWidth: 320, borderRadius: 12 }}
                    src={lastSeenMediaUrl}
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={lastSeenMediaUrl}
                    alt="Last seen media"
                    style={{
                      width: "100%",
                      maxWidth: 220,
                      borderRadius: 12,
                      objectFit: "cover",
                    }}
                  />
                )}
              </div>
            )}
          </div>
        )}

      <form
        className="form-grid"
        style={{ marginTop: "1.2rem" }}
        onSubmit={(e) => {
          e.preventDefault();
          submit(new FormData(e.currentTarget));
        }}
      >
        <input type="hidden" name="action" value="save" />
        <div className="pet-media-block">
          <p style={{ margin: "0 0 0.5rem", fontWeight: 600 }}>Photos &amp; videos</p>
          <PetMediaGallery petId={pet.id} media={media} />
          <label style={{ marginTop: "0.75rem" }}>
            Add photos / videos
            <input name="media" type="file" accept="image/*,video/mp4,video/webm,video/quicktime" multiple />
            <span className="muted">Up to 8 total. Photos ≤ 5MB · Videos ≤ 20MB. Click a tile to view full size.</span>
          </label>
        </div>
        <label>
          Pet name
          <input name="name" required defaultValue={pet.name} />
        </label>
        <SpeciesBreedFields defaultSpecies={pet.species} defaultBreed={pet.breed || ""} />
        <label>
          Sex
          <select name="sex" defaultValue={pet.sex}>
            <option value="unknown">Unknown</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
        </label>
        <label>
          Medical notes
          <textarea name="medical_notes" rows={3} defaultValue={pet.medical_notes || ""} />
        </label>
        <label>
          Owner / pet home address
          <input
            name="owner_address"
            id="home-address-text"
            defaultValue={pet.owner_address || ""}
            placeholder="Barangay, city, province"
            onChange={(e) => {
              /* keep uncontrolled default for MapPicker label writes via id */
              e.currentTarget.dataset.touched = "1";
            }}
          />
          <span className="muted">Search or tap the map. Share only a general area—not a house number.</span>
        </label>
        <MapPicker
          latName="home_lat"
          lngName="home_lng"
          initialLat={pet.home_lat}
          initialLng={pet.home_lng}
          searchPlaceholder="Search place (e.g. Arayat, Pampanga)"
          onLabel={(label) => {
            const el = document.getElementById("home-address-text") as HTMLInputElement | null;
            if (el) el.value = label;
          }}
        />
        <div>
          <p style={{ margin: "0 0 0.5rem", fontWeight: 600 }}>Privacy when Missing</p>
          <div className="check-row">
            <label>
              <input type="checkbox" name="show_phone" defaultChecked={pet.show_phone === 1} /> Phone
            </label>
            <label>
              <input type="checkbox" name="show_email" defaultChecked={pet.show_email === 1} /> Email
            </label>
            <label>
              <input type="checkbox" name="show_messenger" defaultChecked={pet.show_messenger === 1} />{" "}
              Messenger
            </label>
            <label>
              <input type="checkbox" name="show_address" defaultChecked={pet.show_address === 1} /> Home
              area
            </label>
          </div>
          <p className="muted" style={{ margin: "0.5rem 0 0" }}>
            For safety, share only a general area—not a house number.
          </p>
        </div>
        <div className="form-actions">
          <button className="btn btn-amber" type="submit" disabled={loading}>
            {loading ? "Saving…" : "Save changes"}
          </button>
          <Link className="btn btn-outline" href="/profile">
            Back
          </Link>
          <button
            className="btn btn-danger"
            type="button"
            disabled={loading}
            onClick={deletePet}
            style={{ marginLeft: "auto" }}
          >
            Delete pet
          </button>
        </div>
      </form>

      <dialog
        ref={dialogRef}
        className="missing-dialog"
        onClose={() => setDialogOpen(false)}
      >
        <form
          className="form-grid"
          onSubmit={async (e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            fd.set("action", "mark_missing");
            const ok = await submit(fd);
            if (ok) closeMissingDialog();
          }}
        >
          <div>
            <span className="badge badge-missing">Missing alert</span>
            <h2>Where was {pet.name} last seen?</h2>
            <p className="muted">
              Location, date/time, and optional photo or video will appear on the public QR profile and
              feed.
            </p>
          </div>
          <label>
            Last-seen location
            <textarea
              name="last_seen_text"
              required
              value={lastSeenText}
              onChange={(e) => setLastSeenText(e.target.value)}
              placeholder="Example: Near San Jose Malino barangay hall"
            />
            <span className="muted">Search a place, use your GPS, or tap the map.</span>
          </label>
          {dialogOpen && (
            <MapPicker
              latName="last_seen_lat"
              lngName="last_seen_lng"
              initialLat={pet.last_seen_lat}
              initialLng={pet.last_seen_lng}
              searchPlaceholder="Search last-seen place"
              onLabel={(label) => setLastSeenText(label)}
            />
          )}
          <label>
            Details / notes (optional)
            <textarea
              name="last_seen_notes"
              rows={3}
              defaultValue={pet.last_seen_notes || ""}
              placeholder="e.g. Brown collar, shy around strangers, last seen with another dog"
            />
            <span className="muted">Anything that helps people recognize or find your pet.</span>
          </label>
          <label>
            Date &amp; time
            <input
              type="datetime-local"
              name="last_seen_at"
              required
              value={when}
              onChange={(e) => setWhen(e.target.value)}
            />
            <span className="muted">Filled automatically with the current time. You can adjust it if needed.</span>
          </label>
          <label>
            Photo or video (optional)
            <input name="last_seen_media" type="file" accept="image/*,video/mp4,video/webm,video/quicktime" />
            <span className="muted">Photos up to 5MB. Videos (MP4/WEBM/MOV) up to 20MB.</span>
          </label>
          <div className="form-actions">
            <button className="btn btn-danger" type="submit" disabled={loading}>
              {loading ? "Saving…" : "Confirm MISSING"}
            </button>
            <button className="btn btn-outline" type="button" onClick={closeMissingDialog}>
              Cancel
            </button>
          </div>
        </form>
      </dialog>

      <ShareAlertDialog
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        details={{
          petName: pet.name,
          species: pet.species,
          breed: pet.breed,
          lastSeenText: pet.last_seen_text,
          lastSeenNotes: pet.last_seen_notes,
          lastSeenAt: pet.last_seen_at,
          publicUrl,
          photoUrl: sharePhotoUrl,
        }}
      />
    </>
  );
}
