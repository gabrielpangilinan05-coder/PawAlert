"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function VerifyForm({ preview }: { preview?: string | null }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Verification failed");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="form-grid">
      {preview && (
        <div className="flash flash-success">
          Dev mode email OTP: <strong>{preview}</strong>
        </div>
      )}
      {error && <div className="flash flash-error">{error}</div>}
      <label>
        6-digit code
        <input
          inputMode="numeric"
          pattern="[0-9]{6}"
          maxLength={6}
          required
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
        />
      </label>
      <button className="btn btn-amber" type="submit" disabled={loading}>
        {loading ? "Verifying…" : "Create account"}
      </button>
    </form>
  );
}
