import Link from "next/link";
import { PetLookupForm } from "@/components/PetLookupForm";

export const metadata = {
  title: "Find a pet",
  description: "Scan a PawAlert collar QR or paste a pet profile link.",
};

export default function PetIndexPage() {
  return (
    <div className="page-wrap">
      <div className="panel pet-fallback">
        <p className="eyebrow">Pet profiles</p>
        <h1>Scan a collar tag</h1>
        <p className="muted">
          Pet pages need a full link like <code>/pet/your-slug</code>. Opening{" "}
          <code>/pet</code> alone can’t show a specific animal — scan the QR on the tag, or paste
          the profile URL below.
        </p>
        <PetLookupForm />
        <p className="muted" style={{ marginTop: "1.25rem" }}>
          <Link href="/">Home</Link>
          {" · "}
          <Link href="/feed">Alert feed</Link>
          {" · "}
          <Link href="/how-it-works">How it works</Link>
        </p>
      </div>
    </div>
  );
}
