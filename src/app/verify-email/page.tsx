import { redirect } from "next/navigation";
import { VerifyForm } from "@/components/VerifyForm";
import { getSession } from "@/lib/session";
import { getCurrentUser } from "@/lib/auth";
import { maskEmail } from "@/lib/email";

export const metadata = { title: "Verify email" };

export default async function VerifyEmailPage() {
  if (await getCurrentUser()) redirect("/dashboard");
  const session = await getSession();
  if (!session.pendingRegister) redirect("/register");

  const emailLabel = maskEmail(session.pendingRegister.email);

  return (
    <div className="page-wrap">
      <div className="panel">
        <h1>Verify your email</h1>
        <p className="muted">
          Enter the 6-digit code sent to <strong>{emailLabel}</strong>.
        </p>
        <VerifyForm preview={session.devOtpPreview} />
      </div>
    </div>
  );
}
