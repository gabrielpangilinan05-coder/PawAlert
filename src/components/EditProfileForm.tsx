"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { normalizePhMobile } from "@/lib/phone";
import { UserAvatar } from "@/components/UserAvatar";

const MapPicker = dynamic(
  () => import("@/components/MapPicker").then((m) => m.MapPicker),
  { ssr: false, loading: () => <p className="muted">Loading map…</p> },
);

export function EditProfileForm({
  initial,
}: {
  initial: {
    name: string;
    email: string;
    phone: string | null;
    messenger: string | null;
    address: string | null;
    addressLat: number | null;
    addressLng: number | null;
    avatarUrl: string | null;
  };
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [name, setName] = useState(initial.name);
  const [phone, setPhone] = useState(initial.phone || "");
  const [messenger, setMessenger] = useState(initial.messenger || "");
  const [address, setAddress] = useState(initial.address || "");
  const [addressLat, setAddressLat] = useState<number | null>(initial.addressLat);
  const [addressLng, setAddressLng] = useState<number | null>(initial.addressLng);
  const [preview, setPreview] = useState<string | null>(initial.avatarUrl);
  const [file, setFile] = useState<File | null>(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    return () => {
      if (preview && preview.startsWith("blob:")) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  function onPickFile(list: FileList | null) {
    const next = list?.[0];
    if (!next) return;
    if (!next.type.startsWith("image/")) {
      setError("Choose a JPG, PNG, WEBP, or GIF photo.");
      return;
    }
    if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
    setFile(next);
    setRemoveAvatar(false);
    setPreview(URL.createObjectURL(next));
    setError(null);
  }

  function clearPhoto() {
    if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
    setFile(null);
    setRemoveAvatar(Boolean(initial.avatarUrl));
    setPreview(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const phoneNorm = phone.trim() ? normalizePhMobile(phone) : null;
    if (phone.trim() && !phoneNorm) {
      setError("Enter a valid PH mobile number (e.g. 09XXXXXXXXX).");
      setLoading(false);
      return;
    }

    try {
      const form = new FormData();
      form.set("name", name);
      form.set("phone", phoneNorm || "");
      form.set("messenger", messenger);
      form.set("address", address);
      if (addressLat != null) form.set("addressLat", String(addressLat));
      if (addressLng != null) form.set("addressLng", String(addressLng));
      if (removeAvatar) form.set("remove_avatar", "1");
      if (file) form.set("avatar", file);

      const res = await fetch("/api/profile", { method: "PATCH", body: form });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not save.");
        return;
      }
      router.push("/profile");
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
        <h2 className="create-section__title">Photo</h2>
        <div className="profile-edit-avatar">
          <UserAvatar name={name} src={preview} size="xl" />
          <div className="profile-edit-avatar__actions">
            <button
              type="button"
              className="btn btn-amber"
              onClick={() => fileRef.current?.click()}
            >
              {preview ? "Change photo" : "Add photo"}
            </button>
            {preview ? (
              <button type="button" className="btn btn-outline" onClick={clearPhoto}>
                Remove
              </button>
            ) : null}
            <p className="muted create-hint" style={{ margin: 0 }}>
              Clear face photo helps finders trust your alerts.
            </p>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="user"
            className="sr-only"
            aria-label="Choose profile photo"
            onChange={(e) => {
              onPickFile(e.target.files);
              e.target.value = "";
            }}
          />
        </div>
      </section>

      <section className="create-section">
        <h2 className="create-section__title">Account</h2>
        <label>
          Full name
          <input required value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          Email
          <input type="email" value={initial.email} disabled />
          <span className="muted">Email can’t be changed here.</span>
        </label>
        <label>
          Phone
          <input
            inputMode="tel"
            placeholder="09XXXXXXXXX"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </label>
        <label>
          Messenger <span className="muted">(optional)</span>
          <input
            value={messenger}
            onChange={(e) => setMessenger(e.target.value)}
            placeholder="Facebook username or m.me link"
          />
        </label>
      </section>

      <section className="create-section">
        <h2 className="create-section__title">Home area</h2>
        <label>
          Address
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Barangay, city, province"
          />
        </label>
        <MapPicker
          latName="address_lat"
          lngName="address_lng"
          initialLat={addressLat}
          initialLng={addressLng}
          searchPlaceholder="Search place"
          quiet
          onLabel={(label) => setAddress(label)}
          onCoords={(lat, lng) => {
            setAddressLat(lat);
            setAddressLng(lng);
          }}
        />
      </section>

      <div className="form-actions create-actions">
        <button className="btn btn-amber" type="submit" disabled={loading}>
          {loading ? "Saving…" : "Save profile"}
        </button>
        <Link className="btn btn-outline" href="/profile">
          Cancel
        </Link>
      </div>
    </form>
  );
}
