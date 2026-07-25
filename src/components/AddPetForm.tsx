"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SpeciesBreedFields } from "@/components/SpeciesBreedFields";

export function AddPetForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/pets", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not save pet.");
        return;
      }
      router.push(`/pets/${data.id}`);
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="form-grid"
      style={{ marginTop: "1.2rem" }}
      encType="multipart/form-data"
    >
      {error && (
        <div className="flash flash-error" style={{ margin: "0 0 0.25rem" }}>
          {error}
        </div>
      )}
      <label>
        Pet name
        <input name="name" required type="text" />
      </label>
      <SpeciesBreedFields defaultSpecies="Dog" />
      <label>
        Sex
        <select name="sex" defaultValue="unknown">
          <option value="unknown">Unknown</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
        </select>
      </label>
      <label>
        Photos &amp; videos
        <input
          name="media"
          type="file"
          accept="image/*,video/mp4,video/webm,video/quicktime"
          multiple
        />
        <span className="muted">
          Upload up to 8 files. Photos ≤ 5MB · Videos ≤ 20MB. First image becomes the cover.
        </span>
      </label>
      <label>
        Medical notes / special needs
        <textarea name="medical_notes" rows={3} />
      </label>
      <div>
        <p style={{ margin: "0 0 0.5rem", fontWeight: 600 }}>Show on Missing profile</p>
        <div className="check-row">
          <label>
            <input type="checkbox" name="show_phone" defaultChecked /> Phone
          </label>
          <label>
            <input type="checkbox" name="show_email" /> Email
          </label>
          <label>
            <input type="checkbox" name="show_messenger" defaultChecked /> Messenger
          </label>
          <label>
            <input type="checkbox" name="show_address" /> Home area
          </label>
        </div>
        <p className="muted" style={{ margin: "0.5rem 0 0" }}>
          Last-seen details will be requested only when you mark this pet Missing.
        </p>
      </div>
      <div className="form-actions">
        <button className="btn btn-amber" type="submit" disabled={loading}>
          {loading ? "Saving…" : "Save pet"}
        </button>
        <Link className="btn btn-outline" href="/profile">
          Cancel
        </Link>
      </div>
    </form>
  );
}
