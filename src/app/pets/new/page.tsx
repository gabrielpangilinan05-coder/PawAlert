import { redirect } from "next/navigation";
import { AddPetForm } from "@/components/AddPetForm";
import { getCurrentUser } from "@/lib/auth";

export const metadata = { title: "Add pet" };

export default async function AddPetPage() {
  if (!(await getCurrentUser())) redirect("/login");

  return (
    <div className="page-wrap">
      <div className="panel" style={{ maxWidth: 640 }}>
        <h1 style={{ fontFamily: "var(--font-display)", marginTop: 0 }}>Register a pet</h1>
        <p className="muted">We’ll generate a unique QR link for this pet’s public profile.</p>
        <AddPetForm />
      </div>
    </div>
  );
}
