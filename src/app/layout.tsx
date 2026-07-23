import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Figtree } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/SiteHeader";
import { PwaRegister } from "@/components/PwaRegister";
import { getCurrentUser } from "@/lib/auth";
import { unreadMessageCount } from "@/lib/messages";
import { appOrigin } from "@/lib/media";

const display = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-display-next",
  display: "swap",
  preload: true,
});

const body = Figtree({
  subsets: ["latin"],
  variable: "--font-body-next",
  display: "swap",
  preload: true,
});

export const metadata: Metadata = {
  metadataBase: new URL(appOrigin()),
  title: {
    default: "PawAlert",
    template: "%s · PawAlert",
  },
  description:
    "Instant networks for missing pets. Free QR tags, Found & Missing alerts, and a local community feed.",
  applicationName: "PawAlert",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "PawAlert",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#2f6b4f" },
    { media: "(prefers-color-scheme: dark)", color: "#1e4a36" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getCurrentUser();
  const unreadMessages = user ? await unreadMessageCount(user.id) : 0;

  return (
    <html lang="en" className={`${display.variable} ${body.variable} h-full`}>
      <body className="min-h-full flex flex-col antialiased">
        <PwaRegister />
        <SiteHeader user={user} initialUnreadMessages={unreadMessages} />
        <main className="flex-1">{children}</main>
        <footer className="site-footer">
          PawAlert — instant networks for missing pets.
        </footer>
      </body>
    </html>
  );
}
