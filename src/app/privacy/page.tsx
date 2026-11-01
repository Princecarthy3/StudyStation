import type { Metadata } from "next";
import { InfoPage, type InfoSection } from "@/components/info-page";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Learn how StudyStation securely handles account information, Google OAuth user data, lecture recordings, notes, and study materials.",
  alternates: {
    canonical: "/privacy",
  },
  openGraph: {
    title: "Privacy Policy · StudyStation",
    description: "Learn how StudyStation handles account information, Google OAuth data, and study materials.",
    url: "/privacy",
  },
};

const sections: InfoSection[] = [
  {
    heading: "1. Information we collect and process",
    paragraphs: [
      "StudyStation processes information you enter or upload to provide your personalized learning environment. This includes account details, academic profile information (such as your university, programme, and study preferences), course details, lecture recordings, transcripts, AI-generated study notes, flashcards, practice quizzes, and planner calendar entries.",
      "We collect only the minimum information necessary to operate your personal study workspace and facilitate collaborative study groups.",
    ],
  },
  {
    heading: "2. Google OAuth user data (Google Sign-In)",
    paragraphs: [
      "When you sign in or register with StudyStation using Google Sign-In, we request access to basic, non-sensitive Google profile scopes (openid, email, profile). Specifically, StudyStation accesses and processes:",
    ],
    bullets: [
      "Your verified primary Google email address (used for secure account authentication, login identification, and critical notifications).",
      "Your display name and profile picture URL (used to personalize your workspace and identify you in joined study groups).",
      "Your unique Google Account User ID (used to link your StudyStation account with your authenticated Google identity).",
    ],
  },
  {
    heading: "3. How we use your Google user data",
    paragraphs: [
      "Your Google account information is strictly used for the purpose of authenticating your identity, creating and securing your StudyStation account, and displaying your profile within your private study space.",
      "We do NOT use Google user data for advertising, sponsored listings, commercial profiling, or marketing campaigns. We do NOT use, train, or tune generalized machine learning or AI models with your personal Google account data.",
    ],
  },
  {
    heading: "4. Google API Services User Data Policy (Limited Use)",
    paragraphs: [
      (
        <span key="limited-use">
          StudyStation’s use and transfer to any other app of information received from Google APIs will adhere to the{" "}
          <a
            href="https://developers.google.com/terms/api-services-user-data-policy"
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold text-[#7259e8] underline hover:text-[#5841c6]"
          >
            Google API Services User Data Policy
          </a>
          , including the Limited Use requirements.
        </span>
      ),
      "We do not sell, rent, monetize, or transfer your Google user data to data brokers or advertising networks under any circumstances.",
    ],
  },
  {
    heading: "5. Service providers & data sharing",
    paragraphs: [
      "StudyStation relies on vetted infrastructure service providers strictly to deliver core platform services:",
    ],
    bullets: [
      "Supabase: Provides PostgreSQL database hosting, authentication token verification, and private cloud storage (with Row Level Security and encryption in transit and at rest).",
      "AI & Transcription Providers: When you trigger lecture transcription or AI Study Lab tools, uploaded media or lecture text is sent to the configured provider (such as Groq, OpenRouter, or Google Gemini) strictly for processing and note generation under enterprise data protection terms.",
      "Jitsi Meet: Powering prototype peer study calls. StudyStation authorizes group members before issuing room IDs, but external meeting providers process real-time call media according to their public service terms.",
    ],
  },
  {
    heading: "6. Data retention and account controls",
    paragraphs: [
      "Your personal information, course materials, notes, and Google account details are retained only for as long as your StudyStation account remains active.",
      "When you delete items (such as a lecture, transcript, or course), they and their associated study materials are immediately removed from your active database records and private cloud storage buckets.",
    ],
  },
  {
    heading: "7. User data deletion & revoking Google access",
    paragraphs: [
      "You have complete control over your account and personal data at all times:",
    ],
    bullets: [
      (
        <span key="in-app-delete">
          <strong>In-app deletion:</strong> You can permanently delete your StudyStation account and all stored data (recordings, transcripts, notes, profile) at any time by going to Account Settings and confirming deletion.
        </span>
      ),
      (
        <span key="email-delete">
          <strong>Support deletion request:</strong> You may also request complete data deletion by emailing{" "}
          <a href="mailto:studystation.support@gmail.com" className="font-bold text-[#7259e8] underline">
            studystation.support@gmail.com
          </a>
          . Deletion requests are processed within 3 business days.
        </span>
      ),
      (
        <span key="revoke-google">
          <strong>Revoke Google permissions:</strong> You can disconnect StudyStation and revoke access to your Google account at any moment through your{" "}
          <a
            href="https://myaccount.google.com/permissions"
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold text-[#7259e8] underline hover:text-[#5841c6]"
          >
            Google Account Third-Party Permissions
          </a>
          .
        </span>
      ),
    ],
  },
  {
    heading: "8. Security and communications",
    paragraphs: [
      "We implement industry-standard security safeguards, including HTTPS TLS encryption in transit, cryptographic password hashing, signed storage URLs with expiration, and database Row Level Security (RLS) ensuring students can only access their authorized workspace and joined study groups.",
      (
        <span key="contact">
          For any privacy questions, security concerns, or data protection inquiries, contact the StudyStation support team directly at{" "}
          <a href="mailto:studystation.support@gmail.com" className="font-bold text-[#7259e8] underline">
            studystation.support@gmail.com
          </a>
          .
        </span>
      ),
    ],
  },
];

export default function PrivacyPage() {
  return (
    <InfoPage
      title="Privacy Policy"
      description="How StudyStation protects your privacy, manages your account, and handles Google OAuth user data."
      sections={sections}
    />
  );
}
