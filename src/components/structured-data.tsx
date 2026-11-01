import { getSiteUrl } from "@/lib/site-url";

export function StructuredData() {
  const siteUrl = getSiteUrl();

  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${siteUrl}/#website`,
    url: siteUrl,
    name: "StudyStation",
    alternateName: ["StudyStation AI", "Study Station"],
    description:
      "AI-powered study companion that records lectures, generates structured notes, flashcards, practice quizzes, and helps students plan their weekly study schedule.",
    inLanguage: "en-US",
    publisher: {
      "@type": "Organization",
      "@id": `${siteUrl}/#organization`,
      name: "StudyStation",
      url: siteUrl,
      logo: {
        "@type": "ImageObject",
        url: `${siteUrl}/logo.png`,
      },
    },
  };

  const softwareAppSchema = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "@id": `${siteUrl}/#webapp`,
    name: "StudyStation",
    applicationCategory: "EducationalApplication",
    operatingSystem: "All (Web, iOS, Android, macOS, Windows)",
    browserRequirements: "Requires JavaScript and HTML5",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
    },
    description:
      "All-in-one AI study assistant for university students. Record lectures, auto-transcribe audio/video, generate structured revision notes, active-recall flashcard decks, practice exam quizzes, and manage your semester study routine.",
    image: `${siteUrl}/logo.png`,
    author: {
      "@type": "Organization",
      name: "StudyStation",
    },
    featureList: [
      "In-browser and device lecture recording",
      "High-accuracy voice and video lecture transcription",
      "AI executive summaries and structured notes",
      "Instant flashcard deck generation",
      "Active recall quiz and practice exam lab",
      "Weekly student planner and calendar sync",
      "Peer study groups and real-time collaboration",
      "Offline-first PWA support for mobile and desktop",
    ],
  };

  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${siteUrl}/#organization`,
    name: "StudyStation",
    url: siteUrl,
    logo: `${siteUrl}/logo.png`,
    email: "studystation.support@gmail.com",
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer support",
      email: "studystation.support@gmail.com",
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareAppSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
    </>
  );
}
