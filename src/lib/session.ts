import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";

export type SessionData = {
  userId?: number;
  pendingRegister?: {
    name: string;
    email: string;
    phone: string | null;
    messenger: string | null;
    address: string | null;
    addressLat: number | null;
    addressLng: number | null;
    passwordHash: string;
  };
  devOtpPreview?: string;
  flash?: { type: "success" | "error"; message: string };
};

export const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET || "pawalert-dev-session-secret-change-me-32chars",
  cookieName: "pawalert_session",
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  },
};

export async function getSession() {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions);
}
