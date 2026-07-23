import Link from "next/link";
import { redirect } from "next/navigation";
import { ForgotPasswordForm } from "@/components/ForgotPasswordForm";
import { getCurrentUser } from "@/lib/auth";

export const metadata = { title: "Forgot password" };

export default async function ForgotPasswordPage() {
  if (await getCurrentUser()) redirect("/dashboard");

  return (
    <div className="page-wrap">
      <div className="panel">
        <h1>Forgot password</h1>
        <p className="muted">Enter your account email and we’ll text a reset code to your phone.</p>
        <ForgotPasswordForm />
        <p className="muted" style={{ marginTop: "1rem" }}>
          Remembered it? <Link href="/login">Log in</Link>
        </p>
      </div>
    </div>
  );
}
