import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { getCurrentUser } from "@/lib/auth";
import { getOwnedPet } from "@/lib/pets";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, ctx: Ctx) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "login_required" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const pet = await getOwnedPet(Number(id), user.id);
  if (!pet) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const base =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    new URL(req.url).origin;
  const url = `${base}/pet/${encodeURIComponent(String(pet.public_slug))}`;
  const png = await QRCode.toBuffer(url, {
    type: "png",
    width: 512,
    margin: 2,
    errorCorrectionLevel: "M",
  });

  return new NextResponse(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `attachment; filename="pawalert-${pet.public_slug}.png"`,
      "Cache-Control": "no-store",
    },
  });
}
