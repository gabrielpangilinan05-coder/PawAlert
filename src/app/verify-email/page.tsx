import { redirect } from "next/navigation";
import { VerifyForm } from "@/components/VerifyForm";
import { getSession } from "@/lib/session";
import { getCurrentUser } from "@/lib/auth";
import { maskPhone } from "@/lib/phone";

export const metadata = { title: "Verify phone" };

export default async function VerifyEmailPage() {
  if (await getCurrentUser()) redirect("/dashboard");
  const session = await getSession();
  if (!session.pendingRegister) redirect("/register");

  const phone = session.pendingRegister.phone;
  const phoneLabel = phone ? maskPhone(phone) : session.pendingRegister.email;

  return (
    <div className="page-wrap">
      <div className="panel">
        <h1>Verify your phone</h1>
        <p className="muted">
          Enter the 6-digit SMS code sent to <strong>{phoneLabel}</strong>.
        </p>
        <VerifyForm preview={session.devOtpPreview} />
      </div>
    </div>
  );
}
