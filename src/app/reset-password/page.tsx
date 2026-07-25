import Link from "next/link";
import { redirect } from "next/navigation";
import { ResetPasswordForm } from "@/components/ResetPasswordForm";
import { getCurrentUser } from "@/lib/auth";
import { getSession } from "@/lib/session";
import { maskEmail } from "@/lib/email";

export const metadata = { title: "Reset password" };

export default async function ResetPasswordPage() {
  if (await getCurrentUser()) redirect("/profile");
  const session = await getSession();

  if (!session.pendingReset) {
    return (
      <div className="page-wrap">
        <div className="panel">
          <h1>Check your email</h1>
          <p className="muted">
            If that email is registered, we sent a 6-digit code. You can request another code
            anytime.
          </p>
          <p className="muted" style={{ marginTop: "1rem" }}>
            <Link href="/forgot-password">Request a code</Link>
            {" · "}
            <Link href="/login">Log in</Link>
          </p>
        </div>
      </div>
    );
  }

  const emailLabel = maskEmail(session.pendingReset.email);

  return (
    <div className="page-wrap">
      <div className="panel">
        <h1>Reset password</h1>
        <p className="muted">
          Enter the 6-digit code sent to <strong>{emailLabel}</strong>, then choose a new
          password.
        </p>
        <ResetPasswordForm preview={session.devOtpPreview} />
        <p className="muted" style={{ marginTop: "1rem" }}>
          Need a new code? <Link href="/forgot-password">Request again</Link>
        </p>
      </div>
    </div>
  );
}
