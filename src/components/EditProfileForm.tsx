"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { normalizePhMobile } from "@/lib/phone";

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
  };
}) {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [phone, setPhone] = useState(initial.phone || "");
  const [messenger, setMessenger] = useState(initial.messenger || "");
  const [address, setAddress] = useState(initial.address || "");
  const [addressLat, setAddressLat] = useState<number | null>(initial.addressLat);
  const [addressLng, setAddressLng] = useState<number | null>(initial.addressLng);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          phone: phoneNorm || "",
          messenger,
          address,
          addressLat,
          addressLng,
        }),
      });
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
