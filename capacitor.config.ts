import type { CapacitorConfig } from "@capacitor/cli";

/**
 * StudyStation Android shell.
 * Loads the live Next.js deployment so SSR, auth, and API routes keep working.
 * Native mic capture is provided by the LectureRecorder Capacitor plugin.
 */
const config: CapacitorConfig = {
  appId: "app.studystation.android",
  appName: "StudyStation",
  webDir: "www",
  server: {
    url: "https://studystation.vercel.app",
    cleartext: false,
    allowNavigation: ["studystation.vercel.app", "*.vercel.app", "*.supabase.co"],
  },
  android: {
    allowMixedContent: false,
    backgroundColor: "#fbfaff",
  },
  plugins: {
    LectureRecorder: {
      // Reserved for future config
    },
  },
};

export default config;
