import { NextResponse } from "next/server";

const UA = "PawAlert-Next/1.0 (local pet reunions)";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();
  const lat = Number(searchParams.get("lat"));
  const lng = Number(searchParams.get("lng"));

  try {
    let url: string;
    if (q) {
      url =
        "https://nominatim.openstreetmap.org/search?" +
        new URLSearchParams({
          q,
          format: "json",
          addressdetails: "1",
          limit: "6",
          countrycodes: "ph",
        }).toString();
    } else if (Number.isFinite(lat) && Number.isFinite(lng)) {
      url =
        "https://nominatim.openstreetmap.org/reverse?" +
        new URLSearchParams({
          lat: String(lat),
          lon: String(lng),
          format: "json",
          addressdetails: "1",
        }).toString();
    } else {
      return NextResponse.json({ ok: false, error: "missing_query" }, { status: 400 });
    }

    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      next: { revalidate: 0 },
    });
    if (!res.ok) {
      return NextResponse.json({ ok: false, error: "geocode_failed" }, { status: 502 });
    }
    const data = await res.json();

    const results: { label: string; lat: number | null; lng: number | null }[] = [];
    if (q) {
      for (const row of Array.isArray(data) ? data : []) {
        results.push({
          label: String(row.display_name || ""),
          lat: row.lat != null ? Number(row.lat) : null,
          lng: row.lon != null ? Number(row.lon) : null,
        });
      }
    } else {
      results.push({
        label: String(data.display_name || ""),
        lat,
        lng,
      });
    }

    return NextResponse.json({ ok: true, results });
  } catch {
    return NextResponse.json({ ok: false, error: "geocode_failed" }, { status: 502 });
  }
}
