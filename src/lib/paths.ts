import path from "path";

/** Local uploads directory inside the Next.js project. */
export function uploadRoot(): string {
  if (process.env.UPLOAD_ROOT) return process.env.UPLOAD_ROOT;
  return path.join(process.cwd(), "uploads");
}
