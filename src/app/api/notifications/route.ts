import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { unreadMessageCount } from "@/lib/messages";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  unreadNotificationCount,
} from "@/lib/notifications";

/** List + unread counts for the notification center. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({
      ok: true,
      unread: 0,
      messages: 0,
      items: [],
    });
  }

  const [items, unread, messages] = await Promise.all([
    listNotifications(user.id, 30),
    unreadNotificationCount(user.id),
    unreadMessageCount(user.id),
  ]);

  return NextResponse.json({ ok: true, unread, messages, items });
}

/** Mark one or all notifications as read. */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "login_required" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "read");

  if (action === "read_all") {
    await markAllNotificationsRead(user.id);
    return NextResponse.json({ ok: true });
  }

  const id = Number(body.id || 0);
  if (!id) {
    return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });
  }
  await markNotificationRead(user.id, id);
  return NextResponse.json({ ok: true });
}
