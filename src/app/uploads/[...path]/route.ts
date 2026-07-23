import { NextResponse } from "next/server";
import { createReadStream, existsSync, statSync } from "fs";
import path from "path";
import { Readable } from "stream";
import { uploadRoot } from "@/lib/paths";

type Ctx = { params: Promise<{ path: string[] }> };

const MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
};

export async function GET(_req: Request, ctx: Ctx) {
  const { path: parts } = await ctx.params;
  if (!parts?.length) {
    return new NextResponse("Not found", { status: 404 });
  }

  const safe = parts.map((p) => p.replace(/\\/g, "/")).filter((p) => p && p !== ".." && !p.includes(".."));
  const root = path.resolve(/*turbopackIgnore: true*/ uploadRoot());
  const abs = path.resolve(/*turbopackIgnore: true*/ root, ...safe);
  if (!abs.startsWith(root + path.sep) && abs !== root) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  if (!existsSync(abs) || !statSync(abs).isFile()) {
    return new NextResponse("Not found", { status: 404 });
  }

  const ext = path.extname(abs).toLowerCase();
  const type = MIME[ext] || "application/octet-stream";
  const stream = createReadStream(abs);
  const webStream = Readable.toWeb(stream) as unknown as ReadableStream;

  return new NextResponse(webStream, {
    headers: {
      "Content-Type": type,
      "Cache-Control": "public, max-age=86400",
    },
  });
}
