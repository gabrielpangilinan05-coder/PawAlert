import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  markMessagesRead,
  sendMessage,
  threadMessages,
  unreadMessageCount,
} from "@/lib/messages";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "login_required" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const withId = Number(searchParams.get("with") || 0);
  const after = Number(searchParams.get("after") || 0);

  if (!withId || withId === user.id) {
    return NextResponse.json({ ok: false, error: "invalid_partner" }, { status: 400 });
  }

  await markMessagesRead(user.id, withId);
  const messages = await threadMessages(user.id, withId, after);
  const unread = await unreadMessageCount(user.id);

  return NextResponse.json({ ok: true, messages, unread });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "login_required" }, { status: 401 });
  }

  const form = await req.formData().catch(() => null);
  const bodyJson = form ? null : await req.json().catch(() => ({}));

  const to = Number(form?.get("to") ?? bodyJson?.to ?? 0);
  const text = String(form?.get("body") ?? bodyJson?.body ?? "").trim();

  try {
    const message = await sendMessage(user.id, to, text);
    return NextResponse.json({ ok: true, message });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "send_failed" },
      { status: 400 },
    );
  }
}
