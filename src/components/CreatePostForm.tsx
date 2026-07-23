"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

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
  const [type, setType] = useState(defaultType);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const alert = type === "found" || type === "missing";

  const showPet = useMemo(
    () => type === "missing" || type === "story" || type === "tip" || type === "question",
    [type],
  );

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    form.set("type", type);
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
    <form onSubmit={onSubmit} className="form-grid">
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
      <label>
        Location
        <input name="location_text" placeholder="Town / landmark" />
      </label>
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
      <label>
        Photo / video
        <input name="media" type="file" accept="image/*,video/mp4,video/webm,video/quicktime" />
      </label>
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
