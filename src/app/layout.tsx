import type { Metadata } from "next";
import { Bricolage_Grotesque, Figtree } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/SiteHeader";
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
        <SiteHeader user={user} initialUnreadMessages={unreadMessages} />
        <main className="flex-1">{children}</main>
        <footer className="site-footer">
          PawAlert — instant networks for missing pets.
        </footer>
      </body>
    </html>
  );
}
