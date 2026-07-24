import Link from "next/link";
import { redirect } from "next/navigation";
import { RegisterForm } from "@/components/RegisterForm";
import { getCurrentUser } from "@/lib/auth";

export const metadata = { title: "Register" };

export default async function RegisterPage() {
  if (await getCurrentUser()) redirect("/dashboard");

  return (
    <div className="page-wrap">
      <div className="panel" style={{ maxWidth: 520 }}>
        <h1>Create your account</h1>
        <p className="muted">
          We&apos;ll confirm your email with a one-time code before the account is created.
        </p>
        <RegisterForm />
        <p className="muted" style={{ marginTop: "1rem" }}>
          Already registered? <Link href="/login">Log in</Link>
        </p>
      </div>
    </div>
  );
}
