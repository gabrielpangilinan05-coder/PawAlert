import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/LoginForm";
import { getCurrentUser } from "@/lib/auth";

export const metadata = { title: "Log in" };

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/dashboard");

  return (
    <div className="page-wrap">
      <div className="panel">
        <h1>Welcome back</h1>
        <p className="muted">Manage pets, QR tags, and Missing alerts.</p>
        <LoginForm />
        <p className="muted" style={{ marginTop: "1rem" }}>
          New here? <Link href="/register">Create account</Link>
        </p>
      </div>
    </div>
  );
}
