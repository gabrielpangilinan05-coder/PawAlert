import Link from "next/link";
import { BodyClass } from "@/components/BodyClass";
import { getCurrentUser } from "@/lib/auth";

export const metadata = { title: "How it Works" };

export default async function HowItWorksPage() {
  const user = await getCurrentUser();

  return (
    <>
      <BodyClass name="how-page" />
      <div className="page-wrap how-wrap">
        <div className="how-intro">
          <h1 className="page-title">How it Works</h1>
          <p className="muted">
            Three steps to protect your pet and help neighbors reunite faster.
          </p>
        </div>

        <ol className="how-steps">
          <li className="how-step">
            <span className="how-step-num">1</span>
            <div>
              <h2>Register your pet</h2>
              <p>
                Add your pet’s photo, species, breed, and medical notes. PawAlert creates a unique
                public profile.
              </p>
            </div>
          </li>
          <li className="how-step">
            <span className="how-step-num">2</span>
            <div>
              <h2>Print a smart QR tag</h2>
              <p>
                Download the QR from Manage Pet. Finders can use their phone Camera app, or open
                PawAlert and tap <strong>Scan QR</strong> to open the live pet profile.
              </p>
            </div>
          </li>
          <li className="how-step">
            <span className="how-step-num">3</span>
            <div>
              <h2>Use Lost &amp; Found alerts</h2>
              <p>
                Mark a pet Missing from your dashboard, or post Found / Missing alerts on the
                community feed so neighbors can help.
              </p>
            </div>
          </li>
        </ol>

        <div className="how-actions">
          {user ? (
            <>
              <Link className="btn btn-amber" href="/pets/new">
                Add a pet
              </Link>
              <Link className="btn btn-outline" href="/feed?type=missing">
                Browse lost pets
              </Link>
              <Link className="btn btn-outline" href="/feed?type=found">
                Browse found pets
              </Link>
            </>
          ) : (
            <>
              <Link className="btn btn-amber" href="/register">
                Get started
              </Link>
              <Link className="btn btn-outline" href="/feed">
                Browse the feed
              </Link>
            </>
          )}
        </div>
      </div>
    </>
  );
}
