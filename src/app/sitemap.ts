import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site-url";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = getSiteUrl();

  // Stable lastmod dates (content-oriented). Avoid "always now" on every deploy —
  // Google treats constant lastmod churn as low-signal.
  const pages: Array<{
    path: string;
    lastModified: string;
    changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
    priority: number;
  }> = [
    { path: "", lastModified: "2026-11-14", changeFrequency: "weekly", priority: 1 },
    { path: "/features", lastModified: "2026-11-14", changeFrequency: "weekly", priority: 0.9 },
    { path: "/download", lastModified: "2026-11-10", changeFrequency: "monthly", priority: 0.85 },
    { path: "/reviews", lastModified: "2026-11-16", changeFrequency: "daily", priority: 0.85 },
    { path: "/about", lastModified: "2026-11-01", changeFrequency: "monthly", priority: 0.8 },
    { path: "/faq", lastModified: "2026-11-14", changeFrequency: "weekly", priority: 0.8 },
    { path: "/community-guidelines", lastModified: "2026-11-01", changeFrequency: "monthly", priority: 0.55 },
    { path: "/terms", lastModified: "2026-11-01", changeFrequency: "monthly", priority: 0.5 },
    { path: "/privacy", lastModified: "2026-11-01", changeFrequency: "monthly", priority: 0.5 },
  ];

  return pages.map((page) => ({
    url: `${baseUrl}${page.path}`,
    lastModified: new Date(page.lastModified),
    changeFrequency: page.changeFrequency,
    priority: page.priority,
  }));
}
