import Link from "next/link";

export default function HomePage() {
  return (
    <>
      <section className="hero">
        <div className="hero-media" aria-hidden="true" />
        <div className="hero-content">
          <h1 className="hero-brand">PawAlert</h1>
          <p className="hero-tagline">Instant networks for missing pets.</p>
          <div className="hero-actions">
            <Link href="/register" className="btn btn-amber">
              Protect your pet
            </Link>
            <Link href="/feed" className="btn btn-outline" style={{ borderColor: "#fff", color: "#fff" }}>
              Browse feed
            </Link>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>One network. Faster reunions.</h2>
          <p className="muted">
            Register your pet, print a smart QR tag, and tap into a community Found &amp; Missing feed
            when every minute counts.
          </p>
        </div>
        <div className="feature-row">
          <article className="feature">
            <h3>Smart QR tags</h3>
            <p>Each tag opens a live pet profile — update contact details anytime.</p>
          </article>
          <article className="feature">
            <h3>Missing toggle</h3>
            <p>Keep the profile quiet while safe. Flip to Missing when you need help fast.</p>
          </article>
          <article className="feature">
            <h3>Found &amp; Missing feed</h3>
            <p>Neighbors and owners meet in one place to reunite pets.</p>
          </article>
        </div>
      </section>
    </>
  );
}
