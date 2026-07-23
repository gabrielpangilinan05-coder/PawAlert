import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { mediaUrl } from "@/lib/auth";
import { getPool } from "@/lib/db";
import { requestOrigin } from "@/lib/media";
import { buildPetOgDescription, formatDisplayDatetime, truncateText } from "@/lib/og-pet";
import { getPetByPublicSlug } from "@/lib/pets-public";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const pet = await getPetByPublicSlug(slug);
  if (!pet) return { title: "Pet" };

  const name = String(pet.name);
  const status = String(pet.status);
  const description = buildPetOgDescription(pet);
  // Put key place in title so Facebook card shows something even when description is hidden
  const place =
    status === "missing" && pet.last_seen_text
      ? truncateText(String(pet.last_seen_text).split(",")[0] || String(pet.last_seen_text), 40)
      : "";
  const title =
    status === "missing"
      ? place
        ? `${name} is missing · ${place}`
        : `${name} is missing`
      : `${name} · PawAlert`;

  const origin = await requestOrigin();
  const url = `${origin}/pet/${slug}`;
  // New path + bust from pet update — Facebook cannot reuse old /opengraph-image cache
  const bust = new Date(String(pet.updated_at || pet.last_seen_at || Date.now())).getTime() || Date.now();
  const image = `${origin}/api/og/pet/${encodeURIComponent(slug)}?v=${bust}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      type: "website",
      siteName: "PawAlert",
      images: [{ url: image, secureUrl: image, width: 1200, height: 630, alt: description }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

function formatWhen(iso: unknown): string | null {
  return formatDisplayDatetime(iso);
}

function sexLabel(sex: unknown): string {
  const s = String(sex || "unknown");
  if (s === "male") return "Male";
  if (s === "female") return "Female";
  return "Unknown";
}

export default async function PetPublicPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const pet = await getPetByPublicSlug(slug);
  if (!pet) notFound();

  const pool = getPool();
  const [mediaRows] = await pool.query(
    `SELECT id, file_path, media_type FROM pet_media WHERE pet_id = ? ORDER BY sort_order ASC, id ASC`,
    [pet.id],
  );
  const media = mediaRows as { id: number; file_path: string; media_type: string }[];

  const photo = mediaUrl(pet.photo_path as string | null) || "/og-default.png";
  const lastSeenMedia = mediaUrl(pet.last_seen_media_path as string | null);
  const isMissing = String(pet.status) === "missing";
  const when = formatWhen(pet.last_seen_at);

  const showPhone = Number(pet.show_phone) === 1;
  const showEmail = Number(pet.show_email) === 1;
  const showMessenger = Number(pet.show_messenger) === 1;
  const showAddress = Number(pet.show_address) === 1;

  const ownerName = pet.owner_name ? String(pet.owner_name) : null;
  const ownerPhone = showPhone && pet.owner_phone ? String(pet.owner_phone) : null;
  const ownerEmail = showEmail && pet.owner_email ? String(pet.owner_email) : null;
  const ownerMessenger =
    showMessenger && pet.owner_messenger ? String(pet.owner_messenger) : null;
  const ownerAddress =
    showAddress && pet.owner_address ? String(pet.owner_address) : null;

  const hasContact = Boolean(ownerName || ownerPhone || ownerEmail || ownerMessenger || ownerAddress);

  return (
    <div className="page-wrap alert-detail">
      <div className="alert-hero">
        <div className="alert-photo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo} alt={String(pet.name)} />
        </div>
        <div className="alert-hero-copy">
          <span className={`badge badge-${isMissing ? "missing" : "safe"}`}>
            {String(pet.status).toUpperCase()}
          </span>
          <h1 className="alert-name">{String(pet.name)}</h1>
          <p className="muted alert-kind">
            {String(pet.species)}
            {pet.breed ? ` · ${String(pet.breed)}` : ""}
            {` · ${sexLabel(pet.sex)}`}
          </p>
          {isMissing ? (
            <p className="alert-urgent">This pet is missing. Please contact the owner if you have information.</p>
          ) : (
            <p className="muted">This pet is marked safe on PawAlert.</p>
          )}
        </div>
      </div>

      {isMissing ? (
        <section className="alert-card alert-card--missing">
          <h2>Last seen</h2>
          <div className="alert-missing-lines">
            {pet.last_seen_text ? (
              <p>
                <strong>Last seen:</strong> {String(pet.last_seen_text)}
              </p>
            ) : null}
            {pet.last_seen_notes ? (
              <p>
                <strong>Details:</strong> {String(pet.last_seen_notes)}
              </p>
            ) : null}
            {when ? (
              <p>
                <strong>Date &amp; time:</strong> {when}
              </p>
            ) : null}
            {pet.last_seen_lat != null && pet.last_seen_lng != null ? (
              <p>
                <strong>Map:</strong>{" "}
                <a
                  href={`https://www.openstreetmap.org/?mlat=${pet.last_seen_lat}&mlon=${pet.last_seen_lng}#map=16/${pet.last_seen_lat}/${pet.last_seen_lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open pin
                </a>
              </p>
            ) : null}
          </div>
          {lastSeenMedia ? (
            <div className="alert-sighting-media">
              {pet.last_seen_media_type === "video" ? (
                <video src={lastSeenMedia} controls playsInline />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={lastSeenMedia} alt="Last seen media" />
              )}
            </div>
          ) : null}
          {!pet.last_seen_text && !when && !pet.last_seen_notes && !lastSeenMedia ? (
            <p className="muted">No last-seen details have been added yet.</p>
          ) : null}
        </section>
      ) : null}

      <section className="alert-card">
        <h2>About this pet</h2>
        <dl className="alert-dl">
          <div>
            <dt>Name</dt>
            <dd>{String(pet.name)}</dd>
          </div>
          <div>
            <dt>Species</dt>
            <dd>{String(pet.species)}</dd>
          </div>
          {pet.breed ? (
            <div>
              <dt>Breed</dt>
              <dd>{String(pet.breed)}</dd>
            </div>
          ) : null}
          <div>
            <dt>Sex</dt>
            <dd>{sexLabel(pet.sex)}</dd>
          </div>
          {pet.medical_notes ? (
            <div>
              <dt>Medical / notes</dt>
              <dd>{String(pet.medical_notes)}</dd>
            </div>
          ) : null}
        </dl>
      </section>

      {hasContact ? (
        <section className="alert-card">
          <h2>Contact owner</h2>
          <dl className="alert-dl">
            {ownerName ? (
              <div>
                <dt>Owner</dt>
                <dd>{ownerName}</dd>
              </div>
            ) : null}
            {ownerPhone ? (
              <div>
                <dt>Phone</dt>
                <dd>
                  <a href={`tel:${ownerPhone}`}>{ownerPhone}</a>
                </dd>
              </div>
            ) : null}
            {ownerEmail ? (
              <div>
                <dt>Email</dt>
                <dd>
                  <a href={`mailto:${ownerEmail}`}>{ownerEmail}</a>
                </dd>
              </div>
            ) : null}
            {ownerMessenger ? (
              <div>
                <dt>Messenger</dt>
                <dd>
                  <a
                    href={`https://m.me/${encodeURIComponent(ownerMessenger)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {ownerMessenger}
                  </a>
                </dd>
              </div>
            ) : null}
            {ownerAddress ? (
              <div>
                <dt>Home area</dt>
                <dd>{ownerAddress}</dd>
              </div>
            ) : null}
          </dl>
          <div className="alert-contact-actions">
            {ownerPhone ? (
              <a className="btn btn-amber" href={`tel:${ownerPhone}`}>
                Call owner
              </a>
            ) : null}
            {ownerEmail ? (
              <a className="btn btn-outline" href={`mailto:${ownerEmail}`}>
                Email
              </a>
            ) : null}
            {ownerMessenger ? (
              <a
                className="btn btn-outline"
                href={`https://m.me/${encodeURIComponent(ownerMessenger)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Messenger
              </a>
            ) : null}
          </div>
        </section>
      ) : (
        <section className="alert-card">
          <h2>Contact owner</h2>
          <p className="muted">The owner has not shared public contact details for this profile.</p>
        </section>
      )}

      {media.length > 0 ? (
        <section className="alert-card">
          <h2>Photos &amp; videos</h2>
          <div className="media-grid media-tiles alert-media-grid">
            {media.map((m) => {
              const src = mediaUrl(m.file_path) || undefined;
              return (
                <div key={m.id} className="media-tile">
                  {m.media_type === "video" ? (
                    <video src={src} controls playsInline preload="metadata" />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={src} alt="" />
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}
