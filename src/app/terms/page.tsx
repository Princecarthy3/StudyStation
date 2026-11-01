import type { Metadata } from "next";
import { InfoPage, type InfoSection } from "@/components/info-page";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Terms and conditions for using StudyStation educational tools, authentication, and study services.",
  alternates: {
    canonical: "/terms",
  },
  openGraph: {
    title: "Terms of Service · StudyStation",
    description: "Terms and conditions for using StudyStation educational tools and services.",
    url: "/terms",
  },
};

const sections: InfoSection[] = [
  {
    heading: "1. Agreement to terms",
    paragraphs: [
      "By creating an account, signing in with Google, or accessing StudyStation, you agree to comply with and be legally bound by these Terms of Service. If you do not agree to these terms, please discontinue using StudyStation.",
      "You must be at least 13 years old (or the age of majority in your jurisdiction) to use StudyStation.",
    ],
  },
  {
    heading: "2. Account registration and Google authentication",
    paragraphs: [
      "You may register an account using your email address or through supported third-party identity providers such as Google Sign-In.",
      "When using Google Sign-In, you authorize StudyStation to verify your identity using the basic profile information provided by Google. You are responsible for safeguarding your credentials and for all activities that occur under your account.",
    ],
  },
  {
    heading: "3. User content and ownership",
    paragraphs: [
      "You retain full intellectual property ownership of the lecture audio, video, notes, and study materials you upload or generate on StudyStation.",
      "You grant StudyStation a limited, non-exclusive license solely to host, process, transcribe, and format your content as necessary to provide study tools to you and any collaborative groups you explicitly join.",
      "You must possess all necessary rights and academic permissions to upload, record, or transcribe any educational materials. Do not upload materials that violate copyright, confidentiality, or privacy laws.",
    ],
  },
  {
    heading: "4. AI tools and academic integrity",
    paragraphs: [
      "AI-generated summaries, flashcards, quizzes, and study suggestions are created by automated language models. While designed to assist student revision, AI outputs may occasionally contain inaccuracies or omissions.",
      "AI study tools are intended to complement, not replace, primary coursework, textbook study, and instructor guidance. Students are responsible for verifying study content against official curriculum resources.",
    ],
  },
  {
    heading: "5. Third-party integrations",
    paragraphs: [
      "StudyStation integrates with third-party providers including Google (for authentication), Supabase (for database hosting and storage), and speech-to-text / AI inference providers. Your use of third-party features is subject to the respective provider’s terms and acceptable use policies.",
    ],
  },
  {
    heading: "6. Account termination and data deletion",
    paragraphs: [
      "You have the right to terminate your account and request complete deletion of your personal data at any time via in-app account settings or by contacting studystation.support@gmail.com.",
      "StudyStation reserves the right to suspend or terminate accounts that violate these terms, compromise system security, or engage in abusive or unlawful behavior.",
    ],
  },
  {
    heading: "7. Contact and support",
    paragraphs: [
      (
        <span key="contact">
          For legal inquiries, terms clarification, or platform assistance, please email our support team at{" "}
          <a href="mailto:studystation.support@gmail.com" className="font-bold text-[#7259e8] underline">
            studystation.support@gmail.com
          </a>
          .
        </span>
      ),
    ],
  },
];

export default function TermsPage() {
  return (
    <InfoPage
      title="Terms of Service"
      description="The rules and conditions governing your use of StudyStation."
      sections={sections}
    />
  );
}
