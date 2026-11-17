import type { Metadata } from "next";
import { InfoPage, type InfoSection } from "@/components/info-page";

export const metadata: Metadata = {
  title: "Frequently Asked Questions (FAQ)",
  description:
    "Answers to common questions about StudyStation lecture recording, AI notes, quiz generation, flashcards, study groups, and student privacy.",
  alternates: { canonical: "/faq" },
  robots: { index: true, follow: true },
  openGraph: {
    title: "StudyStation FAQ — Questions & Answers",
    description:
      "Everything you need to know about StudyStation features, lecture transcription, quiz generation, and account security.",
    url: "/faq",
  },
  twitter: {
    card: "summary_large_image",
    title: "StudyStation FAQ",
    description:
      "Lecture recording, AI notes, quizzes, flashcards, study groups, and privacy — answered.",
  },
};

const sections: InfoSection[] = [
  {
    heading: "What file formats can I use for lecture transcription?",
    paragraphs: [
      "You can record a lecture in the app or upload supported audio and video files for processing. Supported formats commonly include MP3, M4A, WAV, MP4, and WebM. Available formats and upload limits can depend on your device and the current service configuration.",
    ],
  },
  {
    heading: "How are flashcards and quizzes created?",
    paragraphs: [
      "AI Study Lab uses your lecture transcript and notes to generate summaries, explanations, flashcards, and practice quizzes. You choose difficulty and question count (up to 30 for quizzes). Always review generated material for accuracy before relying on it in exams.",
    ],
  },
  {
    heading: "Are my study notes and recordings private?",
    paragraphs: [
      "Personal study materials stay in your private study space by default. Content you share into a study group may be visible to that group’s members. Read the Privacy Policy and check sharing settings before uploading sensitive material.",
    ],
  },
  {
    heading: "Can I import a timetable or syllabus?",
    paragraphs: [
      "Yes. StudyStation can parse timetable CSV files and extract schedule information from supported syllabus documents or images. Review and edit extracted events before adding them to your personal study planner.",
    ],
  },
  {
    heading: "Can I use StudyStation on my phone?",
    paragraphs: [
      "Yes. StudyStation works in mobile browsers and can be installed on supported devices with Add to Home Screen (iPhone/iPad) or Install app / Android package download. A Windows app is also available from the Microsoft Store.",
    ],
  },
  {
    heading: "How do study group calls work?",
    paragraphs: [
      "Group members can start a live study call from the group chat. Other members receive a notification and a Join Call card in the conversation. Calls are intended for collaborative study sessions with your classmates.",
    ],
  },
  {
    heading: "Is StudyStation free for students?",
    paragraphs: [
      "You can create an account and use core study tools to capture lectures, generate notes, and organize your semester. Feature availability may expand over time; check the product and account screens for the latest access details.",
    ],
  },
];

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: sections.map((section) => ({
    "@type": "Question",
    name: section.heading,
    acceptedAnswer: {
      "@type": "Answer",
      text: section.paragraphs.map((p) => (typeof p === "string" ? p : "")).join(" "),
    },
  })),
};

export default function FaqPage() {
  return (
    <InfoPage
      title="Frequently asked questions"
      description="Quick answers about lecture capture, AI notes, quizzes, flashcards, planners, and privacy on StudyStation."
      sections={sections}
      pathname="/faq"
      jsonLd={faqSchema}
    />
  );
}
