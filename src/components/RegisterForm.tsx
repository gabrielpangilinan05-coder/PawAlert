"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { useRouter } from "next/navigation";

const MapPicker = dynamic(
  () => import("@/components/MapPicker").then((m) => m.MapPicker),
  { ssr: false, loading: () => <p className="muted">Loading map…</p> },
);

export function RegisterForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    messenger: "",
    address: "",
    addressLat: null as number | null,
    addressLng: null as number | null,
    password: "",
    passwordConfirm: "",
  });
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          phone: form.phone,
          messenger: form.messenger,
          address: form.address,
          addressLat: form.addressLat,
          addressLng: form.addressLng,
          password: form.password,
          passwordConfirm: form.passwordConfirm,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Registration failed");
        return;
      }
      router.push("/verify-email");
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
        Full name
        <input required value={form.name} onChange={(e) => set("name", e.target.value)} />
      </label>
      <label>
        Email
        <input
          type="email"
          required
          value={form.email}
          onChange={(e) => set("email", e.target.value)}
        />
      </label>
      <label>
        Phone
        <input
          required
          inputMode="tel"
          autoComplete="tel"
          placeholder="09XXXXXXXXX"
          value={form.phone}
          onChange={(e) => set("phone", e.target.value)}
        />
        <span className="muted">We&apos;ll send a one-time SMS code to this number.</span>
      </label>
      <label>
        Messenger
        <input value={form.messenger} onChange={(e) => set("messenger", e.target.value)} />
      </label>
      <label>
        Address
        <input
          value={form.address}
          onChange={(e) => set("address", e.target.value)}
          placeholder="Barangay, city, province"
        />
        <span className="muted">Search or tap the map. Share a general area—not a house number.</span>
      </label>
      <MapPicker
        latName="address_lat"
        lngName="address_lng"
        searchPlaceholder="Search place (e.g. Arayat, Pampanga)"
        onLabel={(label) => setForm((f) => ({ ...f, address: label }))}
        onCoords={(lat, lng) => setForm((f) => ({ ...f, addressLat: lat, addressLng: lng }))}
      />
      <label>
        Password
        <div className="password-field">
          <input
            type={show ? "text" : "password"}
            required
            minLength={6}
            value={form.password}
            onChange={(e) => set("password", e.target.value)}
          />
          <button type="button" className="password-toggle" onClick={() => setShow((s) => !s)}>
            {show ? "Hide" : "Show"}
          </button>
        </div>
      </label>
      <label>
        Confirm password
        <input
          type={show ? "text" : "password"}
          required
          value={form.passwordConfirm}
          onChange={(e) => set("passwordConfirm", e.target.value)}
        />
      </label>
      <button className="btn btn-amber" type="submit" disabled={loading}>
        {loading ? "Sending code…" : "Continue"}
      </button>
    </form>
  );
}
