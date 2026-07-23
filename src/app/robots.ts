import type { MetadataRoute } from "next";
import { appOrigin } from "@/lib/media";

/** Allow search + social preview crawlers (FB, X, Discord, Slack, etc.). */
export default function robots(): MetadataRoute.Robots {
  const origin = appOrigin();
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/auth/", "/dashboard", "/pets/", "/messages"],
      },
      {
        userAgent: [
          "facebookexternalhit",
          "Facebot",
          "FacebookBot",
          "Twitterbot",
          "LinkedInBot",
          "Discordbot",
          "Slackbot",
          "Slackbot-LinkExpanding",
          "TelegramBot",
          "WhatsApp",
          "Applebot",
          "bingbot",
          "Googlebot",
        ],
        allow: ["/", "/pet/", "/api/og/"],
      },
    ],
    host: origin.replace(/^https?:\/\//, ""),
  };
}
