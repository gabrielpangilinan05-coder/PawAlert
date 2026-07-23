import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPool } from "@/lib/db";
import { mediaUrl, requestOrigin } from "@/lib/media";
import { buildPetOgDescription, formatDisplayDatetime, truncateText } from "@/lib/og-pet";
import { getPetByPublicSlug } from "@/lib/pets-public";
import { PetQrScanButton } from "@/components/PetQrScanButton";
import { PetPublicMedia } from "@/components/PetPublicMedia";

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
  const mapHref =
    pet.last_seen_lat != null && pet.last_seen_lng != null
      ? `https://www.openstreetmap.org/?mlat=${pet.last_seen_lat}&mlon=${pet.last_seen_lng}#map=16/${pet.last_seen_lat}/${pet.last_seen_lng}`
      : null;

  const hasStickyContact = Boolean(ownerPhone || ownerEmail || ownerMessenger);

  return (
    <div className={`page-wrap pp${hasStickyContact ? " pp--sticky" : ""}`}>
      <article className="pp-stage">
        <PetPublicMedia
          petName={String(pet.name)}
          coverSrc={photo}
          statusLabel={isMissing ? "LOST" : "SAFE"}
          statusClass={isMissing ? "missing" : "safe"}
          media={media}
          lastSeenSrc={lastSeenMedia}
          lastSeenType={
            pet.last_seen_media_type ? String(pet.last_seen_media_type) : null
          }
        />

        <div className="pp-panel">
          <p className="pp-kicker">PawAlert profile</p>
          <h1 className="pp-name">{String(pet.name)}</h1>
          <p className="pp-kind">
            {String(pet.species)}
            {pet.breed ? ` · ${String(pet.breed)}` : ""}
            {` · ${sexLabel(pet.sex)}`}
          </p>

          {isMissing ? (
            <p className="pp-banner pp-banner--missing">
              Missing — contact the owner if you have information.
            </p>
          ) : (
            <p className="pp-banner pp-banner--safe">This pet is marked safe.</p>
          )}

          {isMissing && (pet.last_seen_text || when || pet.last_seen_notes || mapHref) ? (
            <section className="pp-block">
              <h2>Last seen</h2>
              <ul className="pp-list">
                {pet.last_seen_text ? <li>{String(pet.last_seen_text)}</li> : null}
                {when ? <li>{when}</li> : null}
                {pet.last_seen_notes ? <li>{String(pet.last_seen_notes)}</li> : null}
                {mapHref ? (
                  <li>
                    <a href={mapHref} target="_blank" rel="noopener noreferrer">
                      Open map pin
                    </a>
                  </li>
                ) : null}
              </ul>
              {lastSeenMedia ? (
                <div className="pp-sighting">
                  {pet.last_seen_media_type === "video" ? (
                    <video src={lastSeenMedia} controls playsInline />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={lastSeenMedia} alt="Last seen" />
                  )}
                </div>
              ) : null}
            </section>
          ) : null}

          {pet.medical_notes ? (
            <section className="pp-block">
              <h2>Medical notes</h2>
              <p className="pp-notes">{String(pet.medical_notes)}</p>
            </section>
          ) : null}

          <section className="pp-block">
            <h2>Contact</h2>
            {hasContact ? (
              <>
                <ul className="pp-list">
                  {ownerName ? <li>Owner: {ownerName}</li> : null}
                  {ownerAddress ? <li>Area: {ownerAddress}</li> : null}
                </ul>
                <div className="pp-actions">
                  {ownerPhone ? (
                    <a className="btn btn-amber" href={`tel:${ownerPhone}`}>
                      Call
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
                  {ownerEmail ? (
                    <a className="btn btn-outline" href={`mailto:${ownerEmail}`}>
                      Email
                    </a>
                  ) : null}
                </div>
              </>
            ) : (
              <p className="muted pp-notes">No public contact details yet.</p>
            )}
          </section>

          <div className="pp-scan-row">
            <p className="muted">Found another collar tag?</p>
            <PetQrScanButton className="btn btn-outline btn-sm" />
          </div>
        </div>
      </article>

      {hasStickyContact ? (
        <div className="pp-sticky" aria-label="Quick contact">
          {ownerPhone ? (
            <a className="btn btn-amber" href={`tel:${ownerPhone}`}>
              Call owner
            </a>
          ) : null}
          {ownerMessenger ? (
            <a
              className="btn btn-outline"
              href={`https://m.me/${encodeURIComponent(ownerMessenger)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Message
            </a>
          ) : ownerEmail ? (
            <a className="btn btn-outline" href={`mailto:${ownerEmail}`}>
              Email
            </a>
          ) : null}
          <PetQrScanButton className="btn btn-outline" />
        </div>
      ) : null}
    </div>
  );
}
