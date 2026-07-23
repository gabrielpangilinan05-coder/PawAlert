import { readFile } from "fs/promises";
import path from "path";
import { ImageResponse } from "next/og";
import { buildPetOgImageLines } from "@/lib/og-pet";
import { getPetByPublicSlug, petPhotoFile } from "@/lib/pets-public";

function mimeFor(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  return "image/jpeg";
}

function mimeFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    if (pathname.endsWith(".png")) return "image/png";
    if (pathname.endsWith(".webp")) return "image/webp";
    if (pathname.endsWith(".gif")) return "image/gif";
  } catch {
    /* ignore */
  }
  return "image/jpeg";
}

/** Prefer last-seen photo for missing alerts (same as feed), else profile photo. */
export function resolvePetOgPhotoPath(pet: Record<string, unknown> | null): string | null {
  if (!pet) return null;
  const status = String(pet.status || "");
  if (status === "missing" && pet.last_seen_media_type === "image" && pet.last_seen_media_path) {
    return String(pet.last_seen_media_path);
  }
  return pet.photo_path == null ? null : String(pet.photo_path);
}

async function loadOgPhotoDataUrl(photoPath: string | null): Promise<string | null> {
  if (!photoPath) return null;

  if (/^https?:\/\//i.test(photoPath)) {
    try {
      const res = await fetch(photoPath, { cache: "force-cache" });
      if (!res.ok) return null;
      const buf = Buffer.from(await res.arrayBuffer());
      const mime = res.headers.get("content-type") || mimeFromUrl(photoPath);
      return `data:${mime};base64,${buf.toString("base64")}`;
    } catch {
      return null;
    }
  }

  const file = petPhotoFile(photoPath);
  if (!file) return null;
  try {
    const buf = await readFile(file);
    return `data:${mimeFor(file)};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

/** Shared OG / Twitter card image — matches the rich preview (MISSING ALERT + photo + details). */
export async function renderPetOgImage(slug: string): Promise<ImageResponse> {
  const pet = await getPetByPublicSlug(slug);

  const name = pet ? String(pet.name) : "Pet";
  const status = pet ? String(pet.status) : "missing";
  const headline = status === "missing" ? `${name} is missing` : name;
  const detailLines = pet ? buildPetOgImageLines(pet) : ["PawAlert"];
  const badge = status === "missing" ? "MISSING ALERT" : "PAWALERT";

  const photoDataUrl = await loadOgPhotoDataUrl(resolvePetOgPhotoPath(pet));

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "#1a1510",
          color: "#fff8f0",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            width: "46%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#2a2118",
            overflow: "hidden",
          }}
        >
          {photoDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoDataUrl}
              alt=""
              width={552}
              height={630}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <div style={{ display: "flex", fontSize: 56, fontWeight: 700, color: "#e8a54b" }}>
              PawAlert
            </div>
          )}
        </div>
        <div
          style={{
            width: "54%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "44px 40px",
            gap: 12,
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 20,
              letterSpacing: 3,
              textTransform: "uppercase",
              color: status === "missing" ? "#ffb454" : "#7ddea0",
              fontWeight: 800,
            }}
          >
            {badge}
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 46,
              fontWeight: 800,
              lineHeight: 1.1,
              maxWidth: 580,
            }}
          >
            {headline}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
            {detailLines.slice(0, 4).map((line) => (
              <div
                key={line}
                style={{
                  display: "flex",
                  fontSize: 22,
                  lineHeight: 1.3,
                  color: "#e8dccb",
                  maxWidth: 580,
                }}
              >
                {line}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", marginTop: 16, fontSize: 18, color: "#a89888" }}>
            pawalert · help bring them home
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
