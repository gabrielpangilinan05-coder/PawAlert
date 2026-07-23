import { NextResponse } from "next/server";

type Bucket = { count: number; resetAt: number };

const store = new Map<string, Bucket>();

/** Best-effort in-memory limiter (per server instance). Fine for MVP / single region. */
export function rateLimit(
  key: string,
  opts: { limit: number; windowMs: number },
): { ok: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  let bucket = store.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + opts.windowMs };
    store.set(key, bucket);
  }
  bucket.count += 1;
  return {
    ok: bucket.count <= opts.limit,
    remaining: Math.max(0, opts.limit - bucket.count),
    resetAt: bucket.resetAt,
  };
}

export function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

export function tooManyRequests(resetAt: number, message = "Too many requests. Try again shortly.") {
  const retryAfter = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
  return NextResponse.json(
    { error: message, ok: false },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfter),
        "X-RateLimit-Reset": String(Math.ceil(resetAt / 1000)),
      },
    },
  );
}

export const LIMITS = {
  authLogin: { limit: 12, windowMs: 15 * 60 * 1000 },
  authRegister: { limit: 6, windowMs: 60 * 60 * 1000 },
  authVerify: { limit: 12, windowMs: 15 * 60 * 1000 },
  authForgot: { limit: 5, windowMs: 60 * 60 * 1000 },
  authReset: { limit: 12, windowMs: 15 * 60 * 1000 },
  write: { limit: 40, windowMs: 60 * 1000 },
  create: { limit: 12, windowMs: 60 * 60 * 1000 },
  share: { limit: 20, windowMs: 60 * 1000 },
  report: { limit: 8, windowMs: 60 * 60 * 1000 },
} as const;
