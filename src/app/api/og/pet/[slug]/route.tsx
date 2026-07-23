import { renderPetOgImage } from "@/lib/og-image";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ slug: string }> };

/** Fresh OG image URL — used as og:image / twitter:image for share cards. */
export async function GET(req: Request, ctx: Ctx) {
  const { slug } = await ctx.params;
  const image = await renderPetOgImage(slug);

  const headers = new Headers(image.headers);
  headers.set("Cache-Control", "public, max-age=0, must-revalidate");
  headers.set("Content-Type", "image/png");
  void req.url;

  return new Response(image.body, { status: 200, headers });
}
