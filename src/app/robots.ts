import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getSiteUrl();

  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/",
          "/features",
          "/about",
          "/reviews",
          "/faq",
          "/community-guidelines",
          "/privacy",
          "/terms",
          "/manifest.webmanifest",
          "/logo.png",
          "/icons/",
        ],
        disallow: [
          "/app/",
          "/admin/",
          "/api/",
          "/auth/",
          "/onboarding/",
        ],
      },
      {
        userAgent: "Googlebot",
        allow: [
          "/",
          "/features",
          "/about",
          "/reviews",
          "/faq",
          "/community-guidelines",
          "/privacy",
          "/terms",
          "/manifest.webmanifest",
          "/logo.png",
          "/icons/",
        ],
        disallow: [
          "/app/",
          "/admin/",
          "/api/",
          "/auth/",
          "/onboarding/",
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
