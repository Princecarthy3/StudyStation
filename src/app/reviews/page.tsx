import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Star } from "lucide-react";
import { Brand } from "@/components/brand";
import { ForceLightTheme } from "@/components/force-light-theme";
import { ReviewsGrid } from "@/components/review-section";
import { createClient } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/site-url";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Student Reviews",
  description:
    "Read real StudyStation reviews from university students using AI lecture notes, flashcards, quizzes, and study groups.",
  alternates: { canonical: "/reviews" },
  robots: { index: true, follow: true },
  openGraph: {
    title: "Student Reviews · StudyStation",
    description:
      "Real feedback from students using StudyStation for lectures, notes, and revision.",
    url: "/reviews",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Student Reviews · StudyStation",
    description:
      "Real feedback from students using StudyStation for lectures, notes, and revision.",
  },
};

type StudentReview = {
  id: string;
  display_name: string;
  university?: string | null;
  rating: number;
  review: string;
  created_at: string;
};

async function loadReviews(): Promise<StudentReview[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("student_reviews")
      .select("id, display_name, university, rating, review, created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    if (!error && data) return data as StudentReview[];

    const fallback = await supabase
      .from("student_reviews")
      .select("id, display_name, rating, review, created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    if (!fallback.error && fallback.data) {
      return fallback.data.map((row) => ({ ...row, university: null })) as StudentReview[];
    }
  } catch {
    /* empty */
  }
  return [];
}

export default async function ReviewsPage() {
  const reviews = await loadReviews();
  const siteUrl = getSiteUrl();
  const average =
    reviews.length > 0
      ? Math.round((reviews.reduce((sum, item) => sum + item.rating, 0) / reviews.length) * 10) / 10
      : 0;

  const schema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "StudyStation student reviews",
    description:
      "Student reviews of StudyStation lecture notes, quizzes, flashcards, and study tools.",
    url: `${siteUrl}/reviews`,
    isPartOf: { "@type": "WebSite", name: "StudyStation", url: siteUrl },
    ...(reviews.length
      ? {
          mainEntity: {
            "@type": "Product",
            name: "StudyStation",
            aggregateRating: {
              "@type": "AggregateRating",
              ratingValue: String(average || 5),
              reviewCount: String(reviews.length),
              bestRating: "5",
              worstRating: "1",
            },
            review: reviews.slice(0, 20).map((item) => ({
              "@type": "Review",
              author: { "@type": "Person", name: item.display_name },
              datePublished: item.created_at,
              reviewBody: item.review,
              reviewRating: {
                "@type": "Rating",
                ratingValue: String(item.rating),
                bestRating: "5",
                worstRating: "1",
              },
            })),
          },
        }
      : {}),
  };

  return (
    <main className="min-h-screen bg-[#fbfaff] text-[#17132d]">
      <ForceLightTheme />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
      <header className="border-b border-[#ebe8f3] bg-white/90">
        <div className="mx-auto flex h-16 max-w-[1140px] items-center justify-between px-5">
          <Brand />
          <Link
            href="/#students"
            className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-[#676276] hover:bg-[#f5f2fb] hover:text-[#7259e8]"
          >
            <ArrowLeft className="size-3.5" /> Back to home
          </Link>
        </div>
      </header>

      <section className="px-5 py-14 sm:py-20">
        <div className="mx-auto max-w-[1140px]">
          <div className="mx-auto max-w-2xl text-center">
            <div className="flex justify-center gap-1 text-[#f5a623]" aria-hidden>
              {Array.from({ length: 5 }, (_, index) => (
                <Star key={index} className="size-5 fill-current" />
              ))}
            </div>
            <p className="mt-4 text-[11px] font-black uppercase tracking-[.16em] text-[#7259e8]">
              Student voices
            </p>
            <h1 className="mt-2 text-balance text-[34px] font-black tracking-[-1.6px] sm:text-[44px]">
              All StudyStation reviews
            </h1>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-[#6c667a]">
              Feedback from signed-in university students using StudyStation for lecture capture,
              AI notes, flashcards, quizzes, and study groups.
              {reviews.length > 0
                ? ` ${reviews.length} published review${reviews.length === 1 ? "" : "s"}${average ? ` · average ${average}/5` : ""}.`
                : " Be the first to share how StudyStation supports your semester."}
            </p>
          </div>

          <div className="mt-12">
            {reviews.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#e3deeb] bg-white p-8 text-center text-sm text-[#8a8494]">
                No public reviews yet. Sign in to leave the first one from your study space.
              </div>
            ) : (
              <ReviewsGrid reviews={reviews} />
            )}
          </div>

          <nav className="mt-14 flex flex-wrap justify-center gap-3 text-xs font-bold text-[#5d47bd]" aria-label="Related pages">
            <Link href="/features" className="rounded-full bg-[#f3f0ff] px-4 py-2 hover:bg-[#ebe6ff]">Features</Link>
            <Link href="/faq" className="rounded-full bg-[#f3f0ff] px-4 py-2 hover:bg-[#ebe6ff]">FAQ</Link>
            <Link href="/about" className="rounded-full bg-[#f3f0ff] px-4 py-2 hover:bg-[#ebe6ff]">About</Link>
            <Link href="/auth/register" className="rounded-full bg-[#7259e8] px-4 py-2 text-white hover:bg-[#6048d5]">Start free</Link>
          </nav>
        </div>
      </section>
    </main>
  );
}
