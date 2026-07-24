"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ResetPasswordForm({ preview }: { preview?: string | null }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, password, passwordConfirm }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Reset failed");
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
      {preview ? (
        <div className="flash flash-success">
          Dev mode email OTP: <strong>{preview}</strong>
        </div>
      ) : null}
      {error ? <div className="flash flash-error">{error}</div> : null}
      <label>
        6-digit code
        <input
          inputMode="numeric"
          pattern="[0-9]{6}"
          maxLength={6}
          required
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          autoComplete="one-time-code"
        />
      </label>
      <label>
        New password
        <div className="password-field">
          <input
            type={show ? "text" : "password"}
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
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
          minLength={6}
          value={passwordConfirm}
          onChange={(e) => setPasswordConfirm(e.target.value)}
          autoComplete="new-password"
        />
      </label>
      <button className="btn btn-amber" type="submit" disabled={loading}>
        {loading ? "Updating…" : "Update password"}
      </button>
    </form>
  );
}
