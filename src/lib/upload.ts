import { randomBytes } from "crypto";
import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import { del, put } from "@vercel/blob";
import { uploadRoot } from "@/lib/paths";

const IMAGE_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

const VIDEO_EXT: Record<string, string> = {
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};

export function generateSlug(length = 10): string {
  return randomBytes(Math.ceil(length / 2))
    .toString("hex")
    .slice(0, length);
}

function useBlobStorage(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());
}

export function isRemoteMediaUrl(value: string | null | undefined): boolean {
  return Boolean(value && /^https?:\/\//i.test(value));
}

export type SavedMedia = { path: string; type: "image" | "video" };

export async function saveMediaFile(
  file: File | null | undefined,
  folder: string,
  mode: "image" | "media" = "media",
): Promise<SavedMedia | null> {
  if (!file || file.size === 0) return null;

  const allowed = mode === "image" ? IMAGE_EXT : { ...IMAGE_EXT, ...VIDEO_EXT };
  const mime = file.type;
  if (!allowed[mime]) {
    throw new Error(
      mode === "image"
        ? "Only JPG, PNG, WEBP, or GIF images are allowed."
        : "Only JPG/PNG/WEBP/GIF photos or MP4/WEBM/MOV videos are allowed.",
    );
  }

  const isVideo = Boolean(VIDEO_EXT[mime]);
  const maxBytes = isVideo ? 20 * 1024 * 1024 : 5 * 1024 * 1024;
  if (file.size > maxBytes) {
    throw new Error(isVideo ? "Video must be under 20MB." : "Image must be under 5MB.");
  }

  const name = `${generateSlug(16)}.${allowed[mime]}`;
  const key = `uploads/${folder}/${name}`;
  const buf = Buffer.from(await file.arrayBuffer());

  if (useBlobStorage()) {
    const blob = await put(key, buf, {
      access: "public",
      contentType: mime,
      addRandomSuffix: false,
    });
    return {
      path: blob.url,
      type: isVideo ? "video" : "image",
    };
  }

  const dir = path.join(uploadRoot(), folder);
  await mkdir(dir, { recursive: true });
  const dest = path.join(dir, name);
  await writeFile(dest, buf);

  return {
    path: key,
    type: isVideo ? "video" : "image",
  };
}

export async function saveMultipleMedia(
  files: File[],
  folder: string,
  maxFiles = 8,
): Promise<SavedMedia[]> {
  const saved: SavedMedia[] = [];
  for (const file of files) {
    if (!file || file.size === 0) continue;
    if (saved.length >= maxFiles) {
      throw new Error(`You can upload up to ${maxFiles} photos/videos.`);
    }
    const item = await saveMediaFile(file, folder, "media");
    if (item) saved.push(item);
  }
  return saved;
}

/** Delete a stored media path (Vercel Blob URL or local uploads/...). */
export async function deleteStoredMedia(filePath: string | null | undefined): Promise<void> {
  if (!filePath) return;

  if (isRemoteMediaUrl(filePath)) {
    try {
      await del(filePath);
    } catch {
      /* ignore missing / unauthorized */
    }
    return;
  }

  const rel = filePath.replace(/^\/+/, "").replace(/^uploads\//, "");
  if (!rel || rel.includes("..")) return;
  try {
    await unlink(path.join(uploadRoot(), rel));
  } catch {
    /* ignore missing file */
  }
}

export async function deleteStoredMediaMany(paths: Iterable<string>): Promise<void> {
  for (const p of paths) {
    await deleteStoredMedia(p);
  }
}

export function normalizeSpecies(raw: string): string {
  const t = raw.trim();
  if (!t) return "Other";
  const known = ["Dog", "Cat", "Bird", "Horse", "Rabbit", "Reptile", "Ferret", "Other"];
  const hit = known.find((k) => k.toLowerCase() === t.toLowerCase());
  return hit || t.slice(0, 80);
}

export function normalizeSex(raw: string): "male" | "female" | "unknown" {
  const t = raw.toLowerCase();
  if (t === "male" || t === "female") return t;
  return "unknown";
}

export function isAlertType(type: string): boolean {
  return type === "found" || type === "missing";
}

export function relativeTime(datetime: string | Date): string {
  const ts = typeof datetime === "string" ? Date.parse(datetime) : datetime.getTime();
  if (!Number.isFinite(ts)) return String(datetime);
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(ts).toLocaleDateString();
}

export function userInitial(name: string): string {
  const t = name.trim();
  return t ? t[0]!.toUpperCase() : "?";
}
