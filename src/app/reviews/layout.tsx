import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Student Reviews & Stories",
  description:
    "Read genuine reviews and study feedback from university students using StudyStation to record lectures, create AI notes, and prepare for exams.",
  alternates: {
    canonical: "/reviews",
  },
  openGraph: {
    title: "Student Reviews & Testimonials · StudyStation",
    description:
      "See how university students boost their study habits, ace exams, and turn lectures into high-yield revision material.",
    url: "/reviews",
  },
};

export default function ReviewsLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
