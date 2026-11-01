/**
 * Resolves the canonical public base URL of the site across environments
 * (Vercel production, custom domain, Vercel preview, local dev).
 */
export function getSiteUrl(): string {
  // 1. Check explicitly configured site URL
  const configured =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (configured && !configured.includes("your-app.vercel.app")) {
    const trimmed = configured.replace(/\/+$/, "");
    return trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
  }

  // 2. Vercel deployment variables
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL.replace(/\/+$/, "")}`;
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL.replace(/\/+$/, "")}`;
  }

  // 3. Fallback based on NODE_ENV
  if (process.env.NODE_ENV === "production") {
    return "https://studystation.vercel.app";
  }

  return "http://localhost:3000";
}
