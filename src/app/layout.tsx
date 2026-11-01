import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Plus_Jakarta_Sans } from "next/font/google";
import { PwaRegister } from "@/components/pwa-register";
import { InstallAppProvider } from "@/components/install-app";
import { ThemeProvider } from "@/components/theme-provider";
import { StructuredData } from "@/components/structured-data";
import { getSiteUrl } from "@/lib/site-url";
import "./globals.css";

const sansFont = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: "StudyStation — Turn Lectures into Active Learning",
    template: "%s · StudyStation",
  },
  description:
    "Record or upload lectures, generate structured AI notes, active recall flashcards, practice quizzes, and plan your highest-performing semester study schedule.",
  applicationName: "StudyStation",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "StudyStation",
  },
  formatDetection: { telephone: false },
  icons: {
    icon: [{ url: "/logo.png", type: "image/png" }],
    apple: "/icons/apple-touch-icon.png",
  },
  keywords: [
    "StudyStation",
    "AI lecture notes",
    "lecture transcription",
    "study companion",
    "AI flashcard maker",
    "quiz generator",
    "study planner",
    "college study assistant",
    "audio to notes",
    "exam preparation",
    "active recall study",
    "university learning platform",
    "student productivity",
  ],
  authors: [{ name: "StudyStation Team" }],
  creator: "StudyStation",
  publisher: "StudyStation",
  category: "education",
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    title: "StudyStation — Turn Lectures into Active Learning",
    description:
      "Transform lectures into high-yield study notes, flashcard decks, practice exam quizzes, and personalized study schedules.",
    url: "/",
    siteName: "StudyStation",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "/logo.png",
        width: 800,
        height: 800,
        alt: "StudyStation — AI Study Companion for Students",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "StudyStation — Turn Lectures into Active Learning",
    description:
      "AI-powered lecture capture, structured notes, flashcards, quizzes, and weekly study planner.",
    images: ["/logo.png"],
  },
  verification: {
    google:
      process.env.GOOGLE_SITE_VERIFICATION?.trim() ||
      process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION?.trim() ||
      "google4df8a6879662fa0d",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#fbfaff",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={sansFont.variable}>
      <head>
        <StructuredData />
      </head>
      <body className="font-sans antialiased">
        <ThemeProvider>
          <InstallAppProvider>
            <PwaRegister />
            {children}
          </InstallAppProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

